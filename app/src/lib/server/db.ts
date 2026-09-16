import Database from 'better-sqlite3';
import path from 'node:path';

export type Dbs = { content: Database.Database; progress: Database.Database };

export const PROGRESS_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  current_day INTEGER NOT NULL DEFAULT 1, review_limit INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS card_states (
  user_id INTEGER NOT NULL, card_type TEXT NOT NULL, card_id INTEGER NOT NULL,
  known INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL, due TEXT NOT NULL, stability REAL NOT NULL, difficulty REAL NOT NULL,
  elapsed_days INTEGER NOT NULL, scheduled_days INTEGER NOT NULL, learning_steps INTEGER NOT NULL,
  reps INTEGER NOT NULL, lapses INTEGER NOT NULL, last_review TEXT,
  PRIMARY KEY (user_id, card_type, card_id)
);
CREATE INDEX IF NOT EXISTS idx_card_states_due ON card_states(user_id, known, due);
CREATE TABLE IF NOT EXISTS review_logs (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, card_type TEXT NOT NULL, card_id INTEGER NOT NULL,
  rating INTEGER NOT NULL, state INTEGER NOT NULL, due TEXT NOT NULL,
  stability REAL NOT NULL, difficulty REAL NOT NULL, elapsed_days INTEGER NOT NULL,
  last_elapsed_days INTEGER NOT NULL, scheduled_days INTEGER NOT NULL, learning_steps INTEGER NOT NULL,
  review TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_logs_user_review ON review_logs(user_id, review);
CREATE TABLE IF NOT EXISTS day_progress (
  user_id INTEGER NOT NULL, day INTEGER NOT NULL,
  step TEXT NOT NULL DEFAULT 'review', completed_at TEXT,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS user_sentences (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, pattern_id INTEGER NOT NULL,
  text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_sentences ON user_sentences(user_id, pattern_id, id);
CREATE TABLE IF NOT EXISTS activity_days (
  user_id INTEGER NOT NULL, date TEXT NOT NULL, PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL, attempted_at TEXT NOT NULL
);
`;

export function openDbs(contentPath: string, progressPath: string): Dbs {
	const content = new Database(contentPath, { readonly: contentPath !== ':memory:' });
	const progress = new Database(progressPath);
	progress.pragma('journal_mode = WAL');
	progress.exec(PROGRESS_SCHEMA);
	return { content, progress };
}

let dbs: Dbs | undefined;

export function getDbs(): Dbs {
	if (!dbs) {
		const root = path.resolve(process.cwd(), '..', 'data');
		dbs = openDbs(
			process.env.CONTENT_DB ?? path.join(root, 'content.db'),
			process.env.PROGRESS_DB ?? path.join(root, 'progress.db')
		);
	}
	return dbs;
}
