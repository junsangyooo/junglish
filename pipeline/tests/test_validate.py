import json
from unittest import mock

from pipeline import validate

WORDS = [{"word": f"word{i:02d}", "rank": i} for i in range(1, 31)]
PATTERNS = [{"pattern": f"pat{i} ~", "day": 1, "seq": i} for i in range(1, 11)]


def _good():
    words = [{"word": w["word"], "pos": "n", "ipa": "/x/", "meaning_ko": "뜻",
              "example_work": f"We use {w['word']} at work.", "example_work_ko": "번역",
              "example_daily": f"I saw {w['word']} today.", "example_daily_ko": "번역",
              "collocations": ["a", "b"]} for w in WORDS]
    pats = [{"pattern": p["pattern"], "meaning_ko": "뜻", "grammar_note_ko": "", "register": "neutral",
             "example_1": "e", "example_1_ko": "ㅇ", "example_2": "e", "example_2_ko": "ㅇ",
             "cloze_sentence": f"This is ___ {p['seq']}.", "cloze_answer": f"pat{p['seq']}"} for p in PATTERNS]
    lines = [{"speaker": "A", "text": f"pat{i} ~ with word0{i} here", "text_ko": "ㅇ"} for i in range(1, 7)]
    quiz = [{"line_index": i, "blank_text": f"pat{i + 1}", "answer": f"pat{i + 1}", "pattern": f"pat{i + 1} ~"}
            for i in range(3)]
    return {"day": 1, "words": words, "patterns": pats,
            "dialogue": {"title_ko": "t", "situation_ko": "s", "lines": lines, "quiz": quiz}}


def test_good_day_passes():
    assert validate.check_day(_good(), WORDS, PATTERNS) == []


def test_word_mismatch_reported():
    d = _good()
    d["words"][0]["word"] = "other"
    assert any("word" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_cloze_without_blank_reported():
    d = _good()
    d["patterns"][0]["cloze_sentence"] = "no blank here"
    assert any("cloze" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_quiz_blank_not_in_line_reported():
    d = _good()
    d["dialogue"]["quiz"][0]["blank_text"] = "nonexistent"
    assert any("quiz" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_dialogue_missing_words_reported():
    d = _good()
    for line in d["dialogue"]["lines"]:
        line["text"] = line["text"].replace("word0", "zzz")
    assert any("dialogue words" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_pattern_mismatch_reported():
    d = _good()
    d["patterns"][0]["pattern"] = "other ~"
    assert any("pattern" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_quiz_wrong_count_reported():
    d = _good()
    d["dialogue"]["quiz"].pop()
    assert any("quiz" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_quiz_line_index_out_of_range_reported():
    d = _good()
    d["dialogue"]["quiz"][0]["line_index"] = 99
    assert any("quiz" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_quiz_pattern_not_today_reported():
    d = _good()
    d["dialogue"]["quiz"][0]["pattern"] = "notapattern ~"
    assert any("quiz" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_contains_uses_word_boundary():
    assert validate._contains("syntax error", "tax") is False
    assert validate._contains("the tax rate", "tax") is True


def test_cloze_answer_not_in_pattern_reported():
    d = _good()
    d["patterns"][0]["cloze_answer"] = "nomatch"
    assert any("cloze answer" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_quiz_blank_text_with_tilde_reported():
    d = _good()
    d["dialogue"]["quiz"][0]["blank_text"] = "pat1 ~"
    assert any("must not contain" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_quiz_pattern_fragment_not_realized_reported():
    d = _good()
    d["dialogue"]["lines"][0]["text"] = "totally unrelated text here"
    assert any("not realized" in e for e in validate.check_day(d, WORDS, PATTERNS))


def test_cloze_five_underscores_counts_as_one_blank():
    d = _good()
    d["patterns"][0]["cloze_sentence"] = "This is _____ 1."
    assert validate.check_day(d, WORDS, PATTERNS) == []


def test_main_records_corrupt_file_as_failed(tmp_path):
    seeds_dir = tmp_path / "seeds"
    seeds_dir.mkdir()
    (seeds_dir / "words.json").write_text("[]")
    (seeds_dir / "patterns.json").write_text("[]")
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    (out_dir / "day_1.json").write_text("{not json")
    with mock.patch("pipeline.validate.config.SEEDS_DIR", seeds_dir), \
         mock.patch("pipeline.validate.config.OUT_DIR", out_dir):
        validate.main()
    failed = json.loads((out_dir / "failed.json").read_text())
    assert failed == [1]


def test_answer_in_pattern_strips_punctuation():
    """Test that cloze answer matching strips punctuation from pattern."""
    assert validate._answer_in_pattern("bad", "My bad, I ~")
    assert validate._answer_in_pattern("late", "Sorry I'm late, ~")
    assert validate._answer_in_pattern("for", "Here is the ~ you asked for.")
    assert not validate._answer_in_pattern("nope", "My bad, I ~")
