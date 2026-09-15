import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { blankWord, isTypingMode, normalizeAnswer, patternCard, wordCard } from '../src/lib/server/cards';
import { makeTestDbs } from './helpers';
import { dayPatterns, dayWords } from '../src/lib/server/content';
import type { StateRow } from '../src/lib/server/fsrs';

const review = (over: Partial<StateRow>): StateRow => ({
	user_id: 1, card_type: 'word', card_id: 1, known: 0, state: State.Review, due: '2026-09-10T00:00:00Z',
	stability: 30, difficulty: 5, elapsed_days: 0, scheduled_days: 20, learning_steps: 0, reps: 5, lapses: 0, last_review: null, ...over
});

describe('cards', () => {
	it('blankWord replaces the inflected token and returns it as answer', () => {
		expect(blankWord('She leveraged her skills.', 'leverage')).toEqual({ sentence: 'She ___ her skills.', answer: 'leveraged' });
		expect(blankWord('Nothing here.', 'leverage')).toBeNull();
	});

	it('blankWord picks the best-matching token, not just the first candidate', () => {
		expect(blankWord('Her workers value hard work.', 'work')).toEqual({ sentence: 'Her workers value hard ___.', answer: 'work' });
		expect(blankWord('The lever and the leverage differ.', 'leverage')).toEqual({ sentence: 'The lever and the ___ differ.', answer: 'leverage' });
	});

	it('normalizeAnswer ignores case, punctuation and spacing', () => {
		expect(normalizeAnswer("  I'll  Circle back! ")).toBe(normalizeAnswer("i'll circle back"));
	});

	it('typing mode only for Review cards scheduled 14+ days', () => {
		expect(isTypingMode(null)).toBe(false);
		expect(isTypingMode(review({ scheduled_days: 13 }))).toBe(false);
		expect(isTypingMode(review({ scheduled_days: 14 }))).toBe(true);
		expect(isTypingMode(review({ state: State.Learning, scheduled_days: 20 }))).toBe(false);
	});

	it('new word card is en->ko flip with tts', () => {
		const w = dayWords(makeTestDbs(), 1)[0];
		const c = wordCard(w, null);
		expect(c).toMatchObject({ type: 'word', id: 1, isNew: true, mode: 'flip', reverse: false, front: 'leverage', tts: 'leverage' });
		expect(c.back.lines[0].en).toContain('leverage');
	});

	it('word with reps>=2 reverses half the time', () => {
		const w = dayWords(makeTestDbs(), 1)[0];
		const s = review({ reps: 2, scheduled_days: 3 });
		expect(wordCard(w, s, () => 0.1).reverse).toBe(true);
		expect(wordCard(w, s, () => 0.9).reverse).toBe(false);
		expect(wordCard(w, s, () => 0.1).front).toBe('활용하다');
	});

	it('typing word card blanks example_work', () => {
		const w = dayWords(makeTestDbs(), 1)[0];
		const c = wordCard(w, review({ scheduled_days: 20 }));
		expect(c.mode).toBe('type');
		expect(c.typing).toEqual({ sentence: 'We can ___ our data to win.', answer: 'leverage' });
	});

	it('pattern card is ko->en and uses cloze for typing', () => {
		const p = dayPatterns(makeTestDbs(), 1)[0];
		const flip = patternCard(p, null, null);
		expect(flip.front).toBe(p.meaning_ko);
		expect(flip.back.title).toBe(p.pattern);
		const typed = patternCard(p, review({ card_type: 'pattern', scheduled_days: 30 }), '내 문장');
		expect(typed.typing).toEqual({ sentence: p.cloze_sentence, answer: p.cloze_answer });
		expect(typed.mySentence).toBe('내 문장');
	});
});
