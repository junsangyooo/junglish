import { describe, expect, it } from 'vitest';
import { advanceStep, completeDay, getProgress, localDate, markActivity, newPatternIds, newWordIds, streak } from '../src/lib/server/mission';
import { markKnown, rate } from '../src/lib/server/fsrs';
import { makeTestDbs } from './helpers';

const t = (s: string) => new Date(s);

describe('mission', () => {
	it('starts at review and advances in order', () => {
		const dbs = makeTestDbs();
		expect(getProgress(dbs, 1, 1)).toEqual({ step: 'review', completed_at: null });
		expect(advanceStep(dbs, 1, 1, 'review')).toBe('words');
		expect(advanceStep(dbs, 1, 1, 'review')).toBe('words');      // stale from: no double advance
		expect(getProgress(dbs, 1, 1).step).toBe('words');
	});

	it('final -> done completes the day and bumps current_day once', () => {
		const dbs = makeTestDbs();
		for (const s of ['review', 'words', 'patterns', 'dialogue', 'shadow', 'write'] as const) advanceStep(dbs, 1, 1, s);
		expect(advanceStep(dbs, 1, 1, 'final', t('2026-09-10T20:00:00+09:00'))).toBe('done');
		expect(getProgress(dbs, 1, 1).completed_at).toBeTruthy();
		expect(dbs.progress.prepare('select current_day from users where id=1').get()).toEqual({ current_day: 2 });
		completeDay(dbs, 1, 1);
		expect(dbs.progress.prepare('select current_day from users where id=1').get()).toEqual({ current_day: 2 });
	});

	it('localDate uses Asia/Seoul', () => {
		expect(localDate(t('2026-09-10T16:30:00Z'))).toBe('2026-09-11');
	});

	it('streak counts consecutive days ending today or yesterday', () => {
		const dbs = makeTestDbs();
		const today = t('2026-09-10T12:00:00+09:00');
		expect(streak(dbs, 1, today)).toBe(0);
		markActivity(dbs, 1, t('2026-09-08T12:00:00+09:00'));
		markActivity(dbs, 1, t('2026-09-09T12:00:00+09:00'));
		expect(streak(dbs, 1, today)).toBe(2);       // yesterday counts, today not yet done
		markActivity(dbs, 1, today);
		expect(streak(dbs, 1, today)).toBe(3);
		expect(streak(dbs, 1, t('2026-09-13T12:00:00+09:00'))).toBe(0);
	});

	it('new ids exclude rated and known cards', () => {
		const dbs = makeTestDbs();
		expect(newWordIds(dbs, 1, 1)).toEqual([1, 2, 3]);
		rate(dbs, 1, 'word', 1, 3);
		markKnown(dbs, 1, 'word', 2);
		expect(newWordIds(dbs, 1, 1)).toEqual([3]);
		expect(newPatternIds(dbs, 1, 1)).toEqual([1, 2, 3]);
	});

	it('done load relies on day = current_day - 1 after completion', () => {
		const dbs = makeTestDbs();
		for (const s of ['review', 'words', 'patterns', 'dialogue', 'shadow', 'write', 'final'] as const) advanceStep(dbs, 1, 1, s);
		expect(dbs.progress.prepare('select current_day from users where id=1').get()).toEqual({ current_day: 2 });
		expect(getProgress(dbs, 1, 1).step).toBe('done');
		expect(getProgress(dbs, 1, 2).step).toBe('review');
	});
});
