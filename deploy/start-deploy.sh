#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dicomvision}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://114.67.114.128}"
WEB_PORT="${WEB_PORT:-80}"
LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/dicomvision}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/dicomvision-deploy.lock}"

mkdir -p "$LOG_DIR"

log_file="$LOG_DIR/deploy-$(date +%Y%m%d%H%M%S).log"
runner_script="$APP_DIR/.dicomvision-deploy-runner.sh"

cat > "$runner_script" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

exec 9>"${DEPLOY_LOCK_FILE:-/var/lock/dicomvision-deploy.lock}"
if ! flock -n 9; then
  echo "Another DicomVision deployment is already running."
  exit 0
fi

bash "$APP_DIR/DicomVisionClient/deploy/deploy.sh"
SCRIPT

chmod +x "$runner_script"

nohup env \
  APP_DIR="$APP_DIR" \
  PUBLIC_ORIGIN="$PUBLIC_ORIGIN" \
  WEB_PORT="$WEB_PORT" \
  SKIP_GIT_SYNC="${SKIP_GIT_SYNC:-0}" \
  DEPLOY_LOCK_FILE="$LOCK_FILE" \
  bash "$runner_script" > "$log_file" 2>&1 < /dev/null &

echo "Started DicomVision deployment."
echo "PID: $!"
echo "Log: $log_file"
