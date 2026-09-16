// app/src/lib/quiz.ts — dialogue blank quiz, shared by the server load and the session UI.
export type QuizSource = { id: number; line_index: number; blank_text: string };
export type QuizQuestion = { id: number; line_index: number; answer: string; options: string[] };

/** Patterns are stored with '~' placeholders ("Can I get back to you on ~?"); make them readable as options. */
export function readablePattern(pattern: string): string {
	return pattern
		.replace(/\s*~/g, '…')
		.replace(/\s+([.,?!])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Blank out the quiz phrase case-insensitively — dialogue lines may capitalize it. */
export function maskLine(text: string, phrase: string): string {
	const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
	return text.replace(re, '_____');
}

function shuffle<T>(items: T[], rnd: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** One question per quiz item: the correct phrase plus up to 3 distinct distractors. */
export function buildQuiz(quiz: QuizSource[], otherPatterns: string[], rnd: () => number = Math.random): QuizQuestion[] {
	const pool = [...quiz.map((q) => q.blank_text), ...otherPatterns.map(readablePattern)];
	return quiz.map((q) => {
		const seen = new Set([q.blank_text.toLowerCase()]);
		const distractors: string[] = [];
		for (const candidate of shuffle(pool, rnd)) {
			if (distractors.length === 3) break;
			const key = candidate.toLowerCase();
			if (!candidate || seen.has(key)) continue;
			seen.add(key);
			distractors.push(candidate);
		}
		return { id: q.id, line_index: q.line_index, answer: q.blank_text, options: shuffle([q.blank_text, ...distractors], rnd) };
	});
}

/** Dialogue text with blanks applied for the questions not yet solved. */
export function maskedTexts(lines: { text: string }[], questions: QuizQuestion[], solved: Set<number>): string[] {
	return lines.map((line, i) => {
		const q = questions.find((x) => x.line_index === i && !solved.has(x.id));
		return q ? maskLine(line.text, q.answer) : line.text;
	});
}
