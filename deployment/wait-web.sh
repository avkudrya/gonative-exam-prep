#!/usr/bin/env bash
# After an nginx reload old workers may answer for a moment. Never accept a different build.
set -euo pipefail
URL=${1:?URL required}; BUILD_ID=${2:?Build ID required}
ATTEMPTS=${3:-20}; INTERVAL=${4:-1}
[[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ && "$INTERVAL" =~ ^[0-9]+$ ]] || exit 2
SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
STREAK=0
for ((i=1;i<=ATTEMPTS;i++)); do
  if bash "$SOURCE/check-web.sh" "$URL" "$BUILD_ID"; then
    STREAK=$((STREAK+1))
    if [[ "$STREAK" -ge 2 ]]; then echo "Expected build verified twice: $URL"; exit 0; fi
  else STREAK=0; fi
  [[ "$i" = "$ATTEMPTS" ]] || sleep "$INTERVAL"
done
echo "Expected build did not become consistently ready after $ATTEMPTS checks: $URL" >&2
exit 1
