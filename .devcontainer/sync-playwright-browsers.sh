#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLAYWRIGHT_ROOT="${WORKSPACE_DIR}/node_modules/.pnpm"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-${WORKSPACE_DIR}/.cache/ms-playwright}"

if [[ ! -d "${PLAYWRIGHT_ROOT}" ]]; then
  exit 0
fi

mapfile -t playwright_clis < <(find "${PLAYWRIGHT_ROOT}" -path "*/node_modules/playwright/cli.js" | sort -u)

if [[ "${#playwright_clis[@]}" -eq 0 ]]; then
  exit 0
fi

for playwright_cli in "${playwright_clis[@]}"; do
  node "${playwright_cli}" install --only-shell chromium
done
