"""Generate words/patterns/dialogues content chunks via `claude -p`.

Each kind is generated independently in fixed-size chunks so several processes
can run in parallel on disjoint --chunks ranges. Chunks are written to
out/{kind}/chunk_NNN.json and later stitched together by pipeline.assemble.
"""
import argparse
import json

from pipeline import config
from pipeline.claude_call import ClaudeCallError, call
from pipeline.days import day_inputs, dialogue_picks, norm_key, parse_days
from pipeline.schemas import DIALOGUES_CHUNK, PATTERNS_CHUNK, WORDS_CHUNK

WORDS_HEADER = """You are writing vocabulary study cards for an intermediate Korean adult learner
who works at a robotics startup and needs both work English and everyday English.

Produce exactly these {n} words, in this order, spelled exactly: {words}

For each word: pos (v/n/adj/adv/prep/...; join with "/" if several), ipa (American, with slashes),
meaning_ko (1-2 core senses, concise), example_work (a sentence at work), example_daily (a sentence
in daily life), Korean translations of both examples, and 2-4 collocations.

## Korean style
Natural spoken Korean: 해요체 for work examples, 반말 allowed for casual daily examples.
Never translate word-for-word — write what a Korean speaker would actually say, not a stiff,
word-for-word Sino-Korean dictionary gloss.

## Anti-template rules
- Every example must be a different, specific situation with its own sentence structure —
  never reuse a sentence frame across words.
- Collocations must be real native combinations a fluent speaker would actually say
  (e.g. "turn left", "vast majority"), never grammatical fillers like "the X",
  "related to X", "highly X".

Return `words` as an array of exactly {n} objects, in the same order as listed above.
"""

PATTERNS_HEADER = """You are writing pattern/grammar study cards for an intermediate Korean adult
learner who works at a robotics startup and needs both work English and everyday English.

Produce exactly these {n} patterns, in this order, keeping the pattern text exactly as given
(category shown in brackets for context only, do not include it in your output):
{patterns}

For each pattern: meaning_ko (natural spoken Korean with a short usage hint in parentheses),
grammar_note_ko (one line explaining the grammar/usage point; use "" if none),
register (one of: formal, neutral, casual), two example sentences with Korean translations,
and a cloze: cloze_sentence is a full sentence using the pattern with ONE word of the FIXED
pattern text (never the variable ~ part) replaced by exactly three underscores `___`;
cloze_answer is that word exactly and must appear in the pattern text.

## Korean style
Natural spoken Korean: 해요체 for work examples, 반말 allowed for casual daily examples.
Never translate word-for-word — write what a Korean speaker would actually say, not a stiff,
word-for-word Sino-Korean dictionary gloss.

## Anti-template rules
- The two examples for a pattern must be different, specific situations — never near-identical
  sentences with one word swapped.
- Never reuse a sentence structure across different patterns in this batch.

Return `patterns` as an array of exactly {n} objects, in the same order as listed above.
"""

DIALOGUES_HEADER = """You are writing short two-person dialogues that practice already-taught
material for an intermediate Korean adult learner (robotics startup; needs both work English
and everyday English).

For each day below: two people with real first names have a natural 6-10 line dialogue for the
given situation. The learner (first speaker) and their conversation partner. The dialogue MUST
naturally use the three listed patterns and MUST use at least four of the five listed words.
Give title_ko and a one-line situation_ko. Provide text_ko for each line.

quiz: exactly 3 items, each blanking out a pattern's realization in the line where it appears.
- line_index: 0-based index of the line
- blank_text: the exact substring of that line to hide — the realization of the pattern in that
  line (the fixed words of the pattern, not the surrounding words), and must never contain '~'
- answer: same as blank_text
- pattern: the exact text of the dialogue pattern (one of the three listed for that day) this hides

## Korean style
Natural spoken Korean: 해요체 for work examples, 반말 allowed for casual daily examples.
Never translate word-for-word — write what a Korean speaker would actually say, not a stiff,
word-for-word Sino-Korean dictionary gloss.

## Anti-template rules
- Never reuse the same two character names or the same dialogue structure across days.
- Each dialogue's situation must feel specific and different from the others in this batch.
"""

DIALOGUE_DAY_SECTION = """
### Day {day}
Situation: {situation}
Must naturally use these three patterns: {patterns}
Must use at least four of these five words: {words}
"""

DIALOGUES_FOOTER = """
Return `dialogues` as an array with one object per day above, in the same order, each carrying
its `day` number.
"""


def _chunk(items: list, size: int) -> list[list]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def _select(chunks: list, spec: str | None) -> list[tuple[int, list]]:
    idxs = parse_days(spec) if spec else list(range(len(chunks)))
    bad = [i for i in idxs if not (0 <= i < len(chunks))]
    if bad:
        raise SystemExit(f"--chunks references out-of-range index(es) {bad} (valid: 0-{len(chunks) - 1})")
    return [(i, chunks[i]) for i in idxs]


def chunks_for_days(kind: str, days_list: list[int]) -> list[int]:
    """Map failed day numbers to the chunk indices that own them, for --retry-failed."""
    chunks = set()
    if kind == "words":
        for day in days_list:
            start = (day - 1) * config.WORDS_PER_DAY
            for idx in range(start, start + config.WORDS_PER_DAY):
                chunks.add(idx // config.WORDS_PER_CALL)
    elif kind == "patterns":
        for day in days_list:
            start = (day - 1) * config.PATTERNS_PER_DAY
            for idx in range(start, start + config.PATTERNS_PER_DAY):
                chunks.add(idx // config.PATTERNS_PER_CALL)
    else:  # dialogues
        for day in days_list:
            chunks.add((day - 1) // config.DIALOGUES_PER_CALL)
    return sorted(chunks)


def _atomic_write(path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1))
    tmp.replace(path)


def build_words_prompt(chunk_words: list[dict]) -> str:
    names = [w["word"] for w in chunk_words]
    return WORDS_HEADER.format(n=len(names), words=", ".join(names))


def build_patterns_prompt(chunk_patterns: list[dict]) -> str:
    lines = "\n".join(f"- {p['pattern']}  [{p['category']}]" for p in chunk_patterns)
    return PATTERNS_HEADER.format(n=len(chunk_patterns), patterns=lines)


def build_dialogues_prompt(days: list[int], words: list[dict], patterns: list[dict]) -> str:
    sections = []
    for day in days:
        w, p = day_inputs(day, words, patterns)
        pat_texts, word_texts = dialogue_picks(day, w, p)
        situation = ("at work (meeting, email follow-up, scheduling, customer call, etc.)" if day % 2
                     else "daily life (restaurant, travel, friends, shopping, health, etc.)")
        sections.append(DIALOGUE_DAY_SECTION.format(
            day=day, situation=situation,
            patterns=", ".join(pat_texts), words=", ".join(word_texts)))
    return DIALOGUES_HEADER + "".join(sections) + DIALOGUES_FOOTER


def reconcile(items: list[dict], key: str, requested: list[str]) -> list[dict] | None:
    """Accept a chunk whose returned key texts match the requested ones, allowing at most
    len//20 positional mismatches (e.g. the model 'corrected' a dash or a spelling); the
    seed text is written back over those items so downstream lookups by seed text succeed."""
    if len(items) != len(requested):
        return None
    got = [norm_key(it.get(key, "")) for it in items]
    exp = [norm_key(r) for r in requested]
    if sorted(got) == sorted(exp):
        return items
    mismatched = [i for i, (g, e) in enumerate(zip(got, exp)) if g != e]
    if len(mismatched) > len(requested) // 20:
        return None
    for i in mismatched:
        print(f"  reconciled {key}: {items[i].get(key)!r} -> {requested[i]!r}", flush=True)
        items[i][key] = requested[i]
    return items


def run_words_chunk(idx: int, chunk_words: list[dict], *, force: bool) -> None:
    out_path = config.OUT_DIR / "words" / f"chunk_{idx:03d}.json"
    if out_path.exists() and not force:
        return
    try:
        result = call(build_words_prompt(chunk_words), WORDS_CHUNK, model=config.WORDS_MODEL)
    except ClaudeCallError as e:
        print(f"chunk {idx:03d}: FAILED {e}", flush=True)
        return
    items = reconcile(result.get("words", []), "word", [w["word"] for w in chunk_words])
    if items is None:
        print(f"chunk {idx:03d}: REJECTED (word list mismatch)", flush=True)
        return
    result["words"] = items
    _atomic_write(out_path, result)
    print(f"chunk {idx:03d}: written", flush=True)


def run_patterns_chunk(idx: int, chunk_patterns: list[dict], *, force: bool) -> None:
    out_path = config.OUT_DIR / "patterns" / f"chunk_{idx:03d}.json"
    if out_path.exists() and not force:
        return
    try:
        result = call(build_patterns_prompt(chunk_patterns), PATTERNS_CHUNK, model=config.PATTERNS_MODEL)
    except ClaudeCallError as e:
        print(f"chunk {idx:03d}: FAILED {e}", flush=True)
        return
    items = reconcile(result.get("patterns", []), "pattern", [p["pattern"] for p in chunk_patterns])
    if items is None:
        print(f"chunk {idx:03d}: REJECTED (pattern list mismatch)", flush=True)
        return
    result["patterns"] = items
    _atomic_write(out_path, result)
    print(f"chunk {idx:03d}: written", flush=True)


def run_dialogues_chunk(idx: int, chunk_days: list[int], words: list[dict], patterns: list[dict],
                         *, force: bool) -> None:
    out_path = config.OUT_DIR / "dialogues" / f"chunk_{idx:03d}.json"
    if out_path.exists() and not force:
        return
    try:
        result = call(build_dialogues_prompt(chunk_days, words, patterns), DIALOGUES_CHUNK,
                      model=config.DIALOGUES_MODEL)
    except ClaudeCallError as e:
        print(f"chunk {idx:03d}: FAILED {e}", flush=True)
        return
    got = {d.get("day") for d in result.get("dialogues", [])}
    if got != set(chunk_days):
        print(f"chunk {idx:03d}: REJECTED (day set mismatch)", flush=True)
        return
    _atomic_write(out_path, result)
    print(f"chunk {idx:03d}: written", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["words", "patterns", "dialogues"])
    ap.add_argument("--chunks", default=None, help="e.g. 0-27 (chunk indices, 0-based)")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--retry-failed", action="store_true",
                     help="regenerate only the chunks covering days listed in out/failed.json")
    args = ap.parse_args()

    idxs = None  # None => resolve selection via --chunks below
    force = args.force
    if args.retry_failed:
        failed_path = config.OUT_DIR / "failed.json"
        if not failed_path.exists():
            raise SystemExit("out/failed.json not found — run `python -m pipeline.validate` first")
        failed_days = json.loads(failed_path.read_text())
        idxs = chunks_for_days(args.kind, failed_days)
        print(f"retry-failed: {args.kind} chunks {idxs}", flush=True)
        force = True

    if args.kind == "words":
        words = json.loads((config.SEEDS_DIR / "words.json").read_text())
        chunks = _chunk(words, config.WORDS_PER_CALL)
        selected = [(i, chunks[i]) for i in idxs] if idxs is not None else _select(chunks, args.chunks)
        for idx, chunk_words in selected:
            run_words_chunk(idx, chunk_words, force=force)
    elif args.kind == "patterns":
        patterns = json.loads((config.SEEDS_DIR / "patterns.json").read_text())
        patterns = sorted(patterns, key=lambda p: (p["day"], p["seq"]))
        chunks = _chunk(patterns, config.PATTERNS_PER_CALL)
        selected = [(i, chunks[i]) for i in idxs] if idxs is not None else _select(chunks, args.chunks)
        for idx, chunk_patterns in selected:
            run_patterns_chunk(idx, chunk_patterns, force=force)
    else:
        words = json.loads((config.SEEDS_DIR / "words.json").read_text())
        patterns = json.loads((config.SEEDS_DIR / "patterns.json").read_text())
        days = list(range(1, config.DAYS + 1))
        chunks = _chunk(days, config.DIALOGUES_PER_CALL)
        selected = [(i, chunks[i]) for i in idxs] if idxs is not None else _select(chunks, args.chunks)
        for idx, chunk_days in selected:
            run_dialogues_chunk(idx, chunk_days, words, patterns, force=force)


if __name__ == "__main__":
    main()
