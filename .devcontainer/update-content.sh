#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-${WORKSPACE_DIR}/.cache/ms-playwright}"

corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install --frozen-lockfile

while IFS= read -r playwright_cli; do
  node "${playwright_cli}" install
done < <(find "${WORKSPACE_DIR}/node_modules/.pnpm" -path "*/node_modules/playwright/cli.js" | sort -u)
