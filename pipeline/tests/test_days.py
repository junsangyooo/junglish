from unittest import mock

import pytest

from pipeline import days


def _words(n):
    return [{"word": f"w{i}"} for i in range(1, n + 1)]


def _patterns(n, category="business"):
    return [{"pattern": f"p{i} ~", "category": category, "day": 1, "seq": i} for i in range(1, n + 1)]


def test_parse_days():
    assert days.parse_days("1-3,7") == [1, 2, 3, 7]


def test_day_inputs_slices_words_and_filters_patterns():
    all_patterns = [{"pattern": f"p{i}", "category": "business", "day": (i - 1) // 10 + 1, "seq": (i - 1) % 10 + 1}
                     for i in range(1, 31)]
    with mock.patch("pipeline.days.config.WORDS_PER_DAY", 2):
        w, p = days.day_inputs(2, _words(6), all_patterns)
    assert [x["word"] for x in w] == ["w3", "w4"]
    assert [x["seq"] for x in p] == list(range(1, 11)) and all(x["day"] == 2 for x in p)


def test_day_inputs_raises_on_empty():
    with pytest.raises(ValueError):
        days.day_inputs(1, [], [])


def test_dialogue_picks_prefers_business_on_odd_day():
    p = _patterns(2, "business") + _patterns(2, "daily")
    patterns, words = days.dialogue_picks(1, _words(5), p)
    assert patterns == ["p1 ~", "p2 ~", "p1 ~"]  # first 2 business, then first non-business (rest[0])
    assert words == ["w1", "w2", "w3", "w4", "w5"]


def test_dialogue_picks_prefers_daily_on_even_day():
    biz = _patterns(1, "business")
    daily = _patterns(2, "daily")
    p = biz + daily
    patterns, words = days.dialogue_picks(2, _words(5), p)
    # preferred = daily patterns first, then fill from rest (business)
    assert patterns[0] in {x["pattern"] for x in daily}
    assert len(patterns) == 3
    assert words == ["w1", "w2", "w3", "w4", "w5"]


def test_dialogue_picks_fills_up_when_fewer_than_three_preferred():
    biz = _patterns(1, "business")   # only 1 business pattern
    daily = _patterns(5, "daily")
    p = biz + daily
    patterns, _ = days.dialogue_picks(1, _words(5), p)  # odd day -> prefers business
    assert len(patterns) == 3
    assert biz[0]["pattern"] in patterns  # the one business pattern must be included


def test_has_hangul():
    assert days.has_hangul("옆집 애들이 시끄럽다")
    assert not days.has_hangul("The kids next door are loud")


def test_repair_pair_swaps_when_en_key_holds_korean():
    obj = {"example_daily": "옆집 애들이 너무 시끄럽게 놀았어.", "example_daily_ko": "The kids next door were so loud."}
    days.repair_pair(obj, "example_daily", "example_daily_ko")
    assert obj["example_daily"] == "The kids next door were so loud."
    assert obj["example_daily_ko"] == "옆집 애들이 너무 시끄럽게 놀았어."


def test_repair_pair_noop_when_already_correct():
    obj = {"example_daily": "The kids next door were so loud.", "example_daily_ko": "옆집 애들이 너무 시끄럽게 놀았어."}
    days.repair_pair(obj, "example_daily", "example_daily_ko")
    assert obj["example_daily"] == "The kids next door were so loud."
    assert obj["example_daily_ko"] == "옆집 애들이 너무 시끄럽게 놀았어."


def test_repair_pair_noop_when_both_contain_hangul():
    obj = {"example_daily": "옆집 애들 A", "example_daily_ko": "옆집 애들 B"}
    days.repair_pair(obj, "example_daily", "example_daily_ko")
    assert obj["example_daily"] == "옆집 애들 A"
    assert obj["example_daily_ko"] == "옆집 애들 B"
