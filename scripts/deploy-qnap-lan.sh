#!/usr/bin/env bash
set -euo pipefail

QNAP_HOST="${QNAP_HOST:-192.168.10.156}"
QNAP_USER="${QNAP_USER:-motomichi}"
QNAP_APP_ROOT="${QNAP_APP_ROOT:-/share/CACHEDEV1_DATA/homes/motomichi/retirement-life-planner}"
APP_DIR="$(cd "$(dirname "$0")/../apps/retirement-life-planner" && pwd)"
APACHE_BIN="/mnt/ext/opt/apache/bin/apache"
PORT="${PORT:-5175}"

cd "$APP_DIR"
npm run build

ssh "${QNAP_USER}@${QNAP_HOST}" \
  QNAP_APP_ROOT="${QNAP_APP_ROOT}" \
  QNAP_HOST="${QNAP_HOST}" \
  PORT="${PORT}" \
  APACHE_BIN="${APACHE_BIN}" \
  'sh -s' <<'REMOTE'
set -e
APP_ROOT="${QNAP_APP_ROOT}"
SITE_DIR="$APP_ROOT/site"
LOG_DIR="$APP_ROOT/logs"
mkdir -p "$SITE_DIR" "$LOG_DIR"
cat > "$APP_ROOT/apache-retirement-life-planner.conf" <<APACHE
ServerRoot "/mnt/ext/opt/apache"
Listen 0.0.0.0:${PORT}
ServerName ${QNAP_HOST}
PidFile "${APP_ROOT}/apache.pid"
ErrorLog "${APP_ROOT}/logs/apache-error.log"
CustomLog "${APP_ROOT}/logs/apache-access.log" common
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule unixd_module modules/mod_unixd.so
TypesConfig /etc/config/apache/mime.types
DocumentRoot "${APP_ROOT}/site"
DirectoryIndex index.html
<Directory "${APP_ROOT}/site">
  Options -Indexes +FollowSymLinks
  AllowOverride None
  Require all granted
</Directory>
APACHE
cat > "$APP_ROOT/start-retirement-life-planner.sh" <<SH
#!/bin/sh
set -eu
APP_ROOT=${APP_ROOT}
CONF=\$APP_ROOT/apache-retirement-life-planner.conf
PID_FILE=\$APP_ROOT/apache.pid
if [ -f "\$PID_FILE" ] && kill -0 "\$(cat "\$PID_FILE")" 2>/dev/null; then
  exit 0
fi
${APACHE_BIN} -f "\$CONF" -k start
SH
chmod +x "$APP_ROOT/start-retirement-life-planner.sh"
cat > "$APP_ROOT/stop-retirement-life-planner.sh" <<SH
#!/bin/sh
set -eu
APP_ROOT=${APP_ROOT}
CONF=\$APP_ROOT/apache-retirement-life-planner.conf
PID_FILE=\$APP_ROOT/apache.pid
if [ -f "\$PID_FILE" ]; then
  ${APACHE_BIN} -f "\$CONF" -k stop 2>/dev/null || true
  rm -f "\$PID_FILE"
fi
SH
chmod +x "$APP_ROOT/stop-retirement-life-planner.sh"
REMOTE

rsync -az --delete "$APP_DIR/dist/" "${QNAP_USER}@${QNAP_HOST}:${QNAP_APP_ROOT}/site/"

ssh "${QNAP_USER}@${QNAP_HOST}" "set -e
'${QNAP_APP_ROOT}/stop-retirement-life-planner.sh' || true
'${QNAP_APP_ROOT}/start-retirement-life-planner.sh'
"

echo "QNAP LAN app is available: http://${QNAP_HOST}:${PORT}/"
