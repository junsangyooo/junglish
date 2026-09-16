import { describe, expect, it } from 'vitest';
import { buildQuiz, maskLine, maskedTexts, readablePattern } from '../src/lib/quiz';

const QUIZ = [
	{ id: 1, line_index: 0, blank_text: 'I was wondering if you could' },
	{ id: 2, line_index: 2, blank_text: 'this brings me to' }
];

describe('maskLine', () => {
	it('blanks the phrase even when the line capitalizes it', () => {
		expect(maskLine('Okay, This brings me to my real question.', 'this brings me to')).toBe('Okay, _____ my real question.');
	});
	it('leaves the line alone when the phrase is absent', () => {
		expect(maskLine('Nothing to see here.', 'circle back')).toBe('Nothing to see here.');
	});
	it('treats regex characters in the phrase literally', () => {
		expect(maskLine('Can I get back to you on (that)?', '(that)')).toBe('Can I get back to you on _____?');
	});
});

describe('readablePattern', () => {
	it('replaces placeholders and tidies spacing before punctuation', () => {
		expect(readablePattern('Can I get back to you on ~?')).toBe('Can I get back to you on…?');
		expect(readablePattern('I was wondering if you could ~.')).toBe('I was wondering if you could….');
	});
});

describe('buildQuiz', () => {
	const rnd = () => 0.42;

	it('gives every question 4 distinct options including the answer', () => {
		const qs = buildQuiz(QUIZ, ['I will circle back ~', "I'm in charge of ~", 'Just so we are on the same page']);
		for (const q of qs) {
			expect(q.options).toHaveLength(4);
			expect(q.options).toContain(q.answer);
			expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
			expect(q.options.join(' ')).not.toContain('~');
		}
	});

	it('falls back to fewer options when there are not enough distinct distractors', () => {
		const qs = buildQuiz([QUIZ[0]], [], rnd);
		expect(qs[0].options).toEqual(['I was wondering if you could']);
	});

	it('keeps one question per quiz item, in order', () => {
		const qs = buildQuiz(QUIZ, ['a total of ~'], rnd);
		expect(qs.map((q) => q.id)).toEqual([1, 2]);
		expect(qs.map((q) => q.line_index)).toEqual([0, 2]);
	});
});

describe('maskedTexts', () => {
	const lines = [
		{ text: 'Hi, I was wondering if you could help.' },
		{ text: 'Sure.' },
		{ text: 'Great — This brings me to the demo.' }
	];

	it('blanks unsolved questions and restores solved ones', () => {
		const qs = buildQuiz(QUIZ, ['a total of ~']);
		expect(maskedTexts(lines, qs, new Set())).toEqual([
			'Hi, _____ help.',
			'Sure.',
			'Great — _____ the demo.'
		]);
		expect(maskedTexts(lines, qs, new Set([1, 2]))).toEqual(lines.map((l) => l.text));
	});
});
