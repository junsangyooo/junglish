import { State } from 'ts-fsrs';
import type { PatternRow, WordRow } from './content';
import { previewIntervals, type CardType, type StateRow } from './fsrs';

export type CardVM = {
	type: CardType; id: number; isNew: boolean; mode: 'flip' | 'type'; reverse: boolean;
	front: string; frontSub: string;
	back: { title: string; sub: string; lines: { en: string; ko: string }[]; note: string; extra: string };
	typing: { sentence: string; answer: string } | null;
	tts: string;
	mySentence: string | null;
	intervals: Record<1 | 2 | 3, string>;
};

const TYPING_MIN_DAYS = 14;

export function isTypingMode(s: StateRow | null): boolean {
	return !!s && s.state === State.Review && s.scheduled_days >= TYPING_MIN_DAYS;
}

function stem(word: string): string {
	return word.toLowerCase().slice(0, word.length > 4 ? 4 : word.length);
}

function commonPrefixLen(a: string, b: string): number {
	const la = a.toLowerCase();
	const lb = b.toLowerCase();
	let i = 0;
	while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
	return i;
}

export function blankWord(sentence: string, word: string): { sentence: string; answer: string } | null {
	const tokens = sentence.split(' ');
	const st = stem(word);
	let bestIdx = -1;
	let bestCore = '';
	let bestScore = -1;
	for (let i = 0; i < tokens.length; i++) {
		const core = tokens[i].replace(/[^A-Za-z']/g, '');
		if (!core.toLowerCase().startsWith(st)) continue;
		const score = core.toLowerCase() === word.toLowerCase() ? Infinity : commonPrefixLen(core, word);
		if (score > bestScore) {
			bestScore = score;
			bestIdx = i;
			bestCore = core;
		}
	}
	if (bestIdx === -1) return null;
	tokens[bestIdx] = tokens[bestIdx].replace(bestCore, '___');
	return { sentence: tokens.join(' '), answer: bestCore };
}

export function wordCard(w: WordRow, s: StateRow | null, rnd: () => number = Math.random): CardVM {
	const reverse = !!s && s.reps >= 2 && rnd() < 0.5;
	const typing = isTypingMode(s) ? blankWord(w.example_work, w.word) : null;
	return {
		type: 'word', id: w.id, isNew: !s, mode: typing ? 'type' : 'flip', reverse,
		front: reverse ? w.meaning_ko : w.word,
		frontSub: reverse ? `(${w.pos})` : `${w.ipa}  ${w.pos}`,
		back: {
			title: w.word, sub: `${w.ipa}  ${w.pos}  ·  ${w.meaning_ko}`,
			lines: [{ en: w.example_work, ko: w.example_work_ko }, { en: w.example_daily, ko: w.example_daily_ko }],
			note: '', extra: w.collocations.join(' · ')
		},
		typing, tts: w.word, mySentence: null, intervals: previewIntervals(s)
	};
}

export function patternCard(p: PatternRow, s: StateRow | null, mySentence: string | null): CardVM {
	const typing = isTypingMode(s) ? { sentence: p.cloze_sentence, answer: p.cloze_answer } : null;
	return {
		type: 'pattern', id: p.id, isNew: !s, mode: typing ? 'type' : 'flip', reverse: true,
		front: p.meaning_ko, frontSub: `${p.category} · ${p.register}`,
		back: {
			title: p.pattern, sub: p.meaning_ko,
			lines: [{ en: p.example_1, ko: p.example_1_ko }, { en: p.example_2, ko: p.example_2_ko }],
			note: p.grammar_note_ko ?? '', extra: ''
		},
		typing, tts: p.example_1, mySentence, intervals: previewIntervals(s)
	};
}
