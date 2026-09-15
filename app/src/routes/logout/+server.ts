// app/src/routes/logout/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';
import { getDbs } from '$lib/server/db';

export const POST: RequestHandler = ({ cookies }) => {
	const sid = cookies.get('sid');
	if (sid) deleteSession(getDbs(), sid);
	cookies.delete('sid', { path: '/' });
	redirect(303, '/login');
};
