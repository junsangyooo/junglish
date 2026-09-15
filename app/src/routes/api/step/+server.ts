import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authedBody, isInt, ok } from '$lib/server/api';
import { getDbs } from '$lib/server/db';
import { advanceStep, STEPS, type Step } from '$lib/server/mission';

export const POST: RequestHandler = async (event) => {
	const { userId, body } = await authedBody<{ day: number; from: Step }>(event);
	if (!isInt(body.day) || !STEPS.includes(body.from)) throw error(400, 'bad request');
	return ok({ step: advanceStep(getDbs(), userId, body.day, body.from) });
};
