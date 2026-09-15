import type { Actions, PageServerLoad } from './$types';
import { getDbs } from '$lib/server/db';
import { unmarkKnown } from '$lib/server/fsrs';
import { summary } from '$lib/server/stats';

export const load: PageServerLoad = ({ locals }) => summary(getDbs(), locals.user!.id);

export const actions: Actions = {
	unknown: async ({ request, locals }) => {
		const f = await request.formData();
		unmarkKnown(getDbs(), locals.user!.id, f.get('type') as 'word' | 'pattern', Number(f.get('id')));
	},
	editSentence: async ({ request, locals }) => {
		const f = await request.formData();
		const text = String(f.get('text') ?? '').trim();
		if (text) getDbs().progress.prepare('update user_sentences set text=? where id=? and user_id=?').run(text, Number(f.get('id')), locals.user!.id);
	}
};
