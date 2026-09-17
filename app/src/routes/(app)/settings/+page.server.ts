import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import { getDbs } from '$lib/server/db';
import { publicKey, pushConfigured, subscriptionCount } from '$lib/server/push';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const load: PageServerLoad = ({ locals }) => {
	const dbs = getDbs();
	const row = dbs.progress.prepare('select notify_enabled, notify_at from users where id=?')
		.get(locals.user!.id) as { notify_enabled: number; notify_at: string };
	return {
		review_limit: locals.user!.review_limit,
		notify: {
			available: pushConfigured(),
			enabled: row.notify_enabled === 1,
			at: row.notify_at,
			devices: subscriptionCount(dbs, locals.user!.id),
			publicKey: publicKey()
		}
	};
};

export const actions: Actions = {
	limit: async ({ request, locals }) => {
		const n = Number((await request.formData()).get('review_limit'));
		if (!Number.isInteger(n) || n < 10 || n > 500) return fail(400, { message: '10~500 사이 정수' });
		getDbs().progress.prepare('update users set review_limit=? where id=?').run(n, locals.user!.id);
		return { message: '저장됨' };
	},
	notify: async ({ request, locals }) => {
		const f = await request.formData();
		const enabled = f.get('notify_enabled') === 'on' ? 1 : 0;
		const at = String(f.get('notify_at') ?? '');
		if (!TIME_RE.test(at)) return fail(400, { message: '시각은 HH:MM 형식이어야 합니다' });
		// Clearing the sent-marker means turning the reminder back on works the same day.
		getDbs().progress.prepare('update users set notify_enabled=?, notify_at=?, notify_last_sent=null where id=?')
			.run(enabled, at, locals.user!.id);
		return { message: enabled ? `매일 ${at}에 알려드릴게요` : '알림을 껐습니다' };
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
