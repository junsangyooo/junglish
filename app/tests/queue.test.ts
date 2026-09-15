import { describe, expect, it } from 'vitest';
import { writeSuggestions } from '../src/lib/server/queue';
import { makeTestDbs } from './helpers';

describe('writeSuggestions', () => {
	it('returns 3 suggestions with distinct pattern ids', () => {
		const dbs = makeTestDbs();
		const user = { id: 1, name: 'test', current_day: 1, review_limit: 100 };
		const out = writeSuggestions(dbs, user, 1);
		expect(out).toHaveLength(3);
		expect(new Set(out.map((s) => s.pattern.id)).size).toBe(3);
	});
});
