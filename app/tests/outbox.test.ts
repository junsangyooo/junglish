import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueue, flush, isPermanentRejection, pending } from '../src/lib/queue';

const store = new Map<string, string>();

beforeEach(() => {
	store.clear();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	});
});

afterEach(() => vi.unstubAllGlobals());

const job = (id: number) => ({ url: '/api/rate', body: { type: 'word', id, rating: 3 } });

describe('isPermanentRejection', () => {
	it('drops what the server will never accept', () => {
		expect(isPermanentRejection(400)).toBe(true);
		expect(isPermanentRejection(404)).toBe(true);
		expect(isPermanentRejection(422)).toBe(true);
	});

	it('keeps what is worth retrying — an expired session is not a bad rating', () => {
		expect(isPermanentRejection(401)).toBe(false);
		expect(isPermanentRejection(403)).toBe(false);
		expect(isPermanentRejection(429)).toBe(false);
		expect(isPermanentRejection(500)).toBe(false);
		expect(isPermanentRejection(200)).toBe(false);
	});
});

describe('flush', () => {
	it('sends oldest first and empties the queue', async () => {
		const sent: number[] = [];
		vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
			sent.push(JSON.parse(init.body).id);
			return { ok: true, status: 200 };
		});
		enqueue(job(1));
		enqueue(job(2));
		expect(await flush()).toBe(0);
		expect(sent).toEqual([1, 2]);
		expect(pending()).toBe(0);
	});

	it('stops at the first failure and keeps the rest', async () => {
		vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
			if (JSON.parse(init.body).id === 2) throw new Error('offline');
			return { ok: true, status: 200 };
		});
		enqueue(job(1));
		enqueue(job(2));
		enqueue(job(3));
		expect(await flush()).toBe(2);
		expect(pending()).toBe(2);
	});

	it('keeps a rating the server answered with 401 instead of throwing it away', async () => {
		vi.stubGlobal('fetch', async () => ({ ok: false, status: 401 }));
		enqueue(job(1));
		expect(await flush()).toBe(1);
		expect(pending()).toBe(1);
	});

	it('drops a rating the server rejected for good', async () => {
		vi.stubGlobal('fetch', async () => ({ ok: false, status: 400 }));
		enqueue(job(1));
		expect(await flush()).toBe(0);
		expect(pending()).toBe(0);
	});

	it('does not lose a rating made while it was sending', async () => {
		let inFlight = 0;
		vi.stubGlobal('fetch', async () => {
			// The user rates another card in the middle of the first send.
			if (inFlight++ === 0) enqueue(job(99));
			return { ok: true, status: 200 };
		});
		enqueue(job(1));
		await flush();
		expect(pending()).toBe(0);
		expect(inFlight).toBe(2); // both the original and the one added mid-flight went out
	});

	it('does not send the same job twice when two flushes overlap', async () => {
		const sent: number[] = [];
		vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
			sent.push(JSON.parse(init.body).id);
			await new Promise((r) => setTimeout(r, 10));
			return { ok: true, status: 200 };
		});
		enqueue(job(1));
		enqueue(job(2));
		await Promise.all([flush(), flush()]);
		expect(sent).toEqual([1, 2]);
		expect(pending()).toBe(0);
	});
});
