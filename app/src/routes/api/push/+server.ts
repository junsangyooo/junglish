import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authedBody, ok } from '$lib/server/api';
import { getDbs } from '$lib/server/db';
import { deleteSubscription, saveSubscription, type PushSubscriptionInput } from '$lib/server/push';

type Body = { action: 'subscribe' | 'unsubscribe'; subscription?: PushSubscriptionInput; endpoint?: string };

export const POST: RequestHandler = async (event) => {
	const { userId, body } = await authedBody<Body>(event);
	const dbs = getDbs();

	if (body.action === 'unsubscribe') {
		if (typeof body.endpoint !== 'string' || !body.endpoint) throw error(400, 'bad request');
		deleteSubscription(dbs, userId, body.endpoint);
		return ok({ ok: true });
	}

	const sub = body.subscription;
	if (body.action !== 'subscribe' || !sub || typeof sub.endpoint !== 'string'
		|| typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') {
		throw error(400, 'bad request');
	}
	saveSubscription(dbs, userId, sub);
	return ok({ ok: true });
};
