#!/usr/bin/env bash
# Release check of the Exams web app. No backend, database or AI call: every probe is answered by Next itself.
#   check-web.sh http://127.0.0.1:3301 <BUILD_ID>        a local process; hosts are sent as Host headers
#   check-web.sh https://exams.mnemonicwords.app <BUILD_ID>  the public sites through nginx and TLS
set -euo pipefail
URL=${1:?URL required}; BUILD_ID=${2:?Build ID required}
URL=${URL%/}
APP_HOST=${EXAMS_APP_HOST:-exams.mnemonicwords.app}
LANDING_HOST=${EXAMS_LANDING_HOST:-ielts.mnemonicwords.app}
APP_ORIGIN="https://$APP_HOST"
CHECK_TMP=$(mktemp -d)
trap 'rm -rf "$CHECK_TMP"' EXIT
fail() { echo "$*" >&2; exit 1; }

# request HOST PATH [curl args...]: headers to $CHECK_TMP/h, body to $CHECK_TMP/b, prints the status.
request() {
  local host=$1 path=$2; shift 2
  local target
  if [[ "$URL" = "$APP_ORIGIN" ]]; then target=(-- "https://$host$path")
  # A local process gets the same headers nginx sends (nginx/exams-web.conf): Next reads X-Forwarded-Proto.
  else target=(-H "Host: $host" -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-For: 127.0.0.1' -H 'X-Real-IP: 127.0.0.1' -- "$URL$path"); fi
  curl -sS --connect-timeout 2 --max-time 10 -D "$CHECK_TMP/h" -o "$CHECK_TMP/b" -w '%{http_code}' "$@" "${target[@]}" \
    || fail "No response: $host$path"
}
noindex() { grep -qiE '^x-robots-tag:.*noindex' "$CHECK_TMP/h" || fail "Missing noindex header: $1"; }

# 1. The expected build, not an old worker or a placeholder.
[[ $(request "$APP_HOST" /api/health) = 200 ]] || fail "Health endpoint not ready: $URL"
python3 - "$CHECK_TMP/b" "$BUILD_ID" <<'PY'
import json, sys
try:
    with open(sys.argv[1]) as f: d = json.load(f)
except (ValueError, OSError):
    sys.exit('Health response is not JSON (possibly a placeholder or old nginx); not ready')
if not isinstance(d, dict) or d.get('status') != 'ok' or d.get('buildId') != sys.argv[2]:
    sys.exit('Health is not the expected build; not ready')
PY

# 2. Application pages render without a session and stay closed to indexing.
for route in /en/login /ru/login /en/register /ru/register /en/privacy /ru/terms; do
  [[ $(request "$APP_HOST" "$route") = 200 ]] || fail "Not 200: $route"
  noindex "$route"
done
# Member pages send a visitor without a session to sign in.
status=$(request "$APP_HOST" /en/ielts/writing)
[[ "$status" =~ ^30[78]$ ]] && grep -qiE '^location:.*/en/login\?next=' "$CHECK_TMP/h" || fail 'Member page is not protected'
# The landing exists only behind its own host.
[[ $(request "$APP_HOST" /en/landing/ielts) = 404 ]] || fail 'Internal landing path is reachable on the application host'

# 3. The landing host: its page at /{locale}, closed to indexing, sign-up on the application host.
for locale in en ru; do
  [[ $(request "$LANDING_HOST" "/$locale") = 200 ]] || fail "Landing not 200: /$locale"
  noindex "landing /$locale"
  python3 - "$CHECK_TMP/b" "https://$LANDING_HOST/$locale" "$APP_ORIGIN/$locale/register?" <<'PY'
from html.parser import HTMLParser
import sys
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.canonical = None; self.robots = None; self.links = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href')
        if tag == 'meta' and a.get('name') == 'robots': self.robots = a.get('content', '')
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
page = Page(); page.feed(open(sys.argv[1]).read())
if page.canonical != sys.argv[2]: sys.exit('Landing canonical missing or incorrect')
if not page.robots or 'noindex' not in page.robots: sys.exit('Landing is missing noindex metadata')
if not any(link.startswith(sys.argv[3]) for link in page.links): sys.exit('Landing does not link to registration on the application host')
PY
done
status=$(request "$LANDING_HOST" '/en/login?next=%2Fielts%2Fwriting')
[[ "$status" = 308 ]] && grep -qiF "location: $APP_ORIGIN/en/login?next=%2Fielts%2Fwriting" "$CHECK_TMP/h" \
  || fail 'Landing host does not send other paths to the application host'
[[ $(request "$LANDING_HOST" /api/bff/auth/me) = 404 ]] || fail 'BFF answers on the landing host'

# 4. BFF origin protection: a foreign Origin is refused; the public origin passes the check
#    (and then stops at the content type, before any backend call).
[[ $(request "$APP_HOST" /api/bff/auth/login -X POST -H 'Origin: https://attacker.invalid' -H 'Content-Type: application/json' --data '{}') = 403 ]] \
  || fail 'BFF accepts a foreign Origin'
[[ $(request "$APP_HOST" /api/bff/auth/login -X POST -H "Origin: $APP_ORIGIN" -H 'Content-Type: text/plain' --data 'x') = 415 ]] \
  || fail "BFF does not accept its own origin $APP_ORIGIN (EXAMS_WEB_ORIGIN)"

# 5. Crawling blocked on both hosts.
for host in "$APP_HOST" "$LANDING_HOST"; do
  [[ $(request "$host" /robots.txt) = 200 ]] || fail "robots.txt missing on $host"
  python3 - "$CHECK_TMP/b" "$host" <<'PY'
import re, sys
body = open(sys.argv[1]).read()
if not re.search(r'^Disallow:\s*/\s*$', body, re.M | re.I): sys.exit(f'robots.txt on {sys.argv[2]} must block all crawling before launch')
if re.search(r'^Allow:\s*/\s*$', body, re.M | re.I): sys.exit(f'robots.txt on {sys.argv[2]} must not allow crawling before launch')
PY
done
