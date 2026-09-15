import json
import sqlite3

import pytest

from pipeline import build_db
from pipeline.tests.test_validate import _good, WORDS, PATTERNS


def _meta():
    word_meta = {w["word"]: w for w in WORDS}
    pattern_meta = {p["pattern"]: {**p, "category": "business"} for p in PATTERNS}
    return word_meta, pattern_meta


def test_insert_day_creates_rows(tmp_path):
    conn = sqlite3.connect(tmp_path / "c.db")
    conn.executescript(build_db.SCHEMA_SQL)
    build_db.insert_day(conn, _good(), *_meta())
    assert conn.execute("select count(*) from words where day=1").fetchone()[0] == 30
    assert conn.execute("select count(*) from patterns where day=1").fetchone()[0] == 10
    assert conn.execute("select count(*) from quiz_items").fetchone()[0] == 3
    row = conn.execute("select category, freq_rank from patterns p, words w where p.seq=1 and w.seq=1").fetchone()
    assert row == ("business", 1)
    lines = json.loads(conn.execute("select lines from dialogues").fetchone()[0])
    assert len(lines) == 6


def test_insert_day_is_idempotent(tmp_path):
    conn = sqlite3.connect(tmp_path / "c.db")
    conn.executescript(build_db.SCHEMA_SQL)
    build_db.insert_day(conn, _good(), *_meta())
    build_db.insert_day(conn, _good(), *_meta())
    assert conn.execute("select count(*) from words").fetchone()[0] == 30
    assert conn.execute("select count(*) from quiz_items").fetchone()[0] == 3


def test_insert_day_rolls_back_on_unknown_quiz_pattern(tmp_path):
    conn = sqlite3.connect(tmp_path / "c.db")
    conn.executescript(build_db.SCHEMA_SQL)
    d = _good()
    d["dialogue"]["quiz"][0]["pattern"] = "nonexistent ~"
    with pytest.raises(ValueError):
        build_db.insert_day(conn, d, *_meta())
    conn.rollback()
    assert conn.execute("select count(*) from words where day=1").fetchone()[0] == 0
