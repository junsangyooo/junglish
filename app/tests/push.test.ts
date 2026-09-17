import { describe, expect, it } from 'vitest';
import { makeTestDbs } from './helpers';
import type { Dbs } from '../src/lib/server/db';
import { completeDay, getProgress } from '../src/lib/server/mission';
import { dueReminders, markReminderSent, saveSubscription, seoulClock, subscriptionCount } from '../src/lib/server/push';

const now = new Date('2026-09-17T21:00:00+09:00'); // 21:00 KST

function setNotify(dbs: Dbs, o: { enabled?: 0 | 1; at?: string; lastSent?: string | null }) {
	dbs.progress.prepare('update users set notify_enabled=?, notify_at=?, notify_last_sent=? where id=1')
		.run(o.enabled ?? 1, o.at ?? '21:00', o.lastSent ?? null);
}

describe('seoulClock', () => {
	it('formats the wall clock in Seoul', () => {
		expect(seoulClock(now)).toBe('21:00');
		expect(seoulClock(new Date('2026-09-17T09:05:00+09:00'))).toBe('09:05');
	});
});

describe('dueReminders', () => {
	it('picks a user whose time has come and who has not finished today', () => {
		const dbs = makeTestDbs();
		setNotify(dbs, {});
		getProgress(dbs, 1, 1); // day row exists, still on the first step
		const due = dueReminders(dbs, now);
		expect(due.map((r) => r.name)).toEqual(['test']);
		expect(due[0].url).toBe('/mission/review');
	});

	it('skips a user whose reminder is off', () => {
		const dbs = makeTestDbs();
		setNotify(dbs, { enabled: 0 });
		expect(dueReminders(dbs, now)).toEqual([]);
	});

	it('skips a different minute', () => {
		const dbs = makeTestDbs();
		setNotify(dbs, { at: '07:30' });
		expect(dueReminders(dbs, now)).toEqual([]);
	});

	it('skips a user who already finished today', () => {
		const dbs = makeTestDbs();
		setNotify(dbs, {});
		completeDay(dbs, 1, 1, now);
		expect(dueReminders(dbs, now)).toEqual([]);
	});

	it('sends once a day even though the timer ticks every minute', () => {
		const dbs = makeTestDbs();
		setNotify(dbs, {});
		getProgress(dbs, 1, 1);
		expect(dueReminders(dbs, now)).toHaveLength(1);
		markReminderSent(dbs, 1, now);
		expect(dueReminders(dbs, now)).toEqual([]);
		// The next day it comes back.
		const tomorrow = new Date('2026-09-18T21:00:00+09:00');
		expect(dueReminders(dbs, tomorrow)).toHaveLength(1);
	});

	it('falls back to the home screen when the day has no progress row yet', () => {
		const dbs = makeTestDbs();
		setNotify(dbs, {});
		expect(dueReminders(dbs, now)[0].url).toBe('/');
	});
});

describe('subscriptions', () => {
	it('keeps one row per endpoint and counts a user devices', () => {
		const dbs = makeTestDbs();
		const sub = { endpoint: 'https://push.example/abc', keys: { p256dh: 'key-1', auth: 'auth-1' } };
		saveSubscription(dbs, 1, sub);
		saveSubscription(dbs, 1, { ...sub, keys: { p256dh: 'key-2', auth: 'auth-2' } });
		expect(subscriptionCount(dbs, 1)).toBe(1);

		saveSubscription(dbs, 1, { endpoint: 'https://push.example/def', keys: { p256dh: 'k', auth: 'a' } });
		expect(subscriptionCount(dbs, 1)).toBe(2);
	});
});
