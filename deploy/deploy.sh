#!/usr/bin/env bash
# Runs on the VPS. Usage: ./deploy.sh <image-tag>   (the tag is the git commit SHA built by CI)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/eng-voice}"
TAG="${1:?usage: deploy.sh <image-tag>}"

cd "$APP_DIR"
if [ -f .env ]; then set -a; . ./.env; set +a; fi   # APP_PORT etc. for the health check
git fetch --depth 1 origin main
git reset --hard origin/main      # keeps the server in sync with the repo; .env is untracked and untouched

export IMAGE_TAG="$TAG"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Wait for the frontend to answer through the published port before reporting success.
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT:-9120}/api/health" >/dev/null 2>&1; then
    echo "deploy ok: tag=$TAG"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done
echo "health check failed; recent logs:" >&2
docker compose -f docker-compose.prod.yml logs --tail 80 backend >&2
exit 1
