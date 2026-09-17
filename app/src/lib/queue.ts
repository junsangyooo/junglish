// app/src/lib/queue.ts — ratings made while offline, kept in order until they reach the server.
const KEY = 'junglish_outbox';

export type Job = { url: string; body: Record<string, unknown> };

function read(): Job[] {
	try {
		const raw = localStorage.getItem(KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function write(jobs: Job[]): void {
	try {
		if (jobs.length) localStorage.setItem(KEY, JSON.stringify(jobs));
		else localStorage.removeItem(KEY);
	} catch {
		/* storage unavailable — the job is lost, but the session keeps working */
	}
}

export function enqueue(job: Job): number {
	const jobs = read();
	jobs.push(job);
	write(jobs);
	return jobs.length;
}

export function pending(): number {
	return read().length;
}

/**
 * Whether the server will never accept this request, no matter how often we ask.
 * 401/403 mean "log in again" and 429 means "slow down" — those come back later.
 */
export function isPermanentRejection(status: number): boolean {
	if (status < 400 || status >= 500) return false;
	return status !== 401 && status !== 403 && status !== 429;
}

async function deliver(job: Job): Promise<boolean> {
	try {
		const r = await fetch(job.url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(job.body)
		});
		return r.ok || isPermanentRejection(r.status);
	} catch {
		return false;
	}
}

let flushing = false;

/**
 * Sends queued jobs oldest first, stopping at the first one that fails. The list is
 * re-read after every send: a rating made while this was running must not be dropped,
 * and two overlapping flushes must not deliver the same job twice.
 */
export async function flush(): Promise<number> {
	if (flushing) return pending();
	flushing = true;
	try {
		for (;;) {
			const jobs = read();
			if (jobs.length === 0) return 0;
			if (!(await deliver(jobs[0]))) return jobs.length;
			write(read().slice(1));
		}
	} finally {
		flushing = false;
	}
}
