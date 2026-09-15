import json
from unittest import mock

import pytest

from pipeline import config, gen_content
from pipeline.claude_call import ClaudeCallError


def _words(n):
    return [{"word": f"w{i}"} for i in range(1, n + 1)]


def _patterns(n):
    return [{"pattern": f"p{i} ~", "category": "business", "day": (i - 1) // 10 + 1, "seq": (i - 1) % 10 + 1}
            for i in range(1, n + 1)]


def test_chunk_boundaries():
    assert [len(c) for c in gen_content._chunk(_words(250), 100)] == [100, 100, 50]


def test_select_with_chunks_range():
    chunks = gen_content._chunk(_words(250), 100)
    selected = gen_content._select(chunks, "0-1")
    assert [i for i, _ in selected] == [0, 1]
    assert len(selected[0][1]) == 100


def test_select_without_spec_returns_all():
    chunks = gen_content._chunk(_words(30), 10)
    selected = gen_content._select(chunks, None)
    assert [i for i, _ in selected] == [0, 1, 2]


def test_select_out_of_range_raises_system_exit():
    chunks = gen_content._chunk(_words(30), 10)  # 3 chunks: 0,1,2
    with pytest.raises(SystemExit):
        gen_content._select(chunks, "0-5")


def test_words_per_call_gives_122_chunks_over_full_seed_set():
    total_words = config.DAYS * config.WORDS_PER_DAY  # 365 * 30 = 10950
    assert config.WORDS_PER_CALL == 90
    chunks = gen_content._chunk(_words(total_words), config.WORDS_PER_CALL)
    assert len(chunks) == 122


def test_run_words_chunk_skips_existing(tmp_path):
    words = _words(3)
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call") as call:
        out = tmp_path / "words" / "chunk_000.json"
        out.parent.mkdir(parents=True)
        out.write_text(json.dumps({"words": []}))
        gen_content.run_words_chunk(0, words, force=False)
    call.assert_not_called()


def test_run_words_chunk_rejects_on_mismatch(tmp_path):
    words = _words(3)
    bad_result = {"words": [{"word": "w1"}, {"word": "w2"}, {"word": "renamed"}]}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=bad_result):
        gen_content.run_words_chunk(0, words, force=False)
    assert not (tmp_path / "words" / "chunk_000.json").exists()


def test_run_words_chunk_rejects_on_count_mismatch(tmp_path):
    words = _words(3)
    bad_result = {"words": [{"word": "w1"}, {"word": "w2"}]}  # short by one
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=bad_result):
        gen_content.run_words_chunk(0, words, force=False)
    assert not (tmp_path / "words" / "chunk_000.json").exists()


def test_run_words_chunk_writes_on_match(tmp_path):
    words = _words(3)
    result = {"words": [{"word": "W1"}, {"word": " w2 "}, {"word": "w3"}]}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=result):
        gen_content.run_words_chunk(0, words, force=False)
    saved = json.loads((tmp_path / "words" / "chunk_000.json").read_text())
    assert saved == result


def test_run_words_chunk_failed_continues(tmp_path):
    words = _words(3)
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", side_effect=ClaudeCallError("boom")):
        gen_content.run_words_chunk(0, words, force=False)
        gen_content.run_words_chunk(1, words, force=False)
    assert not (tmp_path / "words" / "chunk_000.json").exists()
    assert not (tmp_path / "words" / "chunk_001.json").exists()


def test_run_patterns_chunk_rejects_on_mismatch(tmp_path):
    patterns = _patterns(3)
    bad_result = {"patterns": [{"pattern": "other ~"}] * 3}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=bad_result):
        gen_content.run_patterns_chunk(0, patterns, force=False)
    assert not (tmp_path / "patterns" / "chunk_000.json").exists()


def test_run_words_chunk_accepts_reordered_punctuation_varied_list(tmp_path):
    words = _words(3)  # w1, w2, w3
    result = {"words": [{"word": "W3."}, {"word": "w1"}, {"word": " W2, "}]}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=result):
        gen_content.run_words_chunk(0, words, force=False)
    assert (tmp_path / "words" / "chunk_000.json").exists()


def test_run_words_chunk_rejects_truly_different_word(tmp_path):
    words = _words(3)  # w1, w2, w3
    result = {"words": [{"word": "w1"}, {"word": "w2"}, {"word": "totally-different"}]}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=result):
        gen_content.run_words_chunk(0, words, force=False)
    assert not (tmp_path / "words" / "chunk_000.json").exists()


def test_run_patterns_chunk_accepts_reordered_punctuation_varied_list(tmp_path):
    patterns = _patterns(3)  # p1 ~, p2 ~, p3 ~ (all "~" no trailing punctuation)
    result = {"patterns": [{"pattern": "p3 ~."}, {"pattern": "P1 ~"}, {"pattern": " p2 ~ "}]}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=result):
        gen_content.run_patterns_chunk(0, patterns, force=False)
    assert (tmp_path / "patterns" / "chunk_000.json").exists()


def test_chunks_for_days_words():
    with mock.patch("pipeline.gen_content.config.WORDS_PER_DAY", 30), \
         mock.patch("pipeline.gen_content.config.WORDS_PER_CALL", 90):
        # days 1-3 -> word indices 0-89 -> chunk 0; day 4 -> indices 90-119 -> chunk 1
        assert gen_content.chunks_for_days("words", [1, 2, 3]) == [0]
        assert gen_content.chunks_for_days("words", [4]) == [1]
        assert gen_content.chunks_for_days("words", [3, 4]) == [0, 1]


def test_chunks_for_days_patterns():
    with mock.patch("pipeline.gen_content.config.PATTERNS_PER_DAY", 10), \
         mock.patch("pipeline.gen_content.config.PATTERNS_PER_CALL", 50):
        assert gen_content.chunks_for_days("patterns", [1, 5]) == [0]
        assert gen_content.chunks_for_days("patterns", [6]) == [1]


def test_chunks_for_days_dialogues():
    with mock.patch("pipeline.gen_content.config.DIALOGUES_PER_CALL", 10):
        assert gen_content.chunks_for_days("dialogues", [1, 10]) == [0]
        assert gen_content.chunks_for_days("dialogues", [11]) == [1]


def test_dialogues_prompt_contains_day_header_and_patterns():
    words = [{"word": f"w{i}"} for i in range(1, 6)]
    patterns = [{"pattern": f"p{i} ~", "category": "business", "day": 1, "seq": i} for i in range(1, 11)]
    prompt = gen_content.build_dialogues_prompt([1], words, patterns)
    assert "### Day 1" in prompt
    assert "p1 ~" in prompt and "p2 ~" in prompt and "p3 ~" in prompt
    assert "w1" in prompt


def test_run_dialogues_chunk_rejects_on_day_mismatch(tmp_path):
    words = [{"word": f"w{i}"} for i in range(1, 6)]
    patterns = [{"pattern": f"p{i} ~", "category": "business", "day": 1, "seq": i} for i in range(1, 11)]
    bad_result = {"dialogues": [{"day": 2, "title_ko": "", "situation_ko": "", "lines": [], "quiz": []}]}
    with mock.patch("pipeline.gen_content.config.OUT_DIR", tmp_path), \
         mock.patch("pipeline.gen_content.call", return_value=bad_result):
        gen_content.run_dialogues_chunk(0, [1], words, patterns, force=False)
    assert not (tmp_path / "dialogues" / "chunk_000.json").exists()


def test_main_retry_failed_without_failed_json_exits(tmp_path):
    import sys
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    with mock.patch("pipeline.gen_content.config.OUT_DIR", out_dir), \
         mock.patch.object(sys, "argv", ["gen_content", "words", "--retry-failed"]):
        with pytest.raises(SystemExit):
            gen_content.main()


def test_reconcile_tolerates_one_in_twenty_and_restores_seed_text():
    from pipeline.gen_content import reconcile
    req = [f"w{i}" for i in range(40)]
    items = [{"word": w} for w in req]
    items[7]["word"] = "w7-corrected"; items[30]["word"] = "w30-alt"
    out = reconcile(items, "word", req)
    assert out is not None and out[7]["word"] == "w7" and out[30]["word"] == "w30"
    items = [{"word": w} for w in req]; items[1]["word"] = "x"; items[2]["word"] = "y"; items[3]["word"] = "z"
    assert reconcile(items, "word", req) is None          # 3 > 40//20
    assert reconcile([{"word": "a"}], "word", ["a", "b"]) is None   # length mismatch
