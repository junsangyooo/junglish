import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Dbs } from './db';

export type User = { id: number; name: string; current_day: number; review_limit: number };

export const SESSION_DAYS = 30;

export function hashPassword(pw: string): string {
	const salt = randomBytes(16).toString('hex');
	return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const a = scryptSync(pw, salt, 64);
	const b = Buffer.from(hash, 'hex');
	return a.length === b.length && timingSafeEqual(a, b);
}

export function createSession(dbs: Dbs, userId: number): string {
	const sid = randomBytes(32).toString('hex');
	const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
	dbs.progress.prepare('insert into sessions(id,user_id,expires_at) values(?,?,?)').run(sid, userId, expires);
	return sid;
}

export function login(dbs: Dbs, name: string, pw: string): string | null {
	const row = dbs.progress.prepare('select id, password_hash from users where name=?').get(name) as
		| { id: number; password_hash: string } | undefined;
	if (!row || !verifyPassword(pw, row.password_hash)) return null;
	return createSession(dbs, row.id);
}

/** Returns the new user's id, or null when the name is taken. */
export function createUser(dbs: Dbs, name: string, pw: string): number | null {
	try {
		const r = dbs.progress.prepare('insert into users(name, password_hash) values(?,?)').run(name, hashPassword(pw));
		return Number(r.lastInsertRowid);
	} catch (e) {
		if (e instanceof Error && e.message.includes('UNIQUE')) return null;
		throw e;
	}
}

/** Signup is closed unless an invite code is configured; the code itself never leaves the server. */
export function signupOpen(): boolean {
	return !!process.env.SIGNUP_INVITE_CODE;
}

export function checkInviteCode(code: string): boolean {
	const expected = process.env.SIGNUP_INVITE_CODE ?? '';
	if (!expected) return false;
	const a = Buffer.from(code);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

export function getUserBySession(dbs: Dbs, sid: string): User | null {
	const row = dbs.progress
		.prepare(`select u.id, u.name, u.current_day, u.review_limit from sessions s join users u on u.id=s.user_id
		          where s.id=? and s.expires_at > ?`)
		.get(sid, new Date().toISOString()) as User | undefined;
	return row ?? null;
}

export function deleteSession(dbs: Dbs, sid: string) {
	dbs.progress.prepare('delete from sessions where id=?').run(sid);
}

export function checkLoginRate(dbs: Dbs, ip: string, now = new Date()): boolean {
	const since = new Date(now.getTime() - 10 * 60_000).toISOString();
	const { n } = dbs.progress
		.prepare('select count(*) as n from login_attempts where ip=? and attempted_at > ?')
		.get(ip, since) as { n: number };
	dbs.progress.prepare('insert into login_attempts(ip,attempted_at) values(?,?)').run(ip, now.toISOString());
	dbs.progress.prepare('delete from login_attempts where attempted_at <= ?').run(since);
	return n < 5;
}
