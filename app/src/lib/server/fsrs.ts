import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { Dbs } from './db';

export type CardType = 'word' | 'pattern';
export type StateRow = { user_id: number; card_type: CardType; card_id: number; known: number; state: number; due: string;
	stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; learning_steps: number;
	reps: number; lapses: number; last_review: string | null };

// 10m single learning step: Again -> +10m, Good on a new card -> Review (~2 days). Verified against ts-fsrs 5.4.2.
const f = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true, learning_steps: ['10m'], relearning_steps: ['10m'] }));
const GRADES: Record<1 | 2 | 3, Grade> = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good };

function toCard(r: StateRow): Card {
	return {
		due: new Date(r.due), stability: r.stability, difficulty: r.difficulty, elapsed_days: r.elapsed_days,
		scheduled_days: r.scheduled_days, learning_steps: r.learning_steps, reps: r.reps, lapses: r.lapses,
		state: r.state, last_review: r.last_review ? new Date(r.last_review) : undefined
	};
}

export function getState(dbs: Dbs, userId: number, type: CardType, id: number): StateRow | null {
	return (dbs.progress.prepare('select * from card_states where user_id=? and card_type=? and card_id=?')
		.get(userId, type, id) as StateRow) ?? null;
}

const UPSERT = `insert into card_states(user_id,card_type,card_id,known,state,due,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,last_review)
  values(@user_id,@card_type,@card_id,@known,@state,@due,@stability,@difficulty,@elapsed_days,@scheduled_days,@learning_steps,@reps,@lapses,@last_review)
  on conflict(user_id,card_type,card_id) do update set known=excluded.known,state=excluded.state,due=excluded.due,stability=excluded.stability,
  difficulty=excluded.difficulty,elapsed_days=excluded.elapsed_days,scheduled_days=excluded.scheduled_days,learning_steps=excluded.learning_steps,
  reps=excluded.reps,lapses=excluded.lapses,last_review=excluded.last_review`;

function rowFromCard(userId: number, type: CardType, id: number, c: Card, known = 0): StateRow {
	return {
		user_id: userId, card_type: type, card_id: id, known, state: c.state, due: c.due.toISOString(),
		stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days, scheduled_days: c.scheduled_days,
		learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses, last_review: c.last_review?.toISOString() ?? null
	};
}

export function rate(dbs: Dbs, userId: number, type: CardType, id: number, rating: 1 | 2 | 3, now = new Date()): StateRow {
	const existing = getState(dbs, userId, type, id);
	if (existing?.known) return existing;
	const card = existing ? toCard(existing) : createEmptyCard(now);
	const { card: next, log } = f.next(card, now, GRADES[rating]);
	const row = rowFromCard(userId, type, id, next);
	const tx = dbs.progress.transaction(() => {
		dbs.progress.prepare(UPSERT).run(row);
		dbs.progress.prepare(`insert into review_logs(user_id,card_type,card_id,rating,state,due,stability,difficulty,elapsed_days,last_elapsed_days,scheduled_days,learning_steps,review)
			values(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId, type, id, log.rating, log.state, log.due.toISOString(), log.stability, log.difficulty,
			log.elapsed_days, log.last_elapsed_days, log.scheduled_days, log.learning_steps, log.review.toISOString());
	});
	tx();
	return row;
}

export function markKnown(dbs: Dbs, userId: number, type: CardType, id: number): void {
	const c = createEmptyCard(new Date());
	dbs.progress.prepare(UPSERT).run(rowFromCard(userId, type, id, c, 1));
}

export function unmarkKnown(dbs: Dbs, userId: number, type: CardType, id: number): void {
	dbs.progress.prepare('delete from card_states where user_id=? and card_type=? and card_id=? and known=1').run(userId, type, id);
}

export function dueCards(dbs: Dbs, userId: number, now = new Date(),
	{ horizonMinutes = 0, limit = 100 }: { horizonMinutes?: number; limit?: number } = {}): StateRow[] {
	const until = new Date(now.getTime() + horizonMinutes * 60_000).toISOString();
	return dbs.progress.prepare('select * from card_states where user_id=? and known=0 and due<=? order by due limit ?')
		.all(userId, until, limit) as StateRow[];
}

export function dueCount(dbs: Dbs, userId: number, now = new Date()): number {
	return (dbs.progress.prepare('select count(*) as n from card_states where user_id=? and known=0 and due<=?')
		.get(userId, now.toISOString()) as { n: number }).n;
}
