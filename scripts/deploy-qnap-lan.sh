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
CGI_DIR="$APP_ROOT/cgi-bin"
DATA_DIR="$APP_ROOT/data"
mkdir -p "$SITE_DIR" "$LOG_DIR" "$CGI_DIR" "$DATA_DIR"
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
LoadModule alias_module modules/mod_alias.so
LoadModule cgi_module modules/mod_cgi.so
TypesConfig /etc/config/apache/mime.types
DocumentRoot "${APP_ROOT}/site"
DirectoryIndex index.html
ScriptAlias /api/plan "${APP_ROOT}/cgi-bin/plan.cgi"
<Directory "${APP_ROOT}/site">
  Options -Indexes +FollowSymLinks
  AllowOverride None
  Require all granted
</Directory>
<Directory "${APP_ROOT}/cgi-bin">
  Options +ExecCGI -Indexes
  AllowOverride None
  Require all granted
</Directory>
APACHE
cat > "$CGI_DIR/plan.cgi" <<CGI
#!/bin/sh
set -eu
DATA_DIR="${APP_ROOT}/data"
DATA_FILE="\$DATA_DIR/shared-plan.json"
BACKUP_DIR="\$DATA_DIR/backups"

json_response() {
  status="\$1"
  body="\$2"
  if [ "\$status" != "200 OK" ]; then
    printf 'Status: %s\r\n' "\$status"
  fi
  printf 'Content-Type: application/json; charset=utf-8\r\n'
  printf 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0\r\n\r\n'
  printf '%s' "\$body"
}

case "\${REQUEST_METHOD:-GET}" in
  GET)
    if [ ! -f "\$DATA_FILE" ]; then
      json_response "404 Not Found" '{"error":"shared plan is empty"}'
      exit 0
    fi
    printf 'Content-Type: application/json; charset=utf-8\r\n'
    printf 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0\r\n\r\n'
    cat "\$DATA_FILE"
    ;;
  POST|PUT)
    mkdir -p "\$DATA_DIR" "\$BACKUP_DIR"
    tmp="\$DATA_DIR/shared-plan.tmp"
    if [ "\${CONTENT_LENGTH:-0}" -gt 0 ]; then
      dd bs=1 count="\$CONTENT_LENGTH" of="\$tmp" 2>/dev/null
    else
      cat > "\$tmp"
    fi
    if ! grep -q '"version"[[:space:]]*:[[:space:]]*1' "\$tmp" || ! grep -q '"scenarios"[[:space:]]*:' "\$tmp"; then
      rm -f "\$tmp"
      json_response "400 Bad Request" '{"error":"invalid retirement plan"}'
      exit 0
    fi
    if [ -f "\$DATA_FILE" ]; then
      cp "\$DATA_FILE" "\$BACKUP_DIR/shared-plan-\$(date +%Y%m%dT%H%M%S).json"
    fi
    mv "\$tmp" "\$DATA_FILE"
    json_response "200 OK" '{"ok":true}'
    ;;
  *)
    json_response "405 Method Not Allowed" '{"error":"method not allowed"}'
    ;;
esac
CGI
chmod +x "$CGI_DIR/plan.cgi"
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
ps | grep "${APACHE_BIN} -f \$CONF" | grep -v grep | awk '{print \$1}' | xargs -r kill 2>/dev/null || true
SH
chmod +x "$APP_ROOT/stop-retirement-life-planner.sh"
REMOTE

rsync -az --delete "$APP_DIR/dist/" "${QNAP_USER}@${QNAP_HOST}:${QNAP_APP_ROOT}/site/"

ssh "${QNAP_USER}@${QNAP_HOST}" "set -e
'${QNAP_APP_ROOT}/stop-retirement-life-planner.sh' || true
'${QNAP_APP_ROOT}/start-retirement-life-planner.sh'
"

echo "QNAP LAN app is available: http://${QNAP_HOST}:${PORT}/"
