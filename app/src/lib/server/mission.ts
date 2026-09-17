import type { User } from './auth';
import { dayDialogue } from './content';
import type { Dbs } from './db';
import { dueCount } from './fsrs';

export const STEPS = ['review', 'words', 'patterns', 'dialogue', 'shadow', 'write', 'final', 'done'] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABEL: Record<Step, string> = {
	review: '복습', words: '신규 단어', patterns: '신규 패턴', dialogue: '읽기·듣기',
	shadow: '쉐도잉', write: '내 문장', final: '마무리 복습', done: '완료'
};

// Hoisted: building a formatter costs ~20µs, and streak() formats one date per day of history.
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function localDate(d: Date): string {
	return dateFmt.format(d);
}

/** UTC bounds of one Seoul day, so queries can range over an indexed column instead of date(col, '+9 hours'). */
export function seoulDayRange(date: string): { start: string; end: string } {
	const start = new Date(`${date}T00:00:00+09:00`);
	return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export function getProgress(dbs: Dbs, userId: number, day: number): { step: Step; completed_at: string | null } {
	dbs.progress.prepare('insert or ignore into day_progress(user_id, day) values(?, ?)').run(userId, day);
	return dbs.progress.prepare('select step, completed_at from day_progress where user_id=? and day=?').get(userId, day) as any;
}

/**
 * When a rating was queued offline the client sends the time it actually happened, so a
 * session finished at 23:50 and delivered at 00:10 still counts for the right day.
 * The client clock is untrusted: only today or yesterday in Seoul, never ahead of the server.
 */
export function activityTime(at: unknown, now = new Date()): Date {
	if (typeof at !== 'string') return now;
	const t = new Date(at);
	if (Number.isNaN(t.getTime()) || t.getTime() > now.getTime()) return now;
	const date = localDate(t);
	if (date === localDate(now) || date === localDate(new Date(now.getTime() - 86_400_000))) return t;
	return now;
}

export function markActivity(dbs: Dbs, userId: number, now = new Date()): void {
	dbs.progress.prepare('insert or ignore into activity_days(user_id, date) values(?, ?)').run(userId, localDate(now));
}

export function completeDay(dbs: Dbs, userId: number, day: number, now = new Date()): void {
	const tx = dbs.progress.transaction(() => {
		dbs.progress.prepare(`insert into day_progress(user_id, day, step, completed_at) values(?,?,'done',?)
			on conflict(user_id, day) do update set step='done', completed_at=coalesce(day_progress.completed_at, excluded.completed_at)`)
			.run(userId, day, now.toISOString());
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

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' });

/** 0 = Monday … 6 = Sunday, in Seoul time. */
export function weekdayIndex(d: Date): number {
	return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekdayFmt.format(d));
}

const shiftDays = (from: Date, n: number) => new Date(from.getTime() + n * 86_400_000);

export type DayDot = { date: string; label: string; active: boolean; today: boolean };

/** Monday-to-Sunday dots for the current week, for the home header. */
export function weekActivity(dbs: Dbs, userId: number, now = new Date()): DayDot[] {
	const today = localDate(now);
	const idx = weekdayIndex(now);
	const dates = Array.from({ length: 7 }, (_, i) => localDate(shiftDays(now, i - idx)));
	const active = activeDates(dbs, userId, dates[0], dates[6]);
	return dates.map((date, i) => ({ date, label: WEEKDAYS[i], active: active.has(date), today: date === today }));
}

/** Study days over the last 12 weeks, starting on a Monday so the grid lines up by weekday. */
export function activityGrid(dbs: Dbs, userId: number, now = new Date()): DayDot[] {
	const today = localDate(now);
	const idx = weekdayIndex(now);
	const dates = Array.from({ length: 77 + idx + 1 }, (_, i) => localDate(shiftDays(now, i - (77 + idx))));
	const active = activeDates(dbs, userId, dates[0], today);
	return dates.map((date) => ({ date, label: WEEKDAYS[weekdayIndex(new Date(`${date}T12:00:00+09:00`))], active: active.has(date), today: date === today }));
}

function activeDates(dbs: Dbs, userId: number, from: string, to: string): Set<string> {
	const rows = dbs.progress.prepare('select date from activity_days where user_id=? and date between ? and ?')
		.all(userId, from, to) as { date: string }[];
	return new Set(rows.map((r) => r.date));
}

/** The day finished today, if any — the home screen celebrates instead of nagging. */
export function dayFinishedToday(dbs: Dbs, userId: number, now = new Date()): number | null {
	const { start, end } = seoulDayRange(localDate(now));
	const row = dbs.progress.prepare('select day from day_progress where user_id=? and completed_at >= ? and completed_at < ? order by day desc limit 1')
		.get(userId, start, end) as { day: number } | undefined;
	return row?.day ?? null;
}

export type StepCard = { step: Step; label: string; detail: string; state: 'done' | 'current' | 'todo' };

/** The day's steps as a path: what is finished, what is next, what is still ahead. */
export function dayOverview(dbs: Dbs, user: User, day: number, current: Step): StepCard[] {
	const currentIndex = STEPS.indexOf(current);
	const counts: Record<string, string> = {
		review: `${dueCount(dbs, user.id)}개`,
		words: `${newWordIds(dbs, user.id, day).length}개`,
		patterns: `${newPatternIds(dbs, user.id, day).length}개`,
		dialogue: `${dayDialogue(dbs, day)?.lines.length ?? 0}줄`,
		shadow: '한 줄씩 따라 말하기',
		write: '3문장',
		final: '오늘 배운 것 굳히기'
	};
	return STEPS.filter((s) => s !== 'done').map((step, i) => ({
		step, label: STEP_LABEL[step],
		detail: i < currentIndex ? '완료' : counts[step],
		state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo'
	}));
}
