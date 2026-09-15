// app/src/lib/server/queue.ts
import type { User } from './auth';
import { patternCard, wordCard, type CardVM } from './cards';
import { dayPatterns, patternById, wordById, type PatternRow } from './content';
import type { Dbs } from './db';
import { dueCards } from './fsrs';
import { newPatternIds, newWordIds } from './mission';

export function latestSentence(dbs: Dbs, userId: number, patternId: number): string | null {
	const r = dbs.progress.prepare('select text from user_sentences where user_id=? and pattern_id=? order by id desc limit 1').get(userId, patternId) as { text: string } | undefined;
	return r?.text ?? null;
}

export function reviewQueue(dbs: Dbs, user: User, { horizonMinutes = 0 } = {}): CardVM[] {
	const out: CardVM[] = [];
	for (const s of dueCards(dbs, user.id, new Date(), { horizonMinutes, limit: user.review_limit })) {
		if (s.card_type === 'word') {
			const w = wordById(dbs, s.card_id);
			if (w) out.push(wordCard(w, s));
		} else {
			const p = patternById(dbs, s.card_id);
			if (p) out.push(patternCard(p, s, latestSentence(dbs, user.id, p.id)));
		}
	}
	return out;
}

export function newWordQueue(dbs: Dbs, user: User, day: number): CardVM[] {
	return newWordIds(dbs, user.id, day).map((id) => wordCard(wordById(dbs, id)!, null));
}

export function newPatternQueue(dbs: Dbs, user: User, day: number): CardVM[] {
	return newPatternIds(dbs, user.id, day).map((id) => patternCard(patternById(dbs, id)!, null, null));
}

export function writeSuggestions(dbs: Dbs, user: User, day: number): { pattern: PatternRow; existing: string | null }[] {
	const all = dayPatterns(dbs, day);
	const seenCat = new Set<string>();
	const picked: PatternRow[] = [];
	for (const p of all) {
		if (picked.length === 3) break;
		if (seenCat.has(p.category)) continue;
		seenCat.add(p.category);
		picked.push(p);
	}
	for (const p of all) if (picked.length < 3 && !picked.some((x) => x.id === p.id)) picked.push(p);
	return picked.map((pattern) => ({ pattern, existing: latestSentence(dbs, user.id, pattern.id) }));
}
