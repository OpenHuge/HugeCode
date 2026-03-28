#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "${WORKSPACE_DIR}/node_modules/.pnpm" ]]; then
  exit 0
fi

bash "${WORKSPACE_DIR}/.devcontainer/sync-playwright-browsers.sh"
