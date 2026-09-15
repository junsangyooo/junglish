export function voices(): SpeechSynthesisVoice[] {
	if (typeof speechSynthesis === 'undefined') return [];
	return speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
}

function makeUtterance(text: string): SpeechSynthesisUtterance {
	const u = new SpeechSynthesisUtterance(text);
	u.lang = 'en-US';
	try {
		u.rate = Number(localStorage.getItem('tts_rate') ?? '0.95');
		const name = localStorage.getItem('tts_voice');
		const v = name ? voices().find((x) => x.name === name) : undefined;
		if (v) u.voice = v;
	} catch { /* storage unavailable */ }
	return u;
}

export function speak(text: string): void {
	if (typeof speechSynthesis === 'undefined') return;
	speechSynthesis.cancel();
	speechSynthesis.speak(makeUtterance(text));
}

export function speakSequence(texts: string[]): void {
	if (typeof speechSynthesis === 'undefined') return;
	speechSynthesis.cancel();
	let i = 0;
	const next = () => {
		if (i >= texts.length) return;
		const u = makeUtterance(texts[i++]);
		u.onend = next;
		speechSynthesis.speak(u);
	};
	next();
}
