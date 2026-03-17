#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/debian/Websites/BIES"
LOG_FILE="/home/debian/Websites/BIES/deploy/deploy.log"
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

# Fetch latest from remote
git fetch origin "$BRANCH" --quiet 2>>"$LOG_FILE"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

log "New commit detected: ${LOCAL:0:7} -> ${REMOTE:0:7}"

git checkout "$BRANCH" >> "$LOG_FILE" 2>&1 || true
if ! git reset --hard "origin/$BRANCH" >> "$LOG_FILE" 2>&1; then
  log "ERROR: git reset failed."
  exit 1
fi

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

log "Deploy complete: now at $(git rev-parse --short HEAD)"
