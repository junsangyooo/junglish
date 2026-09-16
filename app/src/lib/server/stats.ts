import type { Dbs } from './db';
import { activityGrid, localDate, seoulDayRange, streak } from './mission';

type KnownRow = { type: 'word' | 'pattern'; id: number };

/** One lookup for a whole page of cards instead of one per row. */
function labels(dbs: Dbs, table: 'words' | 'patterns', column: 'word' | 'pattern', ids: number[]): Map<number, string> {
	const clean = [...new Set(ids.filter(Number.isInteger))];
	if (clean.length === 0) return new Map();
	const rows = dbs.content.prepare(`select id, ${column} as label from ${table} where id in (${clean.join(',')})`)
		.all() as { id: number; label: string }[];
	return new Map(rows.map((r) => [r.id, r.label]));
}

export function summary(dbs: Dbs, userId: number) {
	const p = dbs.progress;
	const count = (sql: string) => (p.prepare(sql).get(userId) as { n: number }).n;

	// Cards falling due over the next 7 Seoul days: one indexed range scan, counted per day boundary.
	const days = Array.from({ length: 7 }, (_, i) => localDate(new Date(Date.now() + i * 86_400_000)));
	const bounds = days.map((d) => seoulDayRange(d).end);
	const totals = p.prepare(
		`select ${bounds.map((_, i) => `sum(due <= @b${i}) as d${i}`).join(', ')}
		 from card_states where user_id=@user and known=0 and due <= @last`
	).get({ user: userId, last: bounds[6], ...Object.fromEntries(bounds.map((b, i) => [`b${i}`, b])) }) as Record<string, number | null>;
	const cumulative = bounds.map((_, i) => totals[`d${i}`] ?? 0);
	const next7 = days.map((date, i) => ({ date, n: i === 0 ? cumulative[0] : cumulative[i] - cumulative[i - 1] }));

	const knownRows = p.prepare('select card_type as type, card_id as id from card_states where user_id=? and known=1 order by due desc limit 200')
		.all(userId) as KnownRow[];
	const knownWords = labels(dbs, 'words', 'word', knownRows.filter((r) => r.type === 'word').map((r) => r.id));
	const knownPatterns = labels(dbs, 'patterns', 'pattern', knownRows.filter((r) => r.type === 'pattern').map((r) => r.id));
	const knownList = knownRows.map((r) => ({
		...r, label: (r.type === 'word' ? knownWords : knownPatterns).get(r.id) ?? '?'
	}));

	const sentenceRows = p.prepare('select id, pattern_id, text from user_sentences where user_id=? order by id desc limit 100')
		.all(userId) as { id: number; pattern_id: number; text: string }[];
	const sentencePatterns = labels(dbs, 'patterns', 'pattern', sentenceRows.map((s) => s.pattern_id));
	const sentences = sentenceRows.map((s) => ({ id: s.id, text: s.text, pattern: sentencePatterns.get(s.pattern_id) ?? '?' }));

	return {
		streak: streak(dbs, userId),
		learning: count('select count(*) as n from card_states where user_id=? and known=0'),
		known: count('select count(*) as n from card_states where user_id=? and known=1'),
		mature: count('select count(*) as n from card_states where user_id=? and known=0 and scheduled_days >= 21'),
		reviews: count('select count(*) as n from review_logs where user_id=?'),
		grid: activityGrid(dbs, userId),
		next7, knownList, sentences
	};
}
