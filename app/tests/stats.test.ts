import { describe, expect, it } from 'vitest';
import { makeTestDbs } from './helpers';
import type { Dbs } from '../src/lib/server/db';
import { localDate, seoulDayRange } from '../src/lib/server/mission';
import { summary } from '../src/lib/server/stats';

/** A due date that falls inside the Seoul day `offset` days from today. */
function dueInDays(offset: number): string {
	const date = localDate(new Date(Date.now() + offset * 86_400_000));
	return new Date(new Date(seoulDayRange(date).start).getTime() + 3_600_000).toISOString();
}

function addCard(dbs: Dbs, o: { type: 'word' | 'pattern'; id: number; due: string; known?: 0 | 1; scheduled?: number }) {
	dbs.progress.prepare(`insert into card_states(user_id,card_type,card_id,known,state,due,stability,difficulty,
		elapsed_days,scheduled_days,learning_steps,reps,lapses,last_review)
		values(1,?,?,?,2,?,1,1,0,?,0,1,0,null)`).run(o.type, o.id, o.known ?? 0, o.due, o.scheduled ?? 1);
}

describe('summary.next7', () => {
	it('reports how many cards fall due on each of the next seven days', () => {
		const dbs = makeTestDbs();
		addCard(dbs, { type: 'word', id: 1, due: dueInDays(-3) }); // overdue counts as today
		addCard(dbs, { type: 'word', id: 2, due: dueInDays(0) });
		addCard(dbs, { type: 'pattern', id: 1, due: dueInDays(2) });
		addCard(dbs, { type: 'pattern', id: 2, due: dueInDays(6) });
		addCard(dbs, { type: 'pattern', id: 3, due: dueInDays(30) }); // beyond the window

		const { next7 } = summary(dbs, 1);
		expect(next7.map((d) => d.n)).toEqual([2, 0, 1, 0, 0, 0, 1]);
		expect(next7[0].date).toBe(localDate(new Date()));
	});

	it('leaves out cards marked as already known', () => {
		const dbs = makeTestDbs();
		addCard(dbs, { type: 'word', id: 1, due: dueInDays(0) });
		addCard(dbs, { type: 'word', id: 2, due: dueInDays(0), known: 1 });
		expect(summary(dbs, 1).next7[0].n).toBe(1);
	});

	it('is all zeros for a user with no cards', () => {
		expect(summary(makeTestDbs(), 1).next7.map((d) => d.n)).toEqual([0, 0, 0, 0, 0, 0, 0]);
	});
});

describe('summary counts and labels', () => {
	it('separates learning, known and mature cards', () => {
		const dbs = makeTestDbs();
		addCard(dbs, { type: 'word', id: 1, due: dueInDays(1), scheduled: 3 });
		addCard(dbs, { type: 'word', id: 2, due: dueInDays(40), scheduled: 40 });
		addCard(dbs, { type: 'pattern', id: 1, due: dueInDays(0), known: 1, scheduled: 0 });

		const s = summary(dbs, 1);
		expect(s.learning).toBe(2);
		expect(s.mature).toBe(1); // scheduled_days >= 21
		expect(s.known).toBe(1);
	});

	it('labels known cards and saved sentences from the content database', () => {
		const dbs = makeTestDbs();
		addCard(dbs, { type: 'word', id: 1, due: dueInDays(0), known: 1 });
		addCard(dbs, { type: 'pattern', id: 2, due: dueInDays(0), known: 1 });
		dbs.progress.prepare('insert into user_sentences(user_id, pattern_id, text) values(1, 3, ?)').run('I will circle back tomorrow.');

		const s = summary(dbs, 1);
		expect(new Set(s.knownList.map((k) => k.label))).toEqual(
			new Set(['leverage', 'Just so we are on the same page'])
		);
		expect(s.sentences).toEqual([
			{ id: 1, text: 'I will circle back tomorrow.', pattern: "I'll circle back" }
		]);
	});

	it('falls back to "?" when a card no longer exists in the content database', () => {
		const dbs = makeTestDbs();
		addCard(dbs, { type: 'word', id: 9999, due: dueInDays(0), known: 1 });
		expect(summary(dbs, 1).knownList[0].label).toBe('?');
	});
});
