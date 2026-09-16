import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isCardType, isInt } from '$lib/server/api';
import { getDbs } from '$lib/server/db';
import { unmarkKnown } from '$lib/server/fsrs';
import { summary } from '$lib/server/stats';

export const load: PageServerLoad = ({ locals }) => summary(getDbs(), locals.user!.id);

export const actions: Actions = {
	unknown: async ({ request, locals }) => {
		const f = await request.formData();
		const type = String(f.get('type') ?? '');
		const id = Number(f.get('id'));
		if (!isCardType(type) || !isInt(id)) return fail(400, { message: '잘못된 요청' });
		unmarkKnown(getDbs(), locals.user!.id, type, id);
	},
	editSentence: async ({ request, locals }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const text = String(f.get('text') ?? '').trim();
		if (!isInt(id) || !text) return fail(400, { message: '잘못된 요청' });
		getDbs().progress.prepare('update user_sentences set text=? where id=? and user_id=?').run(text, id, locals.user!.id);
	}
};
