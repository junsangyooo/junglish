import { describe, expect, it } from 'vitest';
import { checkLoginRate, getUserBySession, hashPassword, login, verifyPassword } from '../src/lib/server/auth';
import { makeTestDbs } from './helpers';

describe('auth', () => {
	it('hashes and verifies passwords', () => {
		const h = hashPassword('secret');
		expect(h).not.toContain('secret');
		expect(verifyPassword('secret', h)).toBe(true);
		expect(verifyPassword('wrong', h)).toBe(false);
	});

	it('login creates a session resolvable to the user', () => {
		const dbs = makeTestDbs();
		dbs.progress.prepare('update users set password_hash=? where id=1').run(hashPassword('pw'));
		expect(login(dbs, 'test', 'bad')).toBeNull();
		const sid = login(dbs, 'test', 'pw');
		expect(sid).toBeTruthy();
		expect(getUserBySession(dbs, sid!)?.name).toBe('test');
		expect(getUserBySession(dbs, 'nope')).toBeNull();
	});

	it('rate limits after 5 attempts in 10 minutes', () => {
		const dbs = makeTestDbs();
		const now = new Date('2026-09-10T10:00:00+09:00');
		for (let i = 0; i < 5; i++) expect(checkLoginRate(dbs, '1.1.1.1', now)).toBe(true);
		expect(checkLoginRate(dbs, '1.1.1.1', now)).toBe(false);
		expect(checkLoginRate(dbs, '1.1.1.1', new Date(now.getTime() + 11 * 60_000))).toBe(true);
	});
});
