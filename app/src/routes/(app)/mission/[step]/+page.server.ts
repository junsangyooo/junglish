// app/src/routes/(app)/mission/[step]/+page.server.ts
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDbs } from '$lib/server/db';
import { dayDialogue, dayPatterns } from '$lib/server/content';
import { advanceStep, getProgress, localDate, STEPS, streak, type Step } from '$lib/server/mission';
import { newPatternQueue, newWordQueue, reviewQueue, writeSuggestions } from '$lib/server/queue';

export const load: PageServerLoad = ({ locals, params }) => {
	const dbs = getDbs();
	const user = locals.user!;
	const step = params.step as Step;
	if (!STEPS.includes(step)) error(404);
	const day = step === 'done' ? user.current_day - 1 : user.current_day;
	if (day < 1) redirect(303, '/');
	const current = getProgress(dbs, user.id, day).step;
	if (step !== current) redirect(303, step === 'done' ? '/' : `/mission/${current}`);

	const base = { day, step, stepIndex: STEPS.indexOf(step), totalSteps: STEPS.length - 1 };
	switch (step) {
		case 'review':
		case 'final': {
			const cards = reviewQueue(dbs, user, { horizonMinutes: step === 'final' ? 10 : 0 });
			if (cards.length === 0) redirect(303, `/mission/${advanceStep(dbs, user.id, day, step)}`);
			return { ...base, cards };
		}
		case 'words': {
			const cards = newWordQueue(dbs, user, day);
			if (cards.length === 0) redirect(303, `/mission/${advanceStep(dbs, user.id, day, step)}`);
			return { ...base, cards };
		}
		case 'patterns': {
			const cards = newPatternQueue(dbs, user, day);
			if (cards.length === 0) redirect(303, `/mission/${advanceStep(dbs, user.id, day, step)}`);
			return { ...base, cards };
		}
		case 'dialogue':
		case 'shadow': {
			const dialogue = dayDialogue(dbs, day);
			if (!dialogue) redirect(303, `/mission/${advanceStep(dbs, user.id, day, step)}`);
			const others = dayPatterns(dbs, day).filter((p) => !dialogue.quiz.some((q) => q.pattern_id === p.id))
				.map((p) => p.pattern.replace(/~/g, '').replace(/\s+/g, ' ').trim());
			const quiz = dialogue.quiz.map((q, i) => {
				const distractors = dialogue.quiz.filter((_, j) => j !== i).map((x) => x.blank_text);
				distractors.push(others[i % Math.max(others.length, 1)] ?? '—');
				const options = [q.blank_text, ...distractors].sort(() => Math.random() - 0.5);
				return { ...q, options };
			});
			return { ...base, dialogue: { ...dialogue, quiz } };
		}
		case 'write':
			return { ...base, suggestions: writeSuggestions(dbs, user, day) };
		case 'done': {
			const today = localDate(new Date());
			const n = (sql: string) => (dbs.progress.prepare(sql).get(user.id, today) as { n: number }).n;
			return {
				...base, streak: streak(dbs, user.id),
				summary: {
					reviews: n("select count(*) as n from review_logs where user_id=? and date(review, '+9 hours')=? and state<>0"),
					learned: n("select count(*) as n from review_logs where user_id=? and date(review, '+9 hours')=? and state=0"),
					known: n("select count(*) as n from card_states where user_id=? and known=1 and date(due, '+9 hours')=?")
				}
			};
		}
	}
};
