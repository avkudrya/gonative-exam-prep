#!/usr/bin/env bash
# Owner, with sudo, from the Git checkout. Installs and enables exams-web.service without starting it;
# --update replaces a differing installed unit and keeps a backup.
set -euo pipefail
[[ $(id -u) = 0 ]] || { echo 'Run with sudo' >&2; exit 1; }
[[ -z ${1:-} || ${1:-} = --update ]] || exit 2
SOURCE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
UNIT="$SOURCE/systemd/exams-web.service"
TARGET=/etc/systemd/system/exams-web.service
BACKUP=""; CHANGED=0
if [[ -e "$TARGET" ]] && ! cmp -s "$UNIT" "$TARGET"; then
  [[ ${1:-} = --update ]] || { echo 'Installed unit differs; review it and rerun with --update' >&2; exit 1; }
  BACKUP=$(mktemp /etc/systemd/system/exams-web.service.before.XXXXXXXX)
  cp -p "$TARGET" "$BACKUP"
fi
if [[ ! -e "$TARGET" || -n "$BACKUP" ]]; then
  install -o root -g root -m 644 "$UNIT" "$TARGET"; CHANGED=1
  restorecon "$TARGET" 2>/dev/null || true
fi
if ! systemd-analyze verify "$TARGET"; then
  if [[ -n "$BACKUP" ]]; then cp -p "$BACKUP" "$TARGET"; elif [[ "$CHANGED" = 1 ]]; then rm "$TARGET"; fi
  exit 1
fi
systemctl daemon-reload
systemctl enable exams-web.service
printf 'Unit installed and enabled, not started. Backup: %s\n' "${BACKUP:-none needed}"
