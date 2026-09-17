/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `junglish-${version}`;
const OFFLINE = '/offline.html';
/** Hashed build output plus everything in static/ — safe to serve from cache forever. */
const PRECACHE = [...build, ...files];
const PRECACHED = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

/** Pages: always try the network, fall back to the copy from the last time this page worked. */
async function pageWithFallback(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch {
		const hit = await cache.match(request);
		if (hit) {
			// Tell the page it is looking at a snapshot so it can say so.
			const headers = new Headers(hit.headers);
			headers.set('x-junglish-offline', '1');
			return new Response(await hit.blob(), { status: hit.status, headers });
		}
		return (await cache.match(OFFLINE)) ?? new Response('offline', { status: 503 });
	}
}

sw.addEventListener('push', (event) => {
	const data = (() => {
		try {
			return event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
		} catch {
			return undefined;
		}
	})();
	event.waitUntil(
		sw.registration.showNotification(data?.title ?? 'Junglish', {
			body: data?.body ?? '오늘 미션이 남아 있어요.',
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			data: { url: data?.url ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
	event.waitUntil(
		(async () => {
			const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of clients) {
				await client.focus();
				await client.navigate(url);
				return;
			}
			await sw.clients.openWindow(url);
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	// Progress lives on the server; a cached rating or step would be a lie.
	if (url.pathname.startsWith('/api/')) return;

	if (PRECACHED.has(url.pathname)) {
		event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((hit) => hit ?? fetch(request))));
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(pageWithFallback(request));
	}
});
