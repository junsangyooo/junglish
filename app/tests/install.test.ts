import { describe, expect, it } from 'vitest';
import { shouldShowInstallBanner } from '../src/lib/install';

describe('shouldShowInstallBanner', () => {
	it('nudges only a browser tab the user has not dismissed', () => {
		expect(shouldShowInstallBanner({ standalone: false, dismissed: false })).toBe(true);
	});

	it('stays quiet once the app is installed', () => {
		expect(shouldShowInstallBanner({ standalone: true, dismissed: false })).toBe(false);
		expect(shouldShowInstallBanner({ standalone: true, dismissed: true })).toBe(false);
	});

	it('stays quiet after it has been dismissed', () => {
		expect(shouldShowInstallBanner({ standalone: false, dismissed: true })).toBe(false);
	});
});
