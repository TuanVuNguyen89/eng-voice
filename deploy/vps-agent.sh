#!/usr/bin/env bash
# eng-voice VPS agent. The server does NOT need a git clone.
#
# Install once (run as a user in the "docker" group):
#   curl -fsSL -H "Authorization: token <GH_TOKEN>" \
#     https://raw.githubusercontent.com/TuanVuNguyen89/eng-voice/main/deploy/vps-agent.sh -o vps-agent.sh
#   bash vps-agent.sh install
#
# Cron runs "poll" every minute (installed automatically):
#   checks the latest commit on main, waits until CI has pushed its images to Docker Hub,
#   downloads docker-compose.prod.yml and this script at that commit, then deploys.
set -euo pipefail

REPO="${REPO:-TuanVuNguyen89/eng-voice}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/eng-voice}"
GH_TOKEN="${GH_TOKEN:-}"   # only needed while the repo is private: fine-grained PAT, Contents: read-only

API="https://api.github.com/repos/$REPO"
RAW="https://raw.githubusercontent.com/$REPO"
STATE="$APP_DIR/.deployed-sha"
LOCK="$APP_DIR/.deploy.lock"
COMPOSE="$APP_DIR/docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env"

log() { echo "$(date -Is) $*"; }

gh_get() {   # gh_get <url> [accept] -> stdout
  local args=(-fsSL)
  [ -n "$GH_TOKEN" ] && args+=(-H "Authorization: token $GH_TOKEN")
  [ -n "${2:-}" ] && args+=(-H "Accept: $2")
  curl "${args[@]}" "$1"
}

# Latest commit SHA on $BRANCH. Uses ETag so an unchanged branch returns 304,
# which does not count against GitHub's unauthenticated rate limit (60 requests/hour).
latest_sha() {
  local hdr="$APP_DIR/.gh-headers" body="$APP_DIR/.gh-body"
  local args=(-sS -D "$hdr" -o "$body" -w "%{http_code}" -H "Accept: application/vnd.github.sha")
  [ -f "$APP_DIR/.gh-etag" ] && args+=(-H "If-None-Match: $(cat "$APP_DIR/.gh-etag")")
  [ -n "$GH_TOKEN" ] && args+=(-H "Authorization: token $GH_TOKEN")
  local code
  code="$(curl "${args[@]}" "$API/commits/$BRANCH")" || return 1
  case "$code" in
    200)
      tr -d '
' < "$body" > "$APP_DIR/.gh-sha"
      tr -d '
' < <(grep -i '^etag:' "$hdr" | sed 's/^[Ee][Tt]ag: *//') > "$APP_DIR/.gh-etag"
      cat "$APP_DIR/.gh-sha" ;;
    304) cat "$APP_DIR/.gh-sha" ;;
    *) return 1 ;;
  esac
}

load_env() {
  if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
}

# ---------------- install ----------------

ask_env() {
  echo "Thiết lập $ENV_FILE (Enter để dùng giá trị trong ngoặc)"
  local ns key base model port
  read -r -p "Docker Hub username (IMAGE_NAMESPACE): " ns </dev/tty
  read -r -p "OPENAI_API_KEY (Enter nếu chưa có): " key </dev/tty
  read -r -p "OPENAI_BASE_URL [https://api.openai.com/v1]: " base </dev/tty
  read -r -p "OPENAI_MODEL [gpt-4o-mini]: " model </dev/tty
  read -r -p "APP_PORT (chỉ bind 127.0.0.1) [9120]: " port </dev/tty
  read -r -p "GH_TOKEN để đọc repo private (Enter nếu repo public): " GH_TOKEN_IN </dev/tty
  [ -n "$ns" ] || { echo "Bắt buộc có Docker Hub username"; exit 1; }
  base=${base:-https://api.openai.com/v1}
  model=${model:-gpt-4o-mini}
  port=${port:-9120}

  umask 077
  cat > "$ENV_FILE" <<EOF
IMAGE_NAMESPACE=$ns
OPENAI_API_KEY=$key
OPENAI_BASE_URL=$base
OPENAI_MODEL=$model
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_ROOT_USER=eng$(openssl rand -hex 4)
MINIO_ROOT_PASSWORD=$(openssl rand -hex 24)
APP_PORT=$port
GH_TOKEN=$GH_TOKEN_IN
EOF
  umask 022
  log "đã tạo $ENV_FILE (mật khẩu DB và MinIO được tạo ngẫu nhiên)"
}

install_cmd() {
  command -v docker >/dev/null || { echo "Chưa có docker. Cài Docker trước rồi chạy lại."; exit 1; }
  docker compose version >/dev/null 2>&1 || { echo "Chưa có docker compose plugin."; exit 1; }
  command -v openssl >/dev/null || { echo "Cần openssl."; exit 1; }

  if [ ! -d "$APP_DIR" ]; then
    sudo mkdir -p "$APP_DIR" && sudo chown "$(id -u):$(id -g)" "$APP_DIR"
  fi
  cp -f "$0" "$APP_DIR/vps-agent.sh" 2>/dev/null || true
  chmod +x "$APP_DIR/vps-agent.sh" 2>/dev/null || true

  if [ ! -f "$ENV_FILE" ]; then
    ask_env
  else
    log ".env đã có, giữ nguyên"
  fi
  load_env

  local port="${APP_PORT:-9120}"
  if ss -ltn 2>/dev/null | grep -q ":$port "; then
    log "CẢNH BÁO: port $port đang bị dùng, đổi APP_PORT trong .env"
  fi

  local cron_line="* * * * * bash $APP_DIR/vps-agent.sh poll >> $APP_DIR/deploy.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "vps-agent.sh poll" || true; echo "$cron_line" ) | crontab -
  log "đã bật cron: mỗi phút"

  poll_cmd
  log "cài đặt xong. Log: tail -f $APP_DIR/deploy.log"
}

# ---------------- poll / deploy ----------------

poll_cmd() {
  mkdir -p "$APP_DIR"
  exec 9>"$LOCK"
  if command -v flock >/dev/null && ! flock -n 9; then
    log "đang có lần deploy khác, bỏ qua"
    exit 0
  fi

  load_env
  : "${IMAGE_NAMESPACE:?thiếu IMAGE_NAMESPACE trong $ENV_FILE}"

  local latest deployed
  if ! latest="$(latest_sha)"; then
    log "không đọc được GitHub (repo private cần GH_TOKEN trong .env?)"
    exit 0
  fi
  deployed="$(cat "$STATE" 2>/dev/null || true)"
  [ "$latest" = "$deployed" ] && exit 0

  for img in backend frontend; do
    if ! docker manifest inspect "$IMAGE_NAMESPACE/eng-voice-$img:$latest" >/dev/null 2>&1; then
      log "image $img của ${latest:0:7} chưa có trên Docker Hub, thử lại lần sau"
      exit 0
    fi
  done

  old="${deployed:-none}"
  log "deploy ${latest:0:7} (trước đó: ${old:0:7})"
  # Download the compose file and this agent at the exact commit being deployed.
  gh_get "$RAW/$latest/deploy/vps-agent.sh" > "$APP_DIR/vps-agent.sh.new"
  gh_get "$RAW/$latest/docker-compose.prod.yml" > "$COMPOSE.new"
  mv "$COMPOSE.new" "$COMPOSE"
  mv "$APP_DIR/vps-agent.sh.new" "$APP_DIR/vps-agent.sh"

  cd "$APP_DIR"
  export IMAGE_TAG="$latest"
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d --remove-orphans

  local port="${APP_PORT:-9120}"
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; then
      echo "$latest" > "$STATE"
      docker image prune -f >/dev/null 2>&1 || true
      log "deploy xong: ${latest:0:7}"
      exit 0
    fi
    sleep 2
  done
  log "health check thất bại, log backend:"
  docker compose -f docker-compose.prod.yml logs --tail 60 backend >&2 || true
  exit 1
}

case "${1:-}" in
  install) install_cmd ;;
  poll) poll_cmd ;;
  *) echo "usage: bash vps-agent.sh install | poll"; exit 1 ;;
esac
