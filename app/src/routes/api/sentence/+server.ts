import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authedBody, isInt, ok } from '$lib/server/api';
import { getDbs } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const { userId, body } = await authedBody<{ pattern_id: number; text: string }>(event);
	if (!isInt(body.pattern_id) || typeof body.text !== 'string') throw error(400, 'bad request');
	const text = body.text?.trim();
	if (!text) throw error(400, 'empty');
	const r = getDbs().progress.prepare('insert into user_sentences(user_id, pattern_id, text) values(?,?,?)').run(userId, body.pattern_id, text);
	return ok({ id: Number(r.lastInsertRowid) });
};
