import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authedBody, isCardType, isInt, isRating, ok } from '$lib/server/api';
import { getDbs } from '$lib/server/db';
import { rate, type CardType } from '$lib/server/fsrs';
import { markActivity } from '$lib/server/mission';

export const POST: RequestHandler = async (event) => {
	const { userId, body } = await authedBody<{ type: CardType; id: number; rating: 1 | 2 | 3 }>(event);
	if (!isCardType(body.type) || !isInt(body.id) || !isRating(body.rating)) throw error(400, 'bad request');
	const dbs = getDbs();
	const row = rate(dbs, userId, body.type, body.id, body.rating);
	markActivity(dbs, userId);
	return ok({ due: row.due });
};
