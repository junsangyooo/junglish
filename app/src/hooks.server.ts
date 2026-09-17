import type { Handle } from '@sveltejs/kit';
import { getUserBySession } from '$lib/server/auth';
import { getDbs } from '$lib/server/db';
import { startReminderScheduler } from '$lib/server/push';

// One process, one timer: reminders ride along with the app instead of a cron job.
startReminderScheduler(getDbs());

export const handle: Handle = async ({ event, resolve }) => {
	const sid = event.cookies.get('sid');
	event.locals.user = sid ? (getUserBySession(getDbs(), sid) ?? undefined) : undefined;
	return resolve(event);
};
