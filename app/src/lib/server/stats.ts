import type { Dbs } from './db';
import { localDate, streak } from './mission';

export function summary(dbs: Dbs, userId: number) {
	const p = dbs.progress;
	const count = (sql: string) => (p.prepare(sql).get(userId) as { n: number }).n;
	const next7 = [] as { date: string; n: number }[];
	for (let i = 0; i < 7; i++) {
		const date = localDate(new Date(Date.now() + i * 86_400_000));
		const { n } = p.prepare("select count(*) as n from card_states where user_id=? and known=0 and date(due, '+9 hours') <= ?").get(userId, date) as { n: number };
		next7.push({ date, n: i === 0 ? n : n - next7.reduce((a, b) => a + b.n, 0) });
	}
	const knownRows = p.prepare('select card_type as type, card_id as id from card_states where user_id=? and known=1 order by due desc limit 200').all(userId) as { type: 'word' | 'pattern'; id: number }[];
	const knownList = knownRows.map((r) => ({
		...r,
		label: r.type === 'word'
			? (dbs.content.prepare('select word as l from words where id=?').get(r.id) as any)?.l ?? '?'
			: (dbs.content.prepare('select pattern as l from patterns where id=?').get(r.id) as any)?.l ?? '?'
	}));
	const sentences = (p.prepare('select id, pattern_id, text from user_sentences where user_id=? order by id desc limit 100').all(userId) as any[])
		.map((s) => ({ id: s.id, text: s.text, pattern: (dbs.content.prepare('select pattern from patterns where id=?').get(s.pattern_id) as any)?.pattern ?? '?' }));
	return {
		streak: streak(dbs, userId),
		learning: count('select count(*) as n from card_states where user_id=? and known=0'),
		known: count('select count(*) as n from card_states where user_id=? and known=1'),
		next7, knownList, sentences
	};
}
