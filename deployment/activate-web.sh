#!/usr/bin/env bash
# First-deploy activation (deploy.sh --activate, as root): install nginx/exams-web.conf for both hosts in place of the
# bootstrap config, check the public sites, and restore the previous config if anything fails.
set -euo pipefail
umask 077
[[ $(id -u) = 0 ]] || exit 1
MODE=activate
if [[ ${1:-} = --restore ]]; then MODE=restore; shift; fi
BUILD_ID=${1:?Expected build ID required}
[[ "$BUILD_ID" =~ ^[A-Za-z0-9_-]+$ ]] || exit 1
BASE=/var/www/exams.mnemonicwords.app
TARGET=/etc/nginx/conf.d/exams.mnemonicwords.app.conf
BACKUP="$BASE/shared/nginx-before.$BUILD_ID"
if [[ "$MODE" = restore ]]; then
  if [[ -f "$BACKUP/site.conf" ]]; then
    cp -p "$BACKUP/site.conf" "$TARGET"; restorecon "$TARGET" 2>/dev/null || true; nginx -t; systemctl reload nginx
  fi
  exit 0
fi
REL=$(readlink -f "$BASE/current")
[[ "$REL" = "$BASE/releases/"* ]] || exit 1
[[ -f "$TARGET" ]] || { echo "Run deployment/setup-server.sh first ($TARGET missing)" >&2; exit 1; }
[[ -f /etc/letsencrypt/live/exams.mnemonicwords.app/fullchain.pem ]] || { echo 'Certificate missing; run setup-server.sh' >&2; exit 1; }
[[ "$(cat "$REL/web/.next/BUILD_ID")" = "$BUILD_ID" ]] || exit 1
mkdir "$BACKUP"
cp -p "$TARGET" "$BACKUP/site.conf"
DONE=0
rollback() {
  local result=$?
  if [[ "$DONE" = 0 ]]; then
    cp -p "$BACKUP/site.conf" "$TARGET"
    restorecon "$TARGET" 2>/dev/null || true
    nginx -t && systemctl reload nginx || echo 'NGINX RESTORE FAILED: operator action required' >&2
  fi
  exit "$result"
}
trap rollback EXIT
trap 'exit 130' INT TERM
install -o root -g root -m 644 "$REL/deployment/nginx/exams-web.conf" "$TARGET"
restorecon "$TARGET" 2>/dev/null || true
nginx -t
systemctl reload nginx
# Public TLS on both hosts must serve exactly this build before activation counts.
bash "$REL/deployment/wait-web.sh" https://exams.mnemonicwords.app "$BUILD_ID"
DONE=1
printf 'Proxy active for exams. and ielts.; previous nginx config kept at %s\n' "$BACKUP/site.conf"
