import type { Dbs } from './db';

export const STEPS = ['review', 'words', 'patterns', 'dialogue', 'shadow', 'write', 'final', 'done'] as const;
export type Step = (typeof STEPS)[number];

export function localDate(d: Date): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function getProgress(dbs: Dbs, userId: number, day: number): { step: Step; completed_at: string | null } {
	dbs.progress.prepare('insert or ignore into day_progress(user_id, day) values(?, ?)').run(userId, day);
	return dbs.progress.prepare('select step, completed_at from day_progress where user_id=? and day=?').get(userId, day) as any;
}

export function markActivity(dbs: Dbs, userId: number, now = new Date()): void {
	dbs.progress.prepare('insert or ignore into activity_days(user_id, date) values(?, ?)').run(userId, localDate(now));
}

export function completeDay(dbs: Dbs, userId: number, day: number, now = new Date()): void {
	const tx = dbs.progress.transaction(() => {
		dbs.progress.prepare("update day_progress set step='done', completed_at=coalesce(completed_at, ?) where user_id=? and day=?")
			.run(now.toISOString(), userId, day);
		dbs.progress.prepare('update users set current_day = current_day + 1 where id=? and current_day=?').run(userId, day);
		markActivity(dbs, userId, now);
	});
	tx();
}

export function advanceStep(dbs: Dbs, userId: number, day: number, from: Step, now = new Date()): Step {
	const { step } = getProgress(dbs, userId, day);
	if (step !== from || step === 'done') return step;
	const next = STEPS[STEPS.indexOf(step) + 1];
	if (next === 'done') completeDay(dbs, userId, day, now);
	else dbs.progress.prepare('update day_progress set step=? where user_id=? and day=?').run(next, userId, day);
	return next;
}

export function streak(dbs: Dbs, userId: number, now = new Date()): number {
	const dates = new Set(
		(dbs.progress.prepare('select date from activity_days where user_id=?').all(userId) as { date: string }[]).map((r) => r.date)
	);
	let cursor = new Date(now);
	if (!dates.has(localDate(cursor))) cursor = new Date(cursor.getTime() - 86_400_000);
	let n = 0;
	while (dates.has(localDate(cursor))) {
		n++;
		cursor = new Date(cursor.getTime() - 86_400_000);
	}
	return n;
}

function newIds(dbs: Dbs, userId: number, day: number, type: 'word' | 'pattern'): number[] {
	const table = type === 'word' ? 'words' : 'patterns';
	const ids = (dbs.content.prepare(`select id from ${table} where day=? order by seq`).all(day) as { id: number }[]).map((r) => r.id);
	if (ids.length === 0) return [];
	const seen = new Set(
		(dbs.progress.prepare(`select card_id from card_states where user_id=? and card_type=? and card_id in (${ids.join(',')})`)
			.all(userId, type) as { card_id: number }[]).map((r) => r.card_id)
	);
	return ids.filter((id) => !seen.has(id));
}

export const newWordIds = (dbs: Dbs, userId: number, day: number) => newIds(dbs, userId, day, 'word');
export const newPatternIds = (dbs: Dbs, userId: number, day: number) => newIds(dbs, userId, day, 'pattern');
