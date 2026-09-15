"""Build seeds/patterns.json: 3,650 sentence patterns with day assignment."""
import json
import math
import random
import re
from typing import Callable

from pipeline import config
from pipeline.claude_call import call
from pipeline.schemas import PATTERN_LIST

CATEGORY_DESC = {
    "grammar": "grammar-driven sentence patterns (a usable frame that embodies one grammar point, e.g. 'If I had known, I would have ~')",
    "business": "expressions used at work: meetings, email, negotiation, presentations, feedback, scheduling",
    "daily": "everyday spoken expressions, idioms and phrasal verbs natives actually use",
    "collocation": "high-frequency collocations (verb+noun, adj+noun, etc.) as a short chunk, e.g. 'make a decision', 'strike a balance'",
}

FETCH_PROMPT = """Generate {n} English {category} items for an intermediate Korean adult learner (business + daily life).
Category definition: {desc}
Difficulty target: {difficulty} on a 1-5 scale (1 = very common/simple, 5 = advanced/nuanced).
Topics to draw from (mix them): {topics}
Rules:
- Use "~" as the placeholder for variable parts. Example: "I was wondering if you could ~"
- Each item must be a reusable pattern or chunk, not a full one-off sentence.
- No duplicates, no trivial variants of each other.
- Do NOT include any of these already collected items: {existing}
"""


def normalize(pattern: str) -> str:
    s = pattern.lower().replace("...", "~").replace("…", "~")
    s = re.sub(r"[^a-z0-9~ ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def dedupe(items: list[dict]) -> list[dict]:
    seen, out = set(), []
    for it in items:
        key = normalize(it["pattern"])
        if key and key not in seen:
            seen.add(key)
            out.append(it)
    return out


def fetch_category(category: str, quota: int, topics: list[str], per_call: int = 60, *,
                    initial: list[dict] | None = None,
                    on_progress: Callable[[list[dict]], None] | None = None) -> list[dict]:
    items: list[dict] = list(initial) if initial else []
    difficulty = 1
    rng = random.Random(42)
    max_calls = 3 * math.ceil(quota / per_call)
    stalls = 0
    calls = 0
    while len(items) < quota:
        calls += 1
        if calls > max_calls:
            raise SystemExit(f"[{category}] exceeded {max_calls} calls at {len(items)}/{quota}")
        picked = rng.sample(topics, k=min(4, len(topics)))
        existing = ", ".join(i["pattern"] for i in items[-80:]) or "(none)"
        res = call(FETCH_PROMPT.format(n=per_call, category=category, desc=CATEGORY_DESC[category],
                                       difficulty=difficulty, topics=", ".join(picked), existing=existing),
                   PATTERN_LIST)
        new = [{"pattern": p["pattern"].strip(), "category": category,
                "difficulty": int(p["difficulty"]), "topic": p["topic"]} for p in res["patterns"]]
        before = len(items)
        items = dedupe(items + new)
        if on_progress is not None:
            on_progress(items)
        if len(items) == before:
            stalls += 1
            if stalls >= 3:
                raise SystemExit(f"[{category}] stalled at {len(items)}/{quota}")
        else:
            stalls = 0
        difficulty = 1 + (len(items) * 5) // max(quota, 1)      # ramp 1 -> 5 as we fill
        difficulty = min(difficulty, 5)
        print(f"[{category}] {len(items)}/{quota}", flush=True)
    return items[:quota]


def interleave(by_category: dict[str, list[dict]]) -> list[dict]:
    """Merge lists keeping each list's order and spreading categories proportionally."""
    queues = {c: list(v) for c, v in by_category.items() if v}
    totals = {c: len(v) for c, v in queues.items()}
    taken = {c: 0 for c in queues}
    out = []
    while queues:
        c = min(queues, key=lambda k: taken[k] / totals[k])
        out.append(queues[c].pop(0))
        taken[c] += 1
        if not queues[c]:
            del queues[c]
    return out


def assign_days(items: list[dict]) -> list[dict]:
    out = []
    for i, it in enumerate(items):
        out.append({**it, "day": i // config.PATTERNS_PER_DAY + 1, "seq": i % config.PATTERNS_PER_DAY + 1})
    return out


def main():
    topics = json.loads((config.SEEDS_DIR / "topics.json").read_text())
    cache = config.SEEDS_DIR / "patterns_raw.json"
    raw = json.loads(cache.read_text()) if cache.exists() else {}
    for cat, quota in config.CATEGORY_QUOTA.items():
        target = math.ceil(quota * 1.05)
        existing = raw.get(cat, [])
        if len(existing) >= target:
            continue

        def on_progress(items, cat=cat):
            raw[cat] = items
            cache.write_text(json.dumps(raw, ensure_ascii=False, indent=1))

        raw[cat] = fetch_category(cat, target, topics[cat], initial=existing or None, on_progress=on_progress)
        cache.write_text(json.dumps(raw, ensure_ascii=False, indent=1))
    by_cat = {c: sorted(v, key=lambda p: p["difficulty"]) for c, v in raw.items()}
    merged = dedupe(interleave(by_cat))
    if len(merged) < config.TOTAL_PATTERNS:
        raise SystemExit(f"only {len(merged)} unique patterns after cross-category dedupe; rerun to top up")
    final = assign_days(merged[:config.TOTAL_PATTERNS])
    (config.SEEDS_DIR / "patterns.json").write_text(json.dumps(final, ensure_ascii=False, indent=1))
    print(f"wrote {len(final)} patterns")


if __name__ == "__main__":
    main()
