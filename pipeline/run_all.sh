#!/usr/bin/env bash
# Launch full content generation as 4 background processes (words x2, patterns, dialogues).
# Re-runnable: existing chunk files are skipped. Logs in pipeline/out/gen_*.log
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p pipeline/out
PY=.venv/bin/python
nohup $PY -m pipeline.gen_content words --chunks 0-60    > pipeline/out/gen_words_a.log   2>&1 &
nohup $PY -m pipeline.gen_content words --chunks 61-121  > pipeline/out/gen_words_b.log   2>&1 &
nohup $PY -m pipeline.gen_content patterns --chunks 0-72 > pipeline/out/gen_patterns.log  2>&1 &
nohup $PY -m pipeline.gen_content dialogues --chunks 0-36 > pipeline/out/gen_dialogues.log 2>&1 &
echo "started 4 generators; progress: ls pipeline/out/{words,patterns,dialogues} | wc -l"
