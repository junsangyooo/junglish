import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authedBody, isCardType, isInt, ok } from '$lib/server/api';
import { getDbs } from '$lib/server/db';
import { markKnown, type CardType } from '$lib/server/fsrs';
import { activityTime, markActivity } from '$lib/server/mission';

export const POST: RequestHandler = async (event) => {
	const { userId, body } = await authedBody<{ type: CardType; id: number; at?: string }>(event);
	if (!isCardType(body.type) || !isInt(body.id)) throw error(400, 'bad request');
	const dbs = getDbs();
	markKnown(dbs, userId, body.type, body.id);
	markActivity(dbs, userId, activityTime(body.at));
	return ok({ ok: true });
};
