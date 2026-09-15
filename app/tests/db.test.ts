import { describe, expect, it } from 'vitest';
import { makeTestDbs } from './helpers';

describe('db', () => {
	it('opens both dbs and applies progress schema', () => {
		const { content, progress } = makeTestDbs();
		const tables = progress.prepare("select name from sqlite_master where type='table'").all().map((r: any) => r.name);
		expect(tables).toEqual(expect.arrayContaining(['users', 'card_states', 'day_progress', 'user_sentences']));
		expect(content.prepare('select count(*) as n from words').get()).toEqual({ n: 3 });
		expect(progress.prepare('select current_day from users where id=1').get()).toEqual({ current_day: 1 });
	});
});
