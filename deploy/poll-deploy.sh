#!/usr/bin/env bash
# Pull-based deploy, run by cron on the VPS every 5 minutes. GitHub never connects to the VPS.
#   */5 * * * * bash /opt/eng-voice/deploy/poll-deploy.sh >> $HOME/eng-voice-deploy.log 2>&1
#
# Deploys origin/main when (a) it differs from the last deployed commit and
# (b) CI has already pushed both images tagged with that commit SHA.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/eng-voice}"
STATE_FILE="${STATE_FILE:-$HOME/.eng-voice-deployed-sha}"
IMAGE_PREFIX="${IMAGE_PREFIX:-ghcr.io/tuanvunguyen89/eng-voice}"
LOCK_FILE="${LOCK_FILE:-$HOME/.eng-voice-deploy.lock}"

log() { echo "$(date -Is) $*"; }

# Never run two deploys at once (a slow deploy can overlap the next cron tick).
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "previous deploy still running, skipping"
    exit 0
  fi
fi

cd "$APP_DIR"
git fetch --quiet --depth 1 origin main
LATEST="$(git rev-parse origin/main)"
DEPLOYED="$(cat "$STATE_FILE" 2>/dev/null || true)"

if [ "$LATEST" = "$DEPLOYED" ]; then
  exit 0   # nothing new; stay silent so the log stays readable
fi

for img in backend frontend; do
  if ! docker manifest inspect "$IMAGE_PREFIX-$img:$LATEST" >/dev/null 2>&1; then
    log "images for ${LATEST:0:7} not ready yet ($img), will retry next run"
    exit 0
  fi
done

OLD="${DEPLOYED:-none}"
log "deploying ${LATEST:0:7} (previously: ${OLD:0:7})"
if bash "$APP_DIR/deploy/deploy.sh" "$LATEST"; then
  echo "$LATEST" > "$STATE_FILE"
  log "done: ${LATEST:0:7}"
else
  log "deploy of ${LATEST:0:7} FAILED; will retry on next run"
  exit 1
fi
