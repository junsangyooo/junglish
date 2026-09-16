import { describe, expect, it } from 'vitest';
import { makeTestDbs } from './helpers';
import { advanceStep, completeDay, dayFinishedToday, dayOverview, weekActivity, weekdayIndex } from '../src/lib/server/mission';
import { previewIntervals } from '../src/lib/server/fsrs';
import type { User } from '../src/lib/server/auth';

const user: User = { id: 1, name: 'test', current_day: 1, review_limit: 100 };

describe('weekActivity', () => {
	it('returns Monday..Sunday with today flagged once', () => {
		const dbs = makeTestDbs();
		const now = new Date('2026-09-16T10:00:00+09:00'); // Wednesday
		const week = weekActivity(dbs, 1, now);
		expect(week.map((d) => d.label)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
		expect(week.filter((d) => d.today).map((d) => d.date)).toEqual(['2026-09-16']);
		expect(week[0].date).toBe('2026-09-14');
		expect(week.every((d) => !d.active)).toBe(true);
	});

	it('marks days the user studied', () => {
		const dbs = makeTestDbs();
		dbs.progress.prepare('insert into activity_days(user_id, date) values(1, ?)').run('2026-09-15');
		const week = weekActivity(dbs, 1, new Date('2026-09-16T10:00:00+09:00'));
		expect(week.filter((d) => d.active).map((d) => d.date)).toEqual(['2026-09-15']);
	});
});

describe('weekdayIndex', () => {
	it('is Monday-based in Seoul time', () => {
		expect(weekdayIndex(new Date('2026-09-14T10:00:00+09:00'))).toBe(0);
		expect(weekdayIndex(new Date('2026-09-20T10:00:00+09:00'))).toBe(6);
		// 23:30 UTC on Sunday is already Monday in Seoul.
		expect(weekdayIndex(new Date('2026-09-13T23:30:00Z'))).toBe(0);
	});
});

describe('dayFinishedToday', () => {
	it('is null until a day is completed, then reports that day', () => {
		const dbs = makeTestDbs();
		const now = new Date('2026-09-16T21:00:00+09:00');
		expect(dayFinishedToday(dbs, 1, now)).toBeNull();
		completeDay(dbs, 1, 1, now);
		expect(dayFinishedToday(dbs, 1, now)).toBe(1);
		// A day completed yesterday does not count as today.
		expect(dayFinishedToday(dbs, 1, new Date('2026-09-17T09:00:00+09:00'))).toBeNull();
	});
});

describe('dayOverview', () => {
	it('splits the steps into done / current / todo with counts', () => {
		const dbs = makeTestDbs();
		const overview = dayOverview(dbs, user, 1, 'patterns');
		expect(overview.map((s) => s.step)).toEqual(['review', 'words', 'patterns', 'dialogue', 'shadow', 'write', 'final']);
		expect(overview.map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo', 'todo']);
		expect(overview.find((s) => s.step === 'patterns')!.detail).toBe('3개');
		expect(overview.find((s) => s.step === 'dialogue')!.detail).toBe('3줄');
		expect(overview.find((s) => s.step === 'words')!.detail).toBe('완료');
	});

	it('follows the stored step as the day progresses', () => {
		const dbs = makeTestDbs();
		advanceStep(dbs, 1, 1, 'review');
		expect(dayOverview(dbs, user, 1, 'words').find((s) => s.state === 'current')!.step).toBe('words');
	});
});

describe('previewIntervals', () => {
	it('labels each rating with its next interval, longest for Good', () => {
		const p = previewIntervals(null, new Date('2026-09-16T10:00:00+09:00'));
		expect(p[1]).toBe('10분');
		expect(p[3]).toMatch(/일$/);
		expect(p[2]).toMatch(/[분시간일]$/);
	});
});
