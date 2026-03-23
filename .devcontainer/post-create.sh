#!/usr/bin/env bash
set -euo pipefail

corepack enable
corepack prepare pnpm@10.28.0 --activate
npm install -g @openai/codex@0.116.0
pnpm install
pnpm -C tests/e2e exec playwright install chromium

mkdir -p "${HOME}/.codex"
install -m 600 /workspaces/HugeCode/.devcontainer/codex-config.toml "${HOME}/.codex/config.toml"
