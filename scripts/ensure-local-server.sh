#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-current}"
PORT="${PORT:-5174}"
HOST="${HOST:-127.0.0.1}"
LABEL="com.motomichi.retirement-simulator-static-${APP_NAME}-${PORT}"
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${APP_ROOT}/apps/${APP_NAME}"
RUNTIME_ROOT="${HOME}/.retirement-simulator"
SITE_DIR="${RUNTIME_ROOT}/site-${APP_NAME}-${PORT}"
LOG_DIR="${RUNTIME_ROOT}/logs"
PLIST_DIR="${HOME}/Library/LaunchAgents"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"
URL="http://${HOST}:${PORT}/"
UID_VALUE="$(id -u)"
PYTHON_BIN="$(command -v python3)"

if [[ ! -f "${APP_DIR}/package.json" ]]; then
  echo "App package not found: ${APP_DIR}/package.json" >&2
  exit 1
fi

cd "$APP_DIR"
npm run build

mkdir -p "$SITE_DIR" "$LOG_DIR" "$PLIST_DIR"
rm -rf "${SITE_DIR:?}/"*
cp -R dist/. "$SITE_DIR/"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON_BIN}</string>
    <string>-m</string>
    <string>http.server</string>
    <string>${PORT}</string>
    <string>--bind</string>
    <string>${HOST}</string>
    <string>--directory</string>
    <string>${SITE_DIR}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/server-${PORT}.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/server-${PORT}.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/${UID_VALUE}" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${UID_VALUE}" "$PLIST_PATH"
launchctl kickstart -k "gui/${UID_VALUE}/${LABEL}"

for _ in $(seq 1 20); do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    echo "Local app is available: $URL"
    echo "Published files: $SITE_DIR"
    exit 0
  fi
  sleep 1
done

echo "Local app did not become ready: $URL" >&2
echo "Logs: ${LOG_DIR}/server-${PORT}.err.log" >&2
tail -n 80 "${LOG_DIR}/server-${PORT}.err.log" >&2 || true
exit 1
