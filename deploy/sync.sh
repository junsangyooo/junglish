#!/usr/bin/env bash
# Sync this repo to a server over rsync/ssh and optionally rebuild the container.
# Usage: deploy/sync.sh [--build]
# Env: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_PATH (relative to the remote home, default apps/junglish)
#      Either export them, or point DEPLOY_ENV at a private env file:  DEPLOY_ENV=~/.secrets.env deploy/sync.sh --build
set -euo pipefail
if [ -n "${DEPLOY_ENV:-}" ]; then set -a; source "$DEPLOY_ENV"; set +a; fi
: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}"
DEPLOY_PATH="${DEPLOY_PATH:-apps/junglish}"   # relative to the remote home directory
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
rsync -az --delete -e "ssh -i $DEPLOY_SSH_KEY" \
  --exclude '.git' --exclude 'node_modules' --exclude 'app/.svelte-kit' --exclude 'app/build' \
  --exclude 'data' --exclude 'backups' --exclude 'pipeline/out' --exclude 'pipeline/seeds/raw' \
  --exclude '.venv' --exclude '.superpowers' --exclude 'docs' --exclude '.env' \
  "$ROOT/" "$DEST"
echo "synced to $DEST"
if [ "${1:-}" = "--build" ]; then
  ssh -i "$DEPLOY_SSH_KEY" "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose -f deploy/docker-compose.yml up -d --build && docker compose -f deploy/docker-compose.yml ps"
fi
