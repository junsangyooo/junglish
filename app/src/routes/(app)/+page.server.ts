// app/src/routes/(app)/+page.server.ts
import type { PageServerLoad } from './$types';
import { getDbs } from '$lib/server/db';
import { contentTotals, hasDay } from '$lib/server/content';
import { signupOpen } from '$lib/server/auth';
import { dueCount } from '$lib/server/fsrs';
import { dayFinishedToday, dayOverview, getProgress, STEPS, streak, weekActivity } from '$lib/server/mission';

export const load: PageServerLoad = ({ locals }) => {
	const dbs = getDbs();

	if (!locals.user) {
		return { landing: true as const, signupOpen: signupOpen(), totals: contentTotals(dbs) };
	}

	const user = locals.user;
	const day = user.current_day;
	const { step } = getProgress(dbs, user.id, day);
	return {
		landing: false as const,
		day, step, stepIndex: STEPS.indexOf(step), totalSteps: STEPS.length - 1,
		due: dueCount(dbs, user.id), streak: streak(dbs, user.id), hasContent: hasDay(dbs, day),
		overview: dayOverview(dbs, user, day, step),
		week: weekActivity(dbs, user.id),
		finishedToday: dayFinishedToday(dbs, user.id)
	};
};
