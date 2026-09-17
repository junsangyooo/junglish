import { afterEach, describe, expect, it } from 'vitest';
import { makeTestDbs } from './helpers';
import { checkInviteCode, createSession, createUser, getUserBySession, login, signupOpen } from '../src/lib/server/auth';

afterEach(() => {
	delete process.env.SIGNUP_INVITE_CODE;
});

describe('signup gate', () => {
	it('is closed until an invite code is configured', () => {
		expect(signupOpen()).toBe(false);
		expect(checkInviteCode('')).toBe(false);
		expect(checkInviteCode('anything')).toBe(false);
	});

	it('accepts only the configured code', () => {
		process.env.SIGNUP_INVITE_CODE = 'jungle-2026';
		expect(signupOpen()).toBe(true);
		expect(checkInviteCode('jungle-2026')).toBe(true);
		expect(checkInviteCode('jungle-2027')).toBe(false);
		expect(checkInviteCode('jungle-2026 ')).toBe(false);
		expect(checkInviteCode('')).toBe(false);
	});
});

describe('createUser', () => {
	it('creates an account that can log in, starting at Day 1', () => {
		const dbs = makeTestDbs();
		const id = createUser(dbs, 'sujin', 'correct horse battery');
		expect(id).toBeGreaterThan(0);

		const row = dbs.progress.prepare('select name, current_day, review_limit from users where id=?').get(id);
		expect(row).toEqual({ name: 'sujin', current_day: 1, review_limit: 100 });

		expect(login(dbs, 'sujin', 'wrong password')).toBeNull();
		const sid = login(dbs, 'sujin', 'correct horse battery');
		expect(sid).not.toBeNull();
		expect(getUserBySession(dbs, sid!)?.name).toBe('sujin');
	});

	it('refuses a name that is taken, without disturbing the existing account', () => {
		const dbs = makeTestDbs();
		createUser(dbs, 'sujin', 'first password');
		expect(createUser(dbs, 'sujin', 'second password')).toBeNull();
		expect(login(dbs, 'sujin', 'first password')).not.toBeNull();
		expect(login(dbs, 'sujin', 'second password')).toBeNull();
	});

	it('gives each account its own session', () => {
		const dbs = makeTestDbs();
		const a = createUser(dbs, 'a', 'password-a')!;
		const b = createUser(dbs, 'b', 'password-b')!;
		expect(getUserBySession(dbs, createSession(dbs, a))?.id).toBe(a);
		expect(getUserBySession(dbs, createSession(dbs, b))?.id).toBe(b);
	});
});
