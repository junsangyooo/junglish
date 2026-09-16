"""Assemble out/day_*.json into data/content.db."""
import json
import re
import sqlite3

from pipeline import config

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY, day INTEGER NOT NULL, seq INTEGER NOT NULL,
  word TEXT NOT NULL, pos TEXT, ipa TEXT, meaning_ko TEXT NOT NULL,
  example_work TEXT, example_work_ko TEXT, example_daily TEXT, example_daily_ko TEXT,
  collocations TEXT, freq_rank INTEGER,
  UNIQUE(day, seq)
);
CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY, day INTEGER NOT NULL, seq INTEGER NOT NULL,
  pattern TEXT NOT NULL, meaning_ko TEXT NOT NULL, category TEXT NOT NULL,
  grammar_note_ko TEXT, register TEXT,
  example_1 TEXT, example_1_ko TEXT, example_2 TEXT, example_2_ko TEXT,
  cloze_sentence TEXT, cloze_answer TEXT,
  UNIQUE(day, seq)
);
CREATE TABLE IF NOT EXISTS dialogues (
  id INTEGER PRIMARY KEY, day INTEGER NOT NULL UNIQUE,
  title_ko TEXT, situation_ko TEXT, lines TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_items (
  id INTEGER PRIMARY KEY, dialogue_id INTEGER NOT NULL REFERENCES dialogues(id),
  line_index INTEGER NOT NULL, blank_text TEXT NOT NULL, answer TEXT NOT NULL,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_items_dialogue ON quiz_items(dialogue_id, line_index);
CREATE INDEX IF NOT EXISTS idx_words_day ON words(day);
CREATE INDEX IF NOT EXISTS idx_patterns_day ON patterns(day);
"""


def insert_day(conn: sqlite3.Connection, data: dict, word_meta: dict, pattern_meta: dict) -> None:
    day = data["day"]
    old = conn.execute("select id from dialogues where day=?", (day,)).fetchone()
    if old:
        conn.execute("delete from quiz_items where dialogue_id=?", (old[0],))
        conn.execute("delete from dialogues where day=?", (day,))
    conn.execute("delete from words where day=?", (day,))
    conn.execute("delete from patterns where day=?", (day,))

    for seq, w in enumerate(data["words"], start=1):
        conn.execute(
            "insert into words(day,seq,word,pos,ipa,meaning_ko,example_work,example_work_ko,"
            "example_daily,example_daily_ko,collocations,freq_rank) values(?,?,?,?,?,?,?,?,?,?,?,?)",
            (day, seq, w["word"], w["pos"], w["ipa"], w["meaning_ko"], w["example_work"], w["example_work_ko"],
             w["example_daily"], w["example_daily_ko"], json.dumps(w["collocations"], ensure_ascii=False),
             word_meta.get(w["word"].strip().lower(), {}).get("rank")))

    pattern_ids = {}
    for seq, p in enumerate(data["patterns"], start=1):
        meta = pattern_meta.get(p["pattern"].strip(), {})
        cur = conn.execute(
            "insert into patterns(day,seq,pattern,meaning_ko,category,grammar_note_ko,register,"
            "example_1,example_1_ko,example_2,example_2_ko,cloze_sentence,cloze_answer) "
            "values(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (day, seq, p["pattern"], p["meaning_ko"], meta.get("category", "daily"),
             p["grammar_note_ko"] or None, p["register"], p["example_1"], p["example_1_ko"],
             p["example_2"], p["example_2_ko"], p["cloze_sentence"], p["cloze_answer"]))
        pattern_ids[p["pattern"].strip()] = cur.lastrowid

    d = data["dialogue"]
    cur = conn.execute("insert into dialogues(day,title_ko,situation_ko,lines) values(?,?,?,?)",
                       (day, d["title_ko"], d["situation_ko"], json.dumps(d["lines"], ensure_ascii=False)))
    dialogue_id = cur.lastrowid
    for q in d["quiz"]:
        pattern_id = pattern_ids.get(q["pattern"].strip())
        if pattern_id is None:
            raise ValueError(f"day {day}: quiz pattern not in day patterns: {q['pattern']!r}")
        conn.execute("insert into quiz_items(dialogue_id,line_index,blank_text,answer,pattern_id) values(?,?,?,?,?)",
                     (dialogue_id, q["line_index"], q["blank_text"], q["answer"], pattern_id))
    conn.commit()


def main():
    config.DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(config.DATA_DIR / "content.db")
    conn.executescript(SCHEMA_SQL)
    words = json.loads((config.SEEDS_DIR / "words.json").read_text())
    patterns = json.loads((config.SEEDS_DIR / "patterns.json").read_text())
    word_meta = {w["word"].strip().lower(): w for w in words}
    pattern_meta = {p["pattern"].strip(): p for p in patterns}
    failed = set(json.loads((config.OUT_DIR / "failed.json").read_text())) if (config.OUT_DIR / "failed.json").exists() else set()
    files = sorted(config.OUT_DIR.glob("day_*.json"), key=lambda p: int(re.search(r"\d+", p.name).group()))
    n = 0
    for f in files:
        day_num = int(re.search(r"\d+", f.name).group())
        try:
            data = json.loads(f.read_text())
            if data["day"] in failed:
                print(f"day {data['day']}: skipped (failed validation)")
                continue
            insert_day(conn, data, word_meta, pattern_meta)
        except Exception as e:
            conn.rollback()
            print(f"day {day_num}: skipped ({e})")
            continue
        n += 1
    conn.execute("VACUUM")
    print(f"inserted {n} days into {config.DATA_DIR / 'content.db'}")


if __name__ == "__main__":
    main()
