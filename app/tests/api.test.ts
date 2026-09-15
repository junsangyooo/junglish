import { describe, expect, it } from 'vitest';
import { isCardType, isInt, isRating } from '../src/lib/server/api';

describe('api guards', () => {
	it('isCardType accepts only word/pattern', () => {
		expect(isCardType('word')).toBe(true);
		expect(isCardType('pattern')).toBe(true);
		expect(isCardType('x')).toBe(false);
	});

	it('isRating accepts only 1|2|3', () => {
		expect(isRating(1)).toBe(true);
		expect(isRating(3)).toBe(true);
		expect(isRating(7)).toBe(false);
	});

	it('isInt accepts only integers', () => {
		expect(isInt(1)).toBe(true);
		expect(isInt(1.5)).toBe(false);
		expect(isInt('1')).toBe(false);
	});
});
