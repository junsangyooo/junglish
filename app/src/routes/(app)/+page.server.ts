// app/src/routes/(app)/+page.server.ts
import type { PageServerLoad } from './$types';
import { getDbs } from '$lib/server/db';
import { dayWords } from '$lib/server/content';
import { dueCount } from '$lib/server/fsrs';
import { getProgress, STEPS, streak } from '$lib/server/mission';

export const load: PageServerLoad = ({ locals }) => {
	const dbs = getDbs();
	const user = locals.user!;
	const day = user.current_day;
	const { step } = getProgress(dbs, user.id, day);
	return {
		day, step, stepIndex: STEPS.indexOf(step), totalSteps: STEPS.length - 1,
		due: dueCount(dbs, user.id), streak: streak(dbs, user.id), hasContent: dayWords(dbs, day).length > 0
	};
};
