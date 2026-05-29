#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dicomvision}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://114.67.114.128}"
WEB_PORT="${WEB_PORT:-80}"

CLIENT_REPO="${CLIENT_REPO:-https://github.com/l5769389/DicomVisionClient.git}"
SERVER_REPO="${SERVER_REPO:-https://github.com/l5769389/DicomVisionServer.git}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
GIT_TIMEOUT_SECONDS="${GIT_TIMEOUT_SECONDS:-300}"

mkdir -p "$APP_DIR"

git_with_timeout() {
  timeout "$GIT_TIMEOUT_SECONDS" git \
    -c http.lowSpeedLimit=1000 \
    -c http.lowSpeedTime=30 \
    "$@"
}

retry_git() {
  local attempt

  for attempt in 1 2 3; do
    if git_with_timeout "$@"; then
      return 0
    fi
    echo "Git command failed on attempt $attempt: git $*" >&2
    sleep $((attempt * 5))
  done

  return 1
}

sync_repo() {
  local repo_url="$1"
  local target_dir="$2"

  if [ -d "$target_dir/.git" ]; then
    git -C "$target_dir" remote set-url origin "$repo_url"
    retry_git -C "$target_dir" fetch --prune origin "$DEPLOY_BRANCH"
    git -C "$target_dir" reset --hard "origin/$DEPLOY_BRANCH"
    return
  fi

  if [ -e "$target_dir" ]; then
    local backup_dir
    backup_dir="${target_dir}.non-git.$(date +%Y%m%d%H%M%S)"
    echo "Moving existing non-git directory $target_dir to $backup_dir"
    mv "$target_dir" "$backup_dir"
  fi

  retry_git clone --branch "$DEPLOY_BRANCH" --depth 1 "$repo_url" "$target_dir"
}

if [ "${SKIP_GIT_SYNC:-0}" = "1" ]; then
  echo "Skipping git sync; using uploaded source directories."
else
  sync_repo "$CLIENT_REPO" "$APP_DIR/DicomVisionClient"
  sync_repo "$SERVER_REPO" "$APP_DIR/DicomVisionServer"
fi

cat > "$APP_DIR/DicomVisionClient/deploy/.env" <<ENV
PUBLIC_ORIGIN=$PUBLIC_ORIGIN
WEB_PORT=$WEB_PORT
VITE_WEB_APP_MODE=demo-web
EXPOSE_API_DOCS=false
WEB_SAMPLE_DICOM_PATH=/data/demo/P113_MP1
WEB_UPLOAD_MAX_FILES=5000
WEB_UPLOAD_MAX_BYTES=2147483648
WEB_UPLOAD_MAX_AGE_SECONDS=1800
WEB_UPLOAD_CLEANUP_INTERVAL_SECONDS=1800
PACS_WADO_CACHE_MAX_AGE_SECONDS=86400
ENV

cd "$APP_DIR/DicomVisionClient/deploy"
docker compose --env-file .env -f docker-compose.yml up -d --build
docker image prune -f

docker compose --env-file .env -f docker-compose.yml ps
