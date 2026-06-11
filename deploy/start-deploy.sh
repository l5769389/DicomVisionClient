#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dicomvision}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-same-origin}"
WEB_PORT="${WEB_PORT:-127.0.0.1:18080}"
LOG_DIR="${DEPLOY_LOG_DIR:-/var/log/dicomvision}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/dicomvision-deploy.lock}"

mkdir -p "$LOG_DIR"

log_file="$LOG_DIR/deploy-$(date +%Y%m%d%H%M%S).log"
runner_script="$APP_DIR/.dicomvision-deploy-runner.sh"

cat > "$runner_script" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

exec 9>"${DEPLOY_LOCK_FILE:-/var/lock/dicomvision-deploy.lock}"
echo "Waiting for DicomVision deployment lock..."
flock 9

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
