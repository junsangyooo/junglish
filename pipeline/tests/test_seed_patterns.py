from unittest import mock

import pytest

from pipeline import seed_patterns


def _p(pattern, category="business", difficulty=1):
    return {"pattern": pattern, "category": category, "difficulty": difficulty, "topic": "t"}


def test_normalize_strips_case_punct_and_placeholder_variants():
    assert seed_patterns.normalize("I'd rather ~ than ~.") == seed_patterns.normalize("i d rather ... than ...")


def test_dedupe_keeps_first():
    items = [_p("Could you ~?"), _p("could you ..."), _p("Would you mind ~ing?")]
    out = seed_patterns.dedupe(items)
    assert [i["pattern"] for i in out] == ["Could you ~?", "Would you mind ~ing?"]


def test_interleave_keeps_ratio_and_order():
    by_cat = {"a": [_p(f"a{i}", "a") for i in range(4)], "b": [_p(f"b{i}", "b") for i in range(2)]}
    out = [i["pattern"] for i in seed_patterns.interleave(by_cat)]
    assert len(out) == 6
    assert out.index("a0") < out.index("a1") < out.index("a2")
    assert out[:3].count("b0") + out[:3].count("b1") == 1      # b spread evenly


def test_assign_days_chunks_by_patterns_per_day():
    with mock.patch("pipeline.seed_patterns.config.PATTERNS_PER_DAY", 2):
        out = seed_patterns.assign_days([_p(str(i)) for i in range(5)])
    assert [(i["day"], i["seq"]) for i in out] == [(1, 1), (1, 2), (2, 1), (2, 2), (3, 1)]


def test_fetch_category_calls_until_quota_met():
    responses = [
        {"patterns": [{"pattern": "A ~", "difficulty": 1, "topic": "t"}, {"pattern": "a ~", "difficulty": 1, "topic": "t"}]},
        {"patterns": [{"pattern": "B ~", "difficulty": 2, "topic": "t"}]},
    ]
    with mock.patch("pipeline.seed_patterns.call", side_effect=responses):
        out = seed_patterns.fetch_category("business", quota=2, topics=["t"], per_call=2)
    assert [i["pattern"] for i in out] == ["A ~", "B ~"]


def test_fetch_category_calls_on_progress_each_call():
    responses = [
        {"patterns": [{"pattern": "A ~", "difficulty": 1, "topic": "t"}]},
        {"patterns": [{"pattern": "B ~", "difficulty": 2, "topic": "t"}]},
    ]
    cb = mock.Mock()
    with mock.patch("pipeline.seed_patterns.call", side_effect=responses):
        seed_patterns.fetch_category("business", quota=2, topics=["t"], per_call=1, on_progress=cb)
    assert cb.call_count == 2


def test_fetch_category_raises_on_stall():
    response = {"patterns": [{"pattern": "A ~", "difficulty": 1, "topic": "t"}]}
    with mock.patch("pipeline.seed_patterns.call", return_value=response):
        with pytest.raises(SystemExit):
            seed_patterns.fetch_category("business", quota=5, topics=["t"], per_call=1)
