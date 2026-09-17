// app/src/lib/server/push.ts — daily reminder, sent by this process rather than a cron job.
import webpush from 'web-push';
import type { Dbs } from './db';
import { dayFinishedToday, localDate } from './mission';

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };
export type Reminder = { id: number; name: string; url: string };

/** A tick can drift past the target minute; look back this far so a day is never skipped. */
export const CATCH_UP_MINUTES = 120;

const clockFmt = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false
});

export const seoulClock = (now: Date): string => clockFmt.format(now);

const toMinutes = (clock: string): number => {
	const [h, m] = clock.split(':').map(Number);
	return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
};

export function pushConfigured(): boolean {
	return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicKey(): string {
	return process.env.VAPID_PUBLIC_KEY ?? '';
}

function configure(): void {
	// '||' not '??': compose passes an empty string when the variable is unset, and
	// web-push throws on an empty subject.
	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
		process.env.VAPID_PUBLIC_KEY!,
		process.env.VAPID_PRIVATE_KEY!
	);
}

export function saveSubscription(dbs: Dbs, userId: number, sub: PushSubscriptionInput): void {
	dbs.progress.prepare(
		`insert into push_subscriptions(endpoint, user_id, p256dh, auth) values(?,?,?,?)
		 on conflict(endpoint) do update set user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth`
	).run(sub.endpoint, userId, sub.keys.p256dh, sub.keys.auth);
}

/** Scoped by user: an endpoint is not a capability to delete someone else's subscription. */
export function deleteSubscription(dbs: Dbs, userId: number, endpoint: string): void {
	dbs.progress.prepare('delete from push_subscriptions where endpoint=? and user_id=?').run(endpoint, userId);
}

function dropDeadEndpoint(dbs: Dbs, endpoint: string): void {
	dbs.progress.prepare('delete from push_subscriptions where endpoint=?').run(endpoint);
}

export function subscriptionCount(dbs: Dbs, userId: number): number {
	return (dbs.progress.prepare('select count(*) as n from push_subscriptions where user_id=?')
		.get(userId) as { n: number }).n;
}

/**
 * Who should hear from us on this tick: reminder on, their time has come (within the
 * catch-up window), they have not finished today, and we have not already sent today.
 * The last check is what keeps a one-minute timer from sending sixty times.
 */
export function dueReminders(dbs: Dbs, now = new Date()): Reminder[] {
	const nowMinutes = toMinutes(seoulClock(now));
	const rows = dbs.progress.prepare(
		`select id, name, current_day, notify_at from users
		 where notify_enabled=1 and (notify_last_sent is null or notify_last_sent <> ?)`
	).all(localDate(now)) as { id: number; name: string; current_day: number; notify_at: string }[];

	return rows
		.filter((u) => {
			const target = toMinutes(u.notify_at);
			return target >= 0 && target <= nowMinutes && nowMinutes - target <= CATCH_UP_MINUTES;
		})
		.filter((u) => dayFinishedToday(dbs, u.id, now) === null)
		.map((u) => {
			const row = dbs.progress.prepare('select step from day_progress where user_id=? and day=?')
				.get(u.id, u.current_day) as { step: string } | undefined;
			return { id: u.id, name: u.name, url: row && row.step !== 'done' ? `/mission/${row.step}` : '/' };
		});
}

export function markReminderSent(dbs: Dbs, userId: number, now = new Date()): void {
	dbs.progress.prepare('update users set notify_last_sent=? where id=?').run(localDate(now), userId);
}

/** Sends to every device the user registered; drops the ones the push service has retired. */
export async function sendReminder(dbs: Dbs, reminder: Reminder): Promise<number> {
	if (!pushConfigured()) return 0;
	configure();
	const subs = dbs.progress.prepare('select endpoint, p256dh, auth from push_subscriptions where user_id=?')
		.all(reminder.id) as { endpoint: string; p256dh: string; auth: string }[];

	const payload = JSON.stringify({
		title: '오늘 미션이 남아 있어요',
		body: '20분이면 오늘 몫을 끝낼 수 있습니다.',
		url: reminder.url
	});

	let sent = 0;
	for (const s of subs) {
		try {
			await webpush.sendNotification(
				{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
				payload
			);
			sent++;
		} catch (e) {
			const status = (e as { statusCode?: number }).statusCode;
			if (status === 404 || status === 410) dropDeadEndpoint(dbs, s.endpoint);
		}
	}
	return sent;
}

export async function runReminderTick(dbs: Dbs, now = new Date()): Promise<number> {
	let sent = 0;
	for (const reminder of dueReminders(dbs, now)) {
		// One user's failure must not stop the others, and must not repeat every minute.
		try {
			sent += await sendReminder(dbs, reminder);
		} catch (e) {
			console.error('reminder failed', reminder.name, e);
		}
		markReminderSent(dbs, reminder.id, now);
	}
	return sent;
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startReminderScheduler(dbs: Dbs): void {
	if (timer || !pushConfigured()) return;
	timer = setInterval(() => {
		runReminderTick(dbs).catch((e) => console.error('reminder tick failed', e));
	}, 60_000);
	timer.unref?.();
}
