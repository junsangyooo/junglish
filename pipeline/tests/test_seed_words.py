from pathlib import Path
from unittest import mock

import pytest

from pipeline import seed_words

FIX = Path(__file__).parent / "fixtures"


def test_load_sources_merges_and_skips_basic_ngsl():
    src = seed_words.load_sources(FIX, ngsl_file="ngsl.csv", bsl_file="bsl.csv", nawl_file="nawl.csv")
    assert "the" not in src and "be" not in src          # rank <= NGSL_SKIP_RANK skipped
    assert src["negotiate"]["ngsl_rank"] == 2001
    assert src["invoice"]["source"] == "bsl"
    assert src["absorb"]["source"] == "nawl"
    assert src["leverage"]["source"] == "ngsl"          # first source wins


def test_build_candidates_filters_and_sorts():
    src = {"negotiate": {"source": "ngsl", "ngsl_rank": 801},
           "invoice": {"source": "bsl", "ngsl_rank": None}}
    with mock.patch("pipeline.seed_words.top_n_list", return_value=["the", "zz", "negotiate", "hello", "Paris"]), \
         mock.patch("pipeline.seed_words.zipf_frequency", side_effect=lambda w, _: {"negotiate": 4.0, "invoice": 3.5, "hello": 5.0}.get(w, 0.0)), \
         mock.patch("pipeline.seed_words.DICT_WORDS", {"negotiate", "invoice", "hello", "the"}), \
         mock.patch("pipeline.seed_words.BASIC_WORDS", {"the"}):
        cands = seed_words.build_candidates(src, top_n=5)
    words = [c["word"] for c in cands]
    assert words == ["hello", "negotiate", "invoice"]   # zipf desc, 'the' basic, 'zz' not in dict, 'Paris' not lowercase


def test_clean_batch_returns_rejected_set():
    with mock.patch("pipeline.seed_words.call", return_value={"reject": ["Paris", "goin"]}):
        rejected = seed_words.clean_batch(["Paris", "goin", "negotiate"])
    assert rejected == {"Paris", "goin"}


def test_load_sources_does_not_accumulate_basic_words_across_calls():
    first = seed_words.load_sources(FIX, ngsl_file="ngsl.csv", bsl_file="bsl.csv", nawl_file="nawl.csv")
    second = seed_words.load_sources(FIX, ngsl_file="ngsl.csv", bsl_file="bsl.csv", nawl_file="nawl.csv")
    assert first == second
    assert seed_words.BASIC_WORDS == {"the", "be"}


def test_build_candidates_raises_without_system_dictionary():
    with mock.patch("pipeline.seed_words.DICT_WORDS", set()):
        with pytest.raises(SystemExit):
            seed_words.build_candidates({}, top_n=1)
