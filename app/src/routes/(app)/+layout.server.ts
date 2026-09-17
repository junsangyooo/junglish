// app/src/routes/(app)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	// '/' doubles as the landing page for visitors; everything else needs an account.
	if (!locals.user && url.pathname !== '/') redirect(303, '/login');
	return { user: locals.user, path: url.pathname };
};
