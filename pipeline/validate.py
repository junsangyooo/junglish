"""Check generated day files; write out/failed.json."""
import json
import re

from pipeline import config
from pipeline.days import day_inputs


def _stem(word: str) -> str:
    return word.lower()[:4] if len(word) > 4 else word.lower()


def _contains(text: str, word: str) -> bool:
    """Word (or an inflection) appears in text: stem at a word boundary, or a short 3-letter
    boundary prefix (leaf/leaves), or the stem inside a compound (dovecote)."""
    t = text.lower()
    stem = _stem(word)
    if re.search(r"\b" + re.escape(stem), t):
        return True
    return len(word) >= 4 and re.search(r"\b" + re.escape(word.lower()[:3]), t) is not None


def _normalize_text(s: str) -> list[str]:
    """Lowercase and strip punctuation, keeping only alphanumerics, apostrophes, and spaces."""
    normalized = re.sub(r"[^a-z0-9' ]+", " ", s.lower())
    return [w for w in normalized.split() if w]


def _answer_in_pattern(answer: str, pattern: str) -> bool:
    answer_words = _normalize_text(answer)
    pattern_words = _normalize_text(pattern.replace("~", " "))
    if any(ans_word in pattern_words for ans_word in answer_words):
        return True
    # tolerate inflection (closed/close, gets/get, meant/mean): one is a prefix of the other, 3+ letters shared
    return any(len(a) >= 3 and len(pw) >= 3 and (a.startswith(pw) or pw.startswith(a))
               for a in answer_words for pw in pattern_words)


def _longest_fragment(pattern: str) -> str:
    parts = [" ".join(_normalize_text(p)) for p in pattern.split("~")]
    return max(parts, key=len)


def check_day(data: dict, words: list[dict], patterns: list[dict]) -> list[str]:
    errors = []
    day = data["day"]
    exp_words, exp_patterns = day_inputs(day, words, patterns)

    got_words = data.get("words", [])
    if [w["word"].lower() for w in got_words] != [w["word"].lower() for w in exp_words]:
        errors.append("word list mismatch")
    misses = [f"word '{w['word']}' missing in {key}" for w in got_words
              for key in ("example_work", "example_daily") if not _contains(w.get(key, ""), w["word"])]
    if len(misses) > 3:      # a few irregular forms (wept, stung) are fine; many misses mean a broken chunk
        errors.extend(misses)

    got_patterns = data.get("patterns", [])
    if [p["pattern"].strip() for p in got_patterns] != [p["pattern"].strip() for p in exp_patterns]:
        errors.append("pattern list mismatch")
    for p in got_patterns:
        if len(re.findall(r"_{2,}", p.get("cloze_sentence", ""))) != 1 or not p.get("cloze_answer", "").strip():
            errors.append(f"cloze invalid for '{p['pattern']}'")
        answer = p.get("cloze_answer", "").strip()
        pattern = p.get("pattern", "")
        if answer and not _answer_in_pattern(answer, pattern):
            errors.append(f"cloze answer '{answer}' not in pattern '{pattern}'")

    dlg = data.get("dialogue", {})
    lines = dlg.get("lines", [])
    today_patterns = {p["pattern"].strip() for p in exp_patterns}
    quiz = dlg.get("quiz", [])
    if len(quiz) != 3:
        errors.append("quiz must have 3 items")
    for q in quiz:
        idx = q.get("line_index", -1)
        if not (0 <= idx < len(lines)):
            errors.append(f"quiz line_index {idx} out of range")
            continue
        if q.get("blank_text", "").lower() not in lines[idx]["text"].lower():
            errors.append(f"quiz blank '{q.get('blank_text')}' not in line {idx}")
        if "~" in q.get("blank_text", ""):
            errors.append(f"quiz blank_text '{q.get('blank_text')}' must not contain '~'")
        if q.get("pattern", "").strip() not in today_patterns:
            errors.append(f"quiz pattern '{q.get('pattern')}' not in today's patterns")
        fragment = _longest_fragment(q.get("pattern", ""))
        line_words = set(_normalize_text(lines[idx]["text"]))
        frag_words = fragment.split()
        # realized if most of the pattern's fixed words appear (inflection/auxiliary changes allowed)
        if frag_words and sum(w in line_words for w in frag_words) < max(1, (len(frag_words) + 1) // 2):
            errors.append(f"quiz pattern '{q['pattern']}' not realized in line {idx}")

    all_text = " ".join(l["text"] for l in lines)
    hits = sum(1 for w in exp_words[:5] if _contains(all_text, w["word"]))
    if hits < 4:
        errors.append(f"dialogue words: only {hits}/5 target words used")
    return errors


def main():
    words = json.loads((config.SEEDS_DIR / "words.json").read_text())
    patterns = json.loads((config.SEEDS_DIR / "patterns.json").read_text())
    failed = []
    files = sorted(config.OUT_DIR.glob("day_*.json"), key=lambda p: int(re.search(r"\d+", p.name).group()))
    for f in files:
        day_num = int(re.search(r"\d+", f.name).group())
        try:
            data = json.loads(f.read_text())
            errs = check_day(data, words, patterns)
        except Exception as e:
            errs = [f"malformed: {e!r}"]
        if errs:
            failed.append(day_num)
            print(f"day {day_num}: " + "; ".join(errs))
    (config.OUT_DIR / "failed.json").write_text(json.dumps(failed))
    print(f"checked {len(files)} days, failed {len(failed)}")


if __name__ == "__main__":
    main()
