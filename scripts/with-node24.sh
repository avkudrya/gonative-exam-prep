#!/usr/bin/env bash
# Select the project runtime for npm workspace commands, including IDE launches.
set -eo pipefail
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PROJECT_NODE_VERSION=$(cat "$PROJECT_ROOT/.nvmrc")
node24_active() { command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) === 24 ? 0 : 1)' ; }
if ! node24_active; then
  PROJECT_NVM_DIR=${NVM_DIR:-"$HOME/.nvm"}
  if [ -s "$PROJECT_NVM_DIR/nvm.sh" ]; then
    # nvm modifies PATH in this process only; never change the user's default runtime.
    . "$PROJECT_NVM_DIR/nvm.sh" --no-use
    nvm use --silent "$PROJECT_NODE_VERSION" || {
      echo "Install the project runtime first: nvm install $PROJECT_NODE_VERSION" >&2
      exit 1
    }
  fi
fi
if ! node24_active; then
  echo "This project requires Node 24. Run: nvm install $PROJECT_NODE_VERSION && nvm use $PROJECT_NODE_VERSION" >&2
  exit 1
fi
exec "$@"
