#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dicomvision}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://114.67.114.128}"
WEB_PORT="${WEB_PORT:-80}"

CLIENT_REPO="${CLIENT_REPO:-https://github.com/l5769389/DicomVisionClient.git}"
SERVER_REPO="${SERVER_REPO:-https://github.com/l5769389/DicomVisionServer.git}"

mkdir -p "$APP_DIR"

if [ ! -d "$APP_DIR/DicomVisionClient/.git" ]; then
  git clone "$CLIENT_REPO" "$APP_DIR/DicomVisionClient"
else
  git -C "$APP_DIR/DicomVisionClient" fetch origin main
  git -C "$APP_DIR/DicomVisionClient" reset --hard origin/main
fi

if [ ! -d "$APP_DIR/DicomVisionServer/.git" ]; then
  git clone "$SERVER_REPO" "$APP_DIR/DicomVisionServer"
else
  git -C "$APP_DIR/DicomVisionServer" fetch origin main
  git -C "$APP_DIR/DicomVisionServer" reset --hard origin/main
fi

cat > "$APP_DIR/DicomVisionClient/deploy/.env" <<ENV
PUBLIC_ORIGIN=$PUBLIC_ORIGIN
WEB_PORT=$WEB_PORT
WEB_UPLOAD_MAX_FILES=5000
WEB_UPLOAD_MAX_BYTES=2147483648
PACS_WADO_CACHE_MAX_AGE_SECONDS=86400
ENV

cd "$APP_DIR/DicomVisionClient/deploy"
docker compose --env-file .env -f docker-compose.yml up -d --build
docker image prune -f

docker compose --env-file .env -f docker-compose.yml ps
