import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import { getDbs } from '$lib/server/db';

export const load: PageServerLoad = ({ locals }) => ({ review_limit: locals.user!.review_limit });

export const actions: Actions = {
	limit: async ({ request, locals }) => {
		const n = Number((await request.formData()).get('review_limit'));
		if (!Number.isInteger(n) || n < 10 || n > 500) return fail(400, { message: '10~500 사이 정수' });
		getDbs().progress.prepare('update users set review_limit=? where id=?').run(n, locals.user!.id);
		return { message: '저장됨' };
	},
	password: async ({ request, locals }) => {
		const f = await request.formData();
		const dbs = getDbs();
		const row = dbs.progress.prepare('select password_hash from users where id=?').get(locals.user!.id) as { password_hash: string };
		if (!verifyPassword(String(f.get('current') ?? ''), row.password_hash)) return fail(400, { message: '현재 비밀번호가 틀렸습니다' });
		const next = String(f.get('next') ?? '');
		if (next.length < 8) return fail(400, { message: '새 비밀번호는 8자 이상' });
		dbs.progress.prepare('update users set password_hash=? where id=?').run(hashPassword(next), locals.user!.id);
		return { message: '변경됨' };
	}
};
