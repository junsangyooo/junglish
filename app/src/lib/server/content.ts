import type { Dbs } from './db';

export type WordRow = { id: number; day: number; seq: number; word: string; pos: string; ipa: string; meaning_ko: string;
	example_work: string; example_work_ko: string; example_daily: string; example_daily_ko: string; collocations: string[] };
export type PatternRow = { id: number; day: number; seq: number; pattern: string; meaning_ko: string; category: string;
	grammar_note_ko: string | null; register: string; example_1: string; example_1_ko: string; example_2: string; example_2_ko: string;
	cloze_sentence: string; cloze_answer: string };
export type DialogueLine = { speaker: string; text: string; text_ko: string };
export type QuizItem = { id: number; line_index: number; blank_text: string; answer: string; pattern_id: number };
export type Dialogue = { id: number; day: number; title_ko: string; situation_ko: string; lines: DialogueLine[]; quiz: QuizItem[] };

function parseWord(r: any): WordRow {
	return { ...r, collocations: JSON.parse(r.collocations ?? '[]') };
}

export function dayWords(dbs: Dbs, day: number): WordRow[] {
	return dbs.content.prepare('select * from words where day=? order by seq').all(day).map(parseWord);
}

export function dayPatterns(dbs: Dbs, day: number): PatternRow[] {
	return dbs.content.prepare('select * from patterns where day=? order by seq').all(day) as PatternRow[];
}

export function dayDialogue(dbs: Dbs, day: number): Dialogue | null {
	const d = dbs.content.prepare('select * from dialogues where day=?').get(day) as any;
	if (!d) return null;
	const quiz = dbs.content.prepare('select * from quiz_items where dialogue_id=? order by line_index').all(d.id) as QuizItem[];
	return { ...d, lines: JSON.parse(d.lines), quiz };
}

export function wordById(dbs: Dbs, id: number): WordRow | null {
	const r = dbs.content.prepare('select * from words where id=?').get(id);
	return r ? parseWord(r) : null;
}

export function patternById(dbs: Dbs, id: number): PatternRow | null {
	return (dbs.content.prepare('select * from patterns where id=?').get(id) as PatternRow) ?? null;
}

export function maxDay(dbs: Dbs): number {
	return (dbs.content.prepare('select max(day) as d from words').get() as { d: number | null }).d ?? 0;
}
