// app/src/lib/answer.ts — typed-answer grading, shared by the card UI and its tests.

/** Case, punctuation and spacing never count against the learner. */
export function normalizeAnswer(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
