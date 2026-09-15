import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { dueCards, dueCount, getState, markKnown, rate, unmarkKnown } from '../src/lib/server/fsrs';
import { makeTestDbs } from './helpers';

const now = new Date('2026-09-10T09:00:00+09:00');

describe('fsrs', () => {
	it('rating a new card creates state and a review log', () => {
		const dbs = makeTestDbs();
		const s = rate(dbs, 1, 'word', 1, 3, now);
		expect(s.reps).toBe(1);
		expect(new Date(s.due).getTime()).toBeGreaterThan(now.getTime());
		expect(getState(dbs, 1, 'word', 1)?.card_id).toBe(1);
		expect(dbs.progress.prepare('select count(*) as n from review_logs').get()).toEqual({ n: 1 });
	});

	it('Again keeps the card due within minutes; Good pushes it to later days', () => {
		const dbs = makeTestDbs();
		const again = rate(dbs, 1, 'word', 1, 1, now);
		const good = rate(dbs, 1, 'word', 2, 3, now);
		expect(new Date(again.due).getTime() - now.getTime()).toBeLessThan(15 * 60_000);
		expect(new Date(good.due).getTime() - now.getTime()).toBeGreaterThan(12 * 3600_000);
	});

	it('known cards are excluded from due and can be restored', () => {
		const dbs = makeTestDbs();
		markKnown(dbs, 1, 'word', 3);
		expect(getState(dbs, 1, 'word', 3)?.known).toBe(1);
		rate(dbs, 1, 'word', 1, 1, now);
		const later = new Date(now.getTime() + 60 * 60_000);
		expect(dueCards(dbs, 1, later).map((c) => c.card_id)).toEqual([1]);
		unmarkKnown(dbs, 1, 'word', 3);
		expect(getState(dbs, 1, 'word', 3)).toBeNull();
	});

	it('dueCards respects horizon and limit; dueCount matches', () => {
		const dbs = makeTestDbs();
		rate(dbs, 1, 'word', 1, 1, now); // due in 10 min
		rate(dbs, 1, 'pattern', 1, 1, now); // due in 10 min
		rate(dbs, 1, 'word', 2, 3, now); // due tomorrow+
		expect(dueCards(dbs, 1, now).length).toBe(0);
		expect(dueCards(dbs, 1, now, { horizonMinutes: 15 }).length).toBe(2);
		expect(dueCards(dbs, 1, now, { horizonMinutes: 15, limit: 1 }).length).toBe(1);
		expect(dueCount(dbs, 1, new Date(now.getTime() + 15 * 60_000))).toBe(2);
	});

	it('rating a known card is a no-op', () => {
		const dbs = makeTestDbs();
		markKnown(dbs, 1, 'word', 3);
		const s = rate(dbs, 1, 'word', 3, 3, now);
		expect(s.known).toBe(1);
		expect(s.reps).toBe(0);
		expect(dbs.progress.prepare('select count(*) as n from review_logs').get()).toEqual({ n: 0 });
	});

	it('rating a card that was already in Review keeps State.Review on Good', () => {
		const dbs = makeTestDbs();
		let s = rate(dbs, 1, 'word', 1, 3, now);
		s = rate(dbs, 1, 'word', 1, 3, new Date(new Date(s.due).getTime() + 1000));
		s = rate(dbs, 1, 'word', 1, 3, new Date(new Date(s.due).getTime() + 1000));
		expect(s.state).toBe(State.Review);
	});
});
