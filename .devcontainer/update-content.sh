#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-${WORKSPACE_DIR}/.cache/ms-playwright}"

corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install
pnpm -C tests/e2e exec playwright install --only-shell chromium
