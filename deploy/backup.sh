#!/usr/bin/env bash
# deploy/backup.sh — nightly progress.db backup with 30-day rotation
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS="$ROOT/backups"
mkdir -p "$BACKUPS"
sqlite3 "$ROOT/data/progress.db" ".backup '$BACKUPS/progress-$(date +%F).db'"
find "$BACKUPS" -name 'progress-*.db' -mtime +30 -delete
echo "backup ok: $(ls -1 "$BACKUPS" | wc -l) files"
