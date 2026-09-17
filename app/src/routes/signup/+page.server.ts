// app/src/routes/signup/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { checkInviteCode, checkLoginRate, createSession, createUser, signupOpen, SESSION_DAYS } from '$lib/server/auth';
import { getDbs } from '$lib/server/db';

const NAME_RE = /^[A-Za-z0-9가-힣._-]{2,20}$/;

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
	return { open: signupOpen() };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		if (!signupOpen()) return fail(403, { message: '지금은 가입을 받지 않습니다', name: '' });
		const dbs = getDbs();
		if (!checkLoginRate(dbs, getClientAddress())) return fail(429, { message: '잠시 후 다시 시도하세요', name: '' });

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const invite = String(form.get('invite') ?? '').trim();

		if (!NAME_RE.test(name)) return fail(400, { message: '이름은 2~20자, 한글·영문·숫자·(. _ -)만 됩니다', name });
		if (password.length < 8) return fail(400, { message: '비밀번호는 8자 이상이어야 합니다', name });
		if (!checkInviteCode(invite)) return fail(400, { message: '초대 코드가 올바르지 않습니다', name });

		const id = createUser(dbs, name, password);
		if (id === null) return fail(400, { message: '이미 쓰고 있는 이름입니다', name });

		cookies.set('sid', createSession(dbs, id), {
			path: '/', httpOnly: true, sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production', maxAge: SESSION_DAYS * 86_400
		});
		redirect(303, '/');
	}
};
