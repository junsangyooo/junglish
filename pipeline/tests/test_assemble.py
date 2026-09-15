import json
from unittest import mock

from pipeline import assemble, validate

WORDS = [{"word": f"word{i:02d}", "rank": i} for i in range(1, 31)]
PATTERNS = [{"pattern": f"pat{i} ~", "category": "business", "day": 1, "seq": i} for i in range(1, 11)]


def _word_card(w):
    return {"word": w["word"], "pos": "n", "ipa": "/x/", "meaning_ko": "뜻",
            "example_work": f"We use {w['word']} at work.", "example_work_ko": "번역",
            "example_daily": f"I saw {w['word']} today.", "example_daily_ko": "번역",
            "collocations": ["a", "b"]}


def _pattern_card(p):
    return {"pattern": p["pattern"], "meaning_ko": "뜻", "grammar_note_ko": "", "register": "neutral",
            "example_1": "e", "example_1_ko": "ㅇ", "example_2": "e", "example_2_ko": "ㅇ",
            "cloze_sentence": f"This is ___ {p['seq']}.", "cloze_answer": f"pat{p['seq']}"}


def _dialogue(day):
    lines = [{"speaker": "A", "text": f"pat{i} ~ with word0{i} here", "text_ko": "ㅇ"} for i in range(1, 7)]
    quiz = [{"line_index": i, "blank_text": f"pat{i + 1}", "answer": f"pat{i + 1}", "pattern": f"pat{i + 1} ~"}
            for i in range(3)]
    return {"day": day, "title_ko": "t", "situation_ko": "s", "lines": lines, "quiz": quiz}


def _write_chunks(out_dir):
    (out_dir / "words").mkdir(parents=True)
    (out_dir / "words" / "chunk_000.json").write_text(
        json.dumps({"words": [_word_card(w) for w in WORDS]}, ensure_ascii=False))
    (out_dir / "patterns").mkdir(parents=True)
    (out_dir / "patterns" / "chunk_000.json").write_text(
        json.dumps({"patterns": [_pattern_card(p) for p in PATTERNS]}, ensure_ascii=False))
    (out_dir / "dialogues").mkdir(parents=True)
    (out_dir / "dialogues" / "chunk_000.json").write_text(
        json.dumps({"dialogues": [_dialogue(1)]}, ensure_ascii=False))


def test_assemble_writes_day_that_passes_validate(tmp_path):
    seeds_dir = tmp_path / "seeds"
    seeds_dir.mkdir()
    (seeds_dir / "words.json").write_text(json.dumps(WORDS))
    (seeds_dir / "patterns.json").write_text(json.dumps(PATTERNS))
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    _write_chunks(out_dir)

    with mock.patch("pipeline.assemble.config.SEEDS_DIR", seeds_dir), \
         mock.patch("pipeline.assemble.config.OUT_DIR", out_dir), \
         mock.patch("pipeline.assemble.config.DAYS", 1), \
         mock.patch.object(__import__("sys"), "argv", ["assemble"]):
        assemble.main()

    saved = json.loads((out_dir / "day_1.json").read_text())
    assert saved["day"] == 1
    assert len(saved["words"]) == 30
    assert len(saved["patterns"]) == 10
    assert validate.check_day(saved, WORDS, PATTERNS) == []


def test_assemble_skips_day_with_missing_word(tmp_path):
    seeds_dir = tmp_path / "seeds"
    seeds_dir.mkdir()
    (seeds_dir / "words.json").write_text(json.dumps(WORDS))
    (seeds_dir / "patterns.json").write_text(json.dumps(PATTERNS))
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    _write_chunks(out_dir)
    # drop one word from the chunk file
    words_path = out_dir / "words" / "chunk_000.json"
    data = json.loads(words_path.read_text())
    data["words"].pop()
    words_path.write_text(json.dumps(data, ensure_ascii=False))

    with mock.patch("pipeline.assemble.config.SEEDS_DIR", seeds_dir), \
         mock.patch("pipeline.assemble.config.OUT_DIR", out_dir), \
         mock.patch("pipeline.assemble.config.DAYS", 1), \
         mock.patch.object(__import__("sys"), "argv", ["assemble"]):
        assemble.main()

    assert not (out_dir / "day_1.json").exists()


def test_assemble_matches_pattern_via_norm_key(tmp_path):
    """A returned pattern without the seed's trailing period must still match via norm_key."""
    seeds_dir = tmp_path / "seeds"
    seeds_dir.mkdir()
    seed_patterns = [dict(p) for p in PATTERNS]
    seed_patterns[0] = {**seed_patterns[0], "pattern": "I'm in charge of ~."}
    (seeds_dir / "words.json").write_text(json.dumps(WORDS))
    (seeds_dir / "patterns.json").write_text(json.dumps(seed_patterns))
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    _write_chunks(out_dir)
    patterns_path = out_dir / "patterns" / "chunk_000.json"
    data = json.loads(patterns_path.read_text())
    data["patterns"][0] = {**data["patterns"][0], "pattern": "I'm in charge of ~"}
    patterns_path.write_text(json.dumps(data, ensure_ascii=False))

    with mock.patch("pipeline.assemble.config.SEEDS_DIR", seeds_dir), \
         mock.patch("pipeline.assemble.config.OUT_DIR", out_dir), \
         mock.patch("pipeline.assemble.config.DAYS", 1), \
         mock.patch.object(__import__("sys"), "argv", ["assemble"]):
        assemble.main()

    saved = json.loads((out_dir / "day_1.json").read_text())
    assert saved["patterns"][0]["pattern"] == "I'm in charge of ~."   # canonical seed text wins


def test_assemble_repairs_swapped_word_example(tmp_path):
    """A word chunk with swapped en/ko example fields must still assemble into a valid day."""
    seeds_dir = tmp_path / "seeds"
    seeds_dir.mkdir()
    (seeds_dir / "words.json").write_text(json.dumps(WORDS))
    (seeds_dir / "patterns.json").write_text(json.dumps(PATTERNS))
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    _write_chunks(out_dir)
    words_path = out_dir / "words" / "chunk_000.json"
    data = json.loads(words_path.read_text())
    swapped = data["words"][0]
    swapped["example_daily"], swapped["example_daily_ko"] = swapped["example_daily_ko"], swapped["example_daily"]
    words_path.write_text(json.dumps(data, ensure_ascii=False))

    with mock.patch("pipeline.assemble.config.SEEDS_DIR", seeds_dir), \
         mock.patch("pipeline.assemble.config.OUT_DIR", out_dir), \
         mock.patch("pipeline.assemble.config.DAYS", 1), \
         mock.patch.object(__import__("sys"), "argv", ["assemble"]):
        assemble.main()

    saved = json.loads((out_dir / "day_1.json").read_text())
    assert validate.check_day(saved, WORDS, PATTERNS) == []
