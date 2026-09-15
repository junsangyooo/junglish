from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEEDS_DIR = ROOT / "pipeline" / "seeds"
RAW_DIR = SEEDS_DIR / "raw"
OUT_DIR = ROOT / "pipeline" / "out"
DATA_DIR = ROOT / "data"

DAYS = 365
WORDS_PER_DAY = 30
PATTERNS_PER_DAY = 10

NGSL_SKIP_RANK = 2000         # skip NGSL rank <= 2000 (known words)
TOTAL_WORDS = DAYS * WORDS_PER_DAY
TOTAL_PATTERNS = DAYS * PATTERNS_PER_DAY

CATEGORY_QUOTA = {
    "grammar": 500,
    "business": 1250,
    "daily": 1200,
    "collocation": 700,
}
assert sum(CATEGORY_QUOTA.values()) == TOTAL_PATTERNS

WORDS_MODEL = "sonnet";    WORDS_PER_CALL = 90
PATTERNS_MODEL = "sonnet"; PATTERNS_PER_CALL = 50
DIALOGUES_MODEL = "opus";  DIALOGUES_PER_CALL = 10
CLAUDE_EFFORT = "medium"
