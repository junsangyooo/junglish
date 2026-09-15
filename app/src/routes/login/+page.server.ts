// app/src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { checkLoginRate, login } from '$lib/server/auth';
import { getDbs } from '$lib/server/db';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const dbs = getDbs();
		if (!checkLoginRate(dbs, getClientAddress())) return fail(429, { message: '잠시 후 다시 시도하세요' });
		const form = await request.formData();
		const sid = login(dbs, String(form.get('name') ?? ''), String(form.get('password') ?? ''));
		if (!sid) return fail(400, { message: '이름 또는 비밀번호가 틀렸습니다' });
		cookies.set('sid', sid, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 86400 });
		redirect(303, '/');
	}
};
