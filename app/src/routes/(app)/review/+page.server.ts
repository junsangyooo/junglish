// app/src/routes/(app)/review/+page.server.ts
import type { PageServerLoad } from './$types';
import { getDbs } from '$lib/server/db';
import { reviewQueue } from '$lib/server/queue';

export const load: PageServerLoad = ({ locals }) => ({ cards: reviewQueue(getDbs(), locals.user!, { horizonMinutes: 0 }) });
