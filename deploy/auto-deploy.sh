#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/debian/Websites/BIES"
LOG_FILE="/home/debian/Websites/BIES/deploy/deploy.log"
DEPLOYED_FILE="/home/debian/Websites/BIES/deploy/.deployed-commit"
LOCK_FILE="/home/debian/Websites/BIES/deploy/.deploy-lock"
BRANCH="main"
MAX_LOG_LINES=500

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

# Trim log if it gets too long
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE")" -gt "$MAX_LOG_LINES" ]; then
  tail -n 300 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

cd "$REPO_DIR"

# Prevent concurrent deploys
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  log "Deploy already in progress, skipping."
  exit 0
fi
trap 'rm -rf "$LOCK_FILE"' EXIT

# Fetch latest from remote
git fetch origin "$BRANCH" --quiet 2>>"$LOG_FILE"

DEPLOYED=$(cat "$DEPLOYED_FILE" 2>/dev/null || echo "none")
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$DEPLOYED" = "$REMOTE" ]; then
  exit 0
fi

log "New commit detected: ${DEPLOYED:0:7} -> ${REMOTE:0:7}"

git checkout "$BRANCH" >> "$LOG_FILE" 2>&1 || true
if ! git reset --hard "origin/$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "ERROR: git reset failed."
  exit 1
fi

# Export git metadata for Docker build args
export GIT_COMMIT=$(git rev-parse HEAD)
export GIT_COMMIT_SHORT=$(git rev-parse --short HEAD)
export GIT_BRANCH="$BRANCH"
export GIT_COMMITTED_AT=$(git log -1 --format=%cI)

log "Building containers..."
if ! docker compose build --no-cache >> "$LOG_FILE" 2>&1; then
  log "ERROR: docker compose build failed"
  exit 1
fi

log "Starting containers..."
if ! docker compose up -d >> "$LOG_FILE" 2>&1; then
  log "ERROR: docker compose up failed"
  exit 1
fi

git rev-parse "origin/$BRANCH" > "$DEPLOYED_FILE"
log "Deploy complete: now at $(git rev-parse --short HEAD)"
