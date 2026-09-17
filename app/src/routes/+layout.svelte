<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';

	let { children } = $props();
	let offline = $state(false);

	onMount(() => {
		offline = !navigator.onLine;
		const on = () => (offline = false);
		const off = () => (offline = true);
		addEventListener('online', on);
		addEventListener('offline', off);

		// SvelteKit registers src/service-worker.ts itself; we only handle the swap.
		// A new worker taking over mid-session means the app code changed under us.
		let reloading = false;
		const hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
		const onControllerChange = () => {
			if (reloading || !hadController) return;
			reloading = true;
			location.reload();
		};
		navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);

		return () => {
			removeEventListener('online', on);
			removeEventListener('offline', off);
			navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
		};
	});
</script>

{#if offline}
	<p class="offline-bar small">오프라인 · 저장한 화면을 보고 있어요</p>
{/if}

{@render children()}

<style>
	.offline-bar {
		margin: 0; padding: calc(6px + env(safe-area-inset-top)) 12px 6px;
		text-align: center; font-weight: 700;
		background: var(--hard-soft); color: var(--hard-press);
	}
</style>
