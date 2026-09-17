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

/** Sends queued jobs oldest first, stopping at the first one that fails. Returns what is left. */
export async function flush(): Promise<number> {
	let jobs = read();
	while (jobs.length) {
		const [job] = jobs;
		let delivered = false;
		try {
			const r = await fetch(job.url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(job.body)
			});
			// 4xx means the server will never accept it; dropping beats blocking the queue forever.
			delivered = r.ok || (r.status >= 400 && r.status < 500);
		} catch {
			delivered = false;
		}
		if (!delivered) break;
		jobs = jobs.slice(1);
		write(jobs);
	}
	return jobs.length;
}
