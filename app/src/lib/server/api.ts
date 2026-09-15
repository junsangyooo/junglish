import { error, json, type RequestEvent } from '@sveltejs/kit';
import type { CardType } from './fsrs';

export async function authedBody<T>(event: RequestEvent): Promise<{ userId: number; body: T }> {
	if (!event.locals.user) throw error(401, 'unauthorized');
	try {
		return { userId: event.locals.user.id, body: (await event.request.json()) as T };
	} catch {
		throw error(400, 'invalid json');
	}
}
export const ok = (data: unknown) => json(data);

export const isCardType = (v: unknown): v is CardType => v === 'word' || v === 'pattern';
export const isRating = (v: unknown): v is 1 | 2 | 3 => v === 1 || v === 2 || v === 3;
export const isInt = (v: unknown): v is number => Number.isInteger(v);
