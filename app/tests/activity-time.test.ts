import { describe, expect, it } from 'vitest';
import { activityTime, localDate } from '../src/lib/server/mission';

// 2026-09-17 10:00 KST
const now = new Date('2026-09-17T10:00:00+09:00');
const iso = (s: string) => new Date(s).toISOString();

describe('activityTime', () => {
	it('keeps a time from today', () => {
		const at = iso('2026-09-17T08:30:00+09:00');
		expect(activityTime(at, now).toISOString()).toBe(at);
		expect(localDate(activityTime(at, now))).toBe('2026-09-17');
	});

	it('keeps last night, so a session finished at 23:50 counts for that day', () => {
		const at = iso('2026-09-16T23:50:00+09:00');
		expect(activityTime(at, now).toISOString()).toBe(at);
		expect(localDate(activityTime(at, now))).toBe('2026-09-16');
	});

	it('refuses two days back, so a broken streak cannot be revived', () => {
		expect(activityTime(iso('2026-09-15T23:50:00+09:00'), now)).toEqual(now);
	});

	it('refuses tomorrow', () => {
		expect(activityTime(iso('2026-09-18T09:00:00+09:00'), now)).toEqual(now);
	});

	it('refuses a time later today — a clock running ahead is still ahead', () => {
		expect(activityTime(iso('2026-09-17T23:30:00+09:00'), now)).toEqual(now);
	});

	it('falls back to server time when the value is missing or unusable', () => {
		expect(activityTime(undefined, now)).toEqual(now);
		expect(activityTime(null, now)).toEqual(now);
		expect(activityTime('', now)).toEqual(now);
		expect(activityTime('어제쯤', now)).toEqual(now);
		expect(activityTime(1789613482022, now)).toEqual(now);
	});
});
