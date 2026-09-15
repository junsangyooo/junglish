"""Day-indexing helpers shared by generation, assembly, and validation."""
import re

from pipeline import config

_HANGUL_RE = re.compile(r"[가-힣]")


def norm_key(s: str) -> str:
    """Normalize a word/pattern string for tolerant matching (whitespace, case, trailing punctuation)."""
    return s.strip().lower().rstrip(".,!?;:")


def has_hangul(s: str) -> bool:
    return bool(_HANGUL_RE.search(s))


def repair_pair(obj: dict, en_key: str, ko_key: str) -> None:
    """Swap obj[en_key]/obj[ko_key] in place if they're in the wrong language."""
    if has_hangul(obj.get(en_key, "")) and not has_hangul(obj.get(ko_key, "")):
        obj[en_key], obj[ko_key] = obj[ko_key], obj[en_key]


def parse_days(spec: str) -> list[int]:
    days = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            days.extend(range(int(a), int(b) + 1))
        else:
            days.append(int(part))
    return days


def day_inputs(day: int, words: list[dict], patterns: list[dict]) -> tuple[list[dict], list[dict]]:
    start = (day - 1) * config.WORDS_PER_DAY
    w = words[start:start + config.WORDS_PER_DAY]
    p = sorted((x for x in patterns if x["day"] == day), key=lambda x: x["seq"])
    if not w or not p:
        raise ValueError(f"day {day}: no inputs")
    return w, p


def dialogue_picks(day: int, day_words: list[dict], day_patterns: list[dict]) -> tuple[list[str], list[str]]:
    """Pick the three dialogue patterns and first five words for a day's dialogue."""
    preferred_category = "business" if day % 2 else "daily"
    preferred = [x for x in day_patterns if x["category"] == preferred_category]
    rest = [x for x in day_patterns if x["category"] != preferred_category]
    patterns = [x["pattern"] for x in (preferred + rest)[:3]]
    words = [x["word"] for x in day_words[:5]]
    return patterns, words
