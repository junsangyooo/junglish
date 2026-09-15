"""Thin wrapper around `claude -p` with structured output."""
import json
import subprocess
import time

from pipeline import config

USAGE_LIMIT_MARKERS = ("usage limit", "rate limit", "limit reached", "hit your limit", "session limit", "hit your")
WAIT_SECONDS = 15 * 60
CALL_TIMEOUT = 5400  # 90 min; measured Sonnet 100-word call takes ~47 min


class ClaudeCallError(Exception):
    pass


def _is_usage_limit(text: str) -> bool:
    t = text.lower()
    return any(m in t for m in USAGE_LIMIT_MARKERS)


def call(prompt: str, schema: dict, *, model: str = config.WORDS_MODEL,
         max_wait_rounds: int = 12) -> dict:
    cmd = [
        "claude", "-p",
        "--no-session-persistence",
        "--tools", "",
        "--setting-sources", "",
        "--model", model,
        "--effort", config.CLAUDE_EFFORT,
        "--output-format", "json",
        "--json-schema", json.dumps(schema),
    ]
    for _ in range(max_wait_rounds + 1):
        try:
            proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=CALL_TIMEOUT)
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            raise ClaudeCallError(str(e)) from e
        try:
            payload = json.loads(proc.stdout)
        except json.JSONDecodeError as e:
            raise ClaudeCallError(f"non-json output: {proc.stdout[:300]} / {proc.stderr[:300]}") from e
        if not payload.get("is_error") and payload.get("structured_output") is not None:
            return payload["structured_output"]
        msg = str(payload.get("result", "")) + proc.stderr
        if _is_usage_limit(msg):
            print(f"[claude_call] usage limit, waiting {WAIT_SECONDS // 60} min", flush=True)
            time.sleep(WAIT_SECONDS)
            continue
        raise ClaudeCallError(msg[:500])
    raise ClaudeCallError("gave up after repeated usage-limit waits")
