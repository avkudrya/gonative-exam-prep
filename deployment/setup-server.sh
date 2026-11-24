#!/usr/bin/env bash
# One-time server preparation for GoNative Exams. The owner runs it with sudo from the Git checkout:
#   sudo bash /var/www/exams.mnemonicwords.app/source/deployment/setup-server.sh
# Idempotent; never overwrites an existing env file or a foreign nginx config. No database, mail or AI action.
#   1. releases/ and shared/logs/ next to source/, owned by the deploy user;
#   2. shared/.env.production.local (0600) with the production values; the Google client ID is the
#      Worksheets one (one web client for both sites, P3 plan §6);
#   3. a temporary HTTP config for both hosts and one TLS certificate for both (certbot certonly:
#      certbot does not edit the config; the first deploy with --activate installs nginx/exams-web.conf).
set -euo pipefail
umask 077
[[ $(id -u) = 0 ]] || { echo 'Run with sudo' >&2; exit 1; }
BASE=/var/www/exams.mnemonicwords.app
OWNER=${SUDO_USER:-gonativealex}
[[ "$OWNER" != root ]] || { echo 'Run through sudo from the deploy user' >&2; exit 1; }
SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ "$SOURCE" = "$BASE/source/deployment" ]] || { echo "Run from $BASE/source" >&2; exit 1; }
CONF=/etc/nginx/conf.d/exams.mnemonicwords.app.conf
ENV="$BASE/shared/.env.production.local"
WS_ENV=/var/www/worksheets.mnemonicwords.app/shared/.env.production.local
log() { echo "[exams-setup] $*"; }

log 'layout'
install -d -o "$OWNER" -g "$OWNER" -m 750 "$BASE/releases" "$BASE/shared" "$BASE/shared/logs"

if [[ -e "$ENV" ]]; then
  log "env exists, left as is: $ENV"
else
  client=$(sed -n 's/^WORKSHEETS_GOOGLE_CLIENT_ID=//p' "$WS_ENV" 2>/dev/null | tr -d '"' | head -n1)
  [[ "$client" = *.apps.googleusercontent.com ]] || { echo "No Google client ID in $WS_ENV; write $ENV by hand (deployment/README.md)" >&2; exit 1; }
  cat > "$ENV" <<VALUES
SITE_ORIGIN=https://exams.mnemonicwords.app
EXAMS_WEB_ORIGIN=https://exams.mnemonicwords.app
EXAMS_API_URL=https://goapi.mnemonicwords.app/api/exam
EXAMS_GOOGLE_CLIENT_ID=$client
EXAMS_LANDING_HOSTS=ielts.mnemonicwords.app=ielts
VALUES
  chown "$OWNER:$OWNER" "$ENV"; chmod 600 "$ENV"
  log "env written: $ENV"
fi

log 'nginx'
if [[ ! -e "$CONF" ]]; then
  install -o root -g root -m 644 "$SOURCE/nginx/exams-bootstrap.conf" "$CONF"
  restorecon "$CONF" 2>/dev/null || true
  if ! nginx -t; then rm -f "$CONF"; echo 'nginx -t failed; the new config was removed' >&2; exit 1; fi
  systemctl reload nginx
elif cmp -s "$CONF" "$SOURCE/nginx/exams-bootstrap.conf" || cmp -s "$CONF" "$SOURCE/nginx/exams-web.conf"; then
  log "config already installed: $CONF"
else
  echo "$CONF exists and is not ours; review it by hand" >&2; exit 1
fi

log 'certificate'
certbot certonly --nginx --non-interactive --agree-tos --expand --cert-name exams.mnemonicwords.app \
  -d exams.mnemonicwords.app -d ielts.mnemonicwords.app
[[ -f /etc/letsencrypt/live/exams.mnemonicwords.app/fullchain.pem ]] || { echo 'Certificate missing' >&2; exit 1; }
log 'done; next: deployment/install-web-service.sh'
