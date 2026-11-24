#!/usr/bin/env bash
# Operator-run Git deployment of the Exams web app (exams. and ielts.mnemonicwords.app).
# Never as root. No database, backend or AI operation: MultiAdmin is deployed separately.
#   bash deploy.sh <full commit>             later deployments
#   bash deploy.sh <full commit> --activate  first deployment: also installs the nginx config
set -euo pipefail
umask 077
SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BASE=${BASE:-/var/www/exams.mnemonicwords.app}
REPO=${WEB_REPO:-github-exams:avkudrya/gonative-exam-prep.git}
SERVICE=exams-web.service
PORT=3300; CHECK_PORT=3301
COMMIT=${1:-$(git -C "$SOURCE" rev-parse HEAD)}
ACTIVATE=${2:-}
[[ $(id -un) != root ]] || { echo 'Run as gonativealex, not root' >&2; exit 1; }
[[ "$BASE" = /var/www/exams.mnemonicwords.app ]] || { echo 'Unexpected deploy base' >&2; exit 1; }
[[ "$COMMIT" =~ ^[a-f0-9]{40}$ ]] || { echo 'Supply an exact full Git commit' >&2; exit 1; }
[[ -z "$ACTIVATE" || "$ACTIVATE" = --activate ]] || exit 1
[[ -d "$BASE/releases" && -f "$BASE/shared/.env.production.local" ]] || { echo 'Server layout/env missing: run deployment/setup-server.sh' >&2; exit 1; }
[[ $(stat -c %a "$BASE/shared/.env.production.local") = 600 ]] || { echo 'Runtime env must be 0600' >&2; exit 1; }
systemctl cat "$SERVICE" >/dev/null || { echo 'Install the unit first: sudo bash deployment/install-web-service.sh' >&2; exit 1; }
mkdir "$BASE/.deploy.lock" || { echo 'Another deployment is running; do not delete its lock' >&2; exit 1; }
REL=""; CHECK_PID=""; SWITCHED=0; SUCCESS=0; PREVIOUS=""
if [[ -e "$BASE/current" && ! -L "$BASE/current" ]]; then rmdir "$BASE/.deploy.lock"; echo 'current must be a symlink' >&2; exit 1; fi
if [[ -L "$BASE/current" ]]; then
  PREVIOUS=$(readlink -f "$BASE/current")
  [[ "$PREVIOUS" = "$BASE/releases/"* && -d "$PREVIOUS" ]] || { rmdir "$BASE/.deploy.lock"; echo 'Unexpected current target' >&2; exit 1; }
fi
switch_to() { ln -s "$1" "$BASE/.current-next"; mv -Tf "$BASE/.current-next" "$BASE/current"; }
cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$CHECK_PID" ]]; then kill "$CHECK_PID" 2>/dev/null || true; wait "$CHECK_PID" 2>/dev/null || true; fi
  if [[ "$SWITCHED" = 1 && "$SUCCESS" = 0 ]]; then
    echo 'Restoring previous release' >&2
    if [[ "$ACTIVATE" = --activate && -n "${BUILD_ID:-}" ]]; then sudo bash "$REL/deployment/activate-web.sh" --restore "$BUILD_ID" || echo 'NGINX ROLLBACK FAILED: operator action required' >&2; fi
    if [[ -n "$PREVIOUS" ]]; then switch_to "$PREVIOUS"; sudo systemctl restart "$SERVICE" || echo 'ROLLBACK RESTART FAILED: operator action required' >&2
    else sudo systemctl stop "$SERVICE" || true; [[ -L "$BASE/current" ]] && rm "$BASE/current"; fi
  fi
  rmdir "$BASE/.deploy.lock" || true
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
[[ ! -e "$BASE/.current-next" && ! -L "$BASE/.current-next" ]] || { echo 'Stale .current-next; operator review required' >&2; exit 1; }
# An ordinary deploy needs only the explicitly allowed service restart (deployment/README.md, sudoers);
# general sudo authentication only for nginx activation or when that rule is absent.
if [[ "$ACTIVATE" = --activate ]] || ! sudo -n -l /usr/bin/systemctl restart "$SERVICE" >/dev/null 2>&1; then
  sudo -v
fi
[[ -z $(ss -H -ltn "sport = :$CHECK_PORT") ]] || { echo "Check port $CHECK_PORT occupied" >&2; exit 1; }
if [[ -z "$PREVIOUS" ]]; then [[ -z $(ss -H -ltn "sport = :$PORT") ]] || { echo "Port $PORT occupied" >&2; exit 1; }; fi
REL=$(mktemp -d "$BASE/releases/$(date -u +%Y%m%d%H%M%S)-XXXXXXXX")
rmdir "$REL" # git clone requires a nonexistent target
LOG="$BASE/shared/logs/$(basename "$REL").log"
echo "Building $COMMIT; log: $LOG"
git clone --quiet --no-checkout "$REPO" "$REL" >>"$LOG" 2>&1
git -C "$REL" checkout --quiet --detach "$COMMIT" >>"$LOG" 2>&1
[[ $(git -C "$REL" rev-parse HEAD) = "$COMMIT" ]] || exit 1
ln -s "$BASE/shared/.env.production.local" "$REL/web/.env.production.local"
cd "$REL"
. "$HOME/.nvm/nvm.sh" --no-use
nvm use --silent "$(cat .nvmrc)"
[[ $(node -p 'process.versions.node.split(".")[0]') = 24 ]] || exit 1
node --env-file="$BASE/shared/.env.production.local" -e '
  const e = process.env, origin = "https://exams.mnemonicwords.app";
  const ok = e.SITE_ORIGIN === origin && e.EXAMS_WEB_ORIGIN === origin
    && e.EXAMS_API_URL === "https://goapi.mnemonicwords.app/api/exam"
    && /^[0-9a-z-]+\.apps\.googleusercontent\.com$/.test(e.EXAMS_GOOGLE_CLIENT_ID ?? "")
    && e.EXAMS_LANDING_HOSTS === "ielts.mnemonicwords.app=ielts";
  if (!ok) { console.error("Runtime env does not match production (deployment/README.md)"); process.exit(1); }
'
export NEXT_TELEMETRY_DISABLED=1
# Browser tests (npm run test:web) run before every push; the server has no browser.
npm ci >>"$LOG" 2>&1
npm run typecheck >>"$LOG" 2>&1
npm test >>"$LOG" 2>&1
npm run typecheck:web >>"$LOG" 2>&1
npm run lint >>"$LOG" 2>&1
npm run build >>"$LOG" 2>&1
BUILD_ID=$(cat web/.next/BUILD_ID)
(cd "$REL/web"; exec node "$REL/node_modules/next/dist/bin/next" start --hostname 127.0.0.1 --port "$CHECK_PORT") >>"$LOG" 2>&1 &
CHECK_PID=$!
ready=0
for ((i=0;i<30;i++)); do
  kill -0 "$CHECK_PID" 2>/dev/null || { echo 'Candidate exited; inspect log' >&2; exit 1; }
  if bash "$REL/deployment/check-web.sh" "http://127.0.0.1:$CHECK_PORT" "$BUILD_ID" >>"$LOG" 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" = 1 ]] || { echo 'Candidate checks failed; inspect log' >&2; exit 1; }
kill "$CHECK_PID"; wait "$CHECK_PID" 2>/dev/null || true; CHECK_PID=""
switch_to "$REL"; SWITCHED=1
sudo systemctl restart "$SERVICE"
ready=0
for ((i=0;i<20;i++)); do
  if bash "$REL/deployment/check-web.sh" "http://127.0.0.1:$PORT" "$BUILD_ID" >>"$LOG" 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" = 1 ]] || { echo 'Service checks failed; rolling back' >&2; exit 1; }
if [[ "$ACTIVATE" = --activate ]]; then
  sudo bash "$REL/deployment/activate-web.sh" "$BUILD_ID"
else
  bash "$REL/deployment/wait-web.sh" https://exams.mnemonicwords.app "$BUILD_ID" >>"$LOG" 2>&1 || { echo 'Public check failed (the first deployment needs --activate)' >&2; exit 1; }
fi
SUCCESS=1
printf 'Deployed %s to %s (build %s, previous: %s)\n' "$COMMIT" "$REL" "$BUILD_ID" "${PREVIOUS:-none}"
# Releases and logs are kept for explicit operator cleanup; never prune the live or previous release.
