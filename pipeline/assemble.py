"""Stitch out/{words,patterns,dialogues}/chunk_*.json into out/day_N.json."""
import argparse
import json

from pipeline import config
from pipeline.days import day_inputs, norm_key, parse_days, repair_pair


def _load_chunks(kind: str) -> list[dict]:
    d = config.OUT_DIR / kind
    if not d.exists():
        return []
    return [json.loads(f.read_text()) for f in sorted(d.glob("chunk_*.json"))]


def _index_words(chunks: list[dict]) -> dict[str, dict]:
    words = [w for c in chunks for w in c.get("words", [])]
    for w in words:
        repair_pair(w, "example_work", "example_work_ko")
        repair_pair(w, "example_daily", "example_daily_ko")
    return {norm_key(w["word"]): w for w in words}


def _index_patterns(chunks: list[dict]) -> dict[str, dict]:
    patterns = [p for c in chunks for p in c.get("patterns", [])]
    for p in patterns:
        repair_pair(p, "example_1", "example_1_ko")
        repair_pair(p, "example_2", "example_2_ko")
    return {norm_key(p["pattern"]): p for p in patterns}


def _index_dialogues(chunks: list[dict]) -> dict[int, dict]:
    return {d["day"]: d for c in chunks for d in c.get("dialogues", [])}


def assemble_day(day: int, seed_words: list[dict], seed_patterns: list[dict],
                  word_idx: dict, pattern_idx: dict, dialogue_idx: dict) -> dict | None:
    exp_words, exp_patterns = day_inputs(day, seed_words, seed_patterns)
    # write the seed's own text over the returned key so validate/build_db see the canonical form
    words = [{**word_idx[norm_key(w["word"])], "word": w["word"]} for w in exp_words
             if norm_key(w["word"]) in word_idx]
    patterns = [{**pattern_idx[norm_key(p["pattern"])], "pattern": p["pattern"]} for p in exp_patterns
                if norm_key(p["pattern"]) in pattern_idx]
    dialogue = dialogue_idx.get(day)
    missing_words = len(exp_words) - len(words)
    missing_patterns = len(exp_patterns) - len(patterns)
    missing_dialogue = 0 if dialogue else 1
    if missing_words or missing_patterns or missing_dialogue:
        print(f"day {day}: skipped (missing: words {missing_words}, "
              f"patterns {missing_patterns}, dialogue {missing_dialogue})")
        return None
    return {
        "day": day,
        "words": words,
        "patterns": patterns,
        "dialogue": {k: v for k, v in dialogue.items() if k != "day"},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", default=f"1-{config.DAYS}")
    args = ap.parse_args()

    seed_words = json.loads((config.SEEDS_DIR / "words.json").read_text())
    seed_patterns = json.loads((config.SEEDS_DIR / "patterns.json").read_text())
    word_idx = _index_words(_load_chunks("words"))
    pattern_idx = _index_patterns(_load_chunks("patterns"))
    dialogue_idx = _index_dialogues(_load_chunks("dialogues"))

    config.OUT_DIR.mkdir(parents=True, exist_ok=True)
    n = 0
    for day in parse_days(args.days):
        try:
            data = assemble_day(day, seed_words, seed_patterns, word_idx, pattern_idx, dialogue_idx)
        except ValueError:
            continue  # no seed data for this day
        if data is None:
            continue
        out_path = config.OUT_DIR / f"day_{day}.json"
        tmp = out_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1))
        tmp.replace(out_path)
        n += 1
    print(f"assembled {n} days")


if __name__ == "__main__":
    main()
