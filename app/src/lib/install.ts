// app/src/lib/install.ts — whether to nudge the visitor to install the app, and how.
const KEY = 'junglish_install_dismissed';

export type InstallState = { standalone: boolean; dismissed: boolean };

export function shouldShowInstallBanner({ standalone, dismissed }: InstallState): boolean {
	return !standalone && !dismissed;
}

export function isStandalone(): boolean {
	if (typeof matchMedia === 'undefined') return false;
	// iOS Safari reports installs through navigator.standalone rather than the media query.
	const ios = (navigator as unknown as { standalone?: boolean }).standalone === true;
	return ios || matchMedia('(display-mode: standalone)').matches;
}

export function isDismissed(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

export function dismiss(): void {
	try {
		localStorage.setItem(KEY, '1');
	} catch {
		/* storage unavailable — the banner comes back next time, which is harmless */
	}
}

/** iOS has no install prompt; the user has to go through the share sheet. */
export function isIos(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
