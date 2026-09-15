"""Build seeds/words.json: ordered list of target words."""
import argparse
import csv
import json
import random
from pathlib import Path

from wordfreq import top_n_list, zipf_frequency

from pipeline import config
from pipeline.claude_call import call
from pipeline.schemas import WORD_CLEAN

DICT_PATH = Path("/usr/share/dict/words")
DICT_WORDS: set[str] = set()
if DICT_PATH.exists():
    DICT_WORDS = {w.strip() for w in DICT_PATH.read_text().splitlines() if w.strip().islower()}

BASIC_WORDS: set[str] = set()   # filled by load_sources (NGSL rank <= NGSL_SKIP_RANK)


def _read_csv(path: Path):
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        return list(csv.reader(f))


def load_sources(raw_dir: Path, *, ngsl_file="NGSL_12_stats.csv",
                 bsl_file="BSL_120_stats.csv",
                 nawl_file="NAWL_12_lemmatized_for_research.csv") -> dict[str, dict]:
    BASIC_WORDS.clear()
    src: dict[str, dict] = {}
    for row in _read_csv(raw_dir / ngsl_file)[1:]:
        word, rank = row[0].strip().lower(), int(row[1])
        if rank <= config.NGSL_SKIP_RANK:
            BASIC_WORDS.add(word)
            continue
        src.setdefault(word, {"source": "ngsl", "ngsl_rank": rank})
    for row in _read_csv(raw_dir / bsl_file)[1:]:
        word = row[0].strip().lower()
        if word and word not in BASIC_WORDS:
            src.setdefault(word, {"source": "bsl", "ngsl_rank": None})
    for row in _read_csv(raw_dir / nawl_file):
        word = row[0].strip().lower()
        if word and word not in BASIC_WORDS:
            src.setdefault(word, {"source": "nawl", "ngsl_rank": None})
    return src


def _acceptable(word: str) -> bool:
    return word.isalpha() and word.islower() and len(word) >= 3 \
        and word in DICT_WORDS and word not in BASIC_WORDS


def build_candidates(sources: dict[str, dict], top_n: int = 100000) -> list[dict]:
    if not DICT_WORDS:
        raise SystemExit(f"dictionary file missing: {DICT_PATH}")
    words = dict(sources)
    for w in top_n_list("en", top_n):
        if w not in words and _acceptable(w):
            words[w] = {"source": "wordfreq", "ngsl_rank": None}
    out = [{"word": w, "source": m["source"], "zipf": zipf_frequency(w, "en")}
           for w, m in words.items() if _acceptable(w) or m["source"] != "wordfreq"]
    out.sort(key=lambda c: (-c["zipf"], c["word"]))
    return out


CLEAN_PROMPT = """You are filtering an English vocabulary list for an intermediate Korean learner.
From the list below, return in "reject" every item that is NOT a base-form, standard English word worth learning:
inflected forms (plurals, -ed, -ing, comparatives), proper nouns, abbreviations, slang, misspellings,
non-English words, interjections, and function words (articles, pronouns, prepositions, conjunctions, auxiliaries).
Keep ordinary nouns, verbs, adjectives, adverbs. Return only the rejected items, spelled exactly as given.

LIST:
{words}"""


def clean_batch(words: list[str]) -> set[str]:
    result = call(CLEAN_PROMPT.format(words="\n".join(words)), WORD_CLEAN)
    return set(result["reject"]) & set(words)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offset", type=int, default=0, help="skip first N final words (for extending)")
    ap.add_argument("--skip-clean", action="store_true")
    ap.add_argument("--batch", type=int, default=300)
    ap.add_argument("--seed", type=int, default=42, help="shuffle seed for day assignment")
    args = ap.parse_args()

    cand_path = config.SEEDS_DIR / "candidates.json"
    if cand_path.exists():
        cands = json.loads(cand_path.read_text())
    else:
        cands = build_candidates(load_sources(config.RAW_DIR))
        cand_path.write_text(json.dumps(cands, ensure_ascii=False, indent=1))
    print(f"candidates: {len(cands)}")

    rejected_path = config.SEEDS_DIR / "rejected.json"
    rejected = set(json.loads(rejected_path.read_text())) if rejected_path.exists() else set()
    checked_path = config.SEEDS_DIR / "checked.json"
    checked = set(json.loads(checked_path.read_text())) if checked_path.exists() else set()

    need = args.offset + config.TOTAL_WORDS
    if not args.skip_clean:
        pending = [c["word"] for c in cands if c["word"] not in checked]
        kept = sum(1 for c in cands if c["word"] in checked and c["word"] not in rejected)
        for i in range(0, len(pending), args.batch):
            if kept >= need:
                break
            batch = pending[i:i + args.batch]
            rejected |= clean_batch(batch)
            checked |= set(batch)
            kept += len(batch) - len(set(batch) & rejected)
            rejected_path.write_text(json.dumps(sorted(rejected), ensure_ascii=False, indent=1))
            checked_path.write_text(json.dumps(sorted(checked), ensure_ascii=False, indent=1))
            print(f"cleaned {len(checked)} / kept {kept}", flush=True)

    final = [c for c in cands if c["word"] not in rejected][args.offset:need]
    if len(final) < config.TOTAL_WORDS:
        raise SystemExit(f"only {len(final)} words, need {config.TOTAL_WORDS}")
    for i, c in enumerate(final, start=1):
        c["rank"] = args.offset + i          # frequency rank, kept for reference
    random.Random(args.seed).shuffle(final)   # day assignment is positional: mix difficulties across days
    (config.SEEDS_DIR / "words.json").write_text(json.dumps(final, ensure_ascii=False, indent=1))
    print(f"wrote {len(final)} words")


if __name__ == "__main__":
    main()
