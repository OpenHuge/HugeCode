#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERSIST_DIR="${WORKSPACE_DIR}/.devcontainer/local/codex"
PERSISTED_CONFIG_PATH="${PERSIST_DIR}/config.toml"

mkdir -p "${HOME}/.codex"
mkdir -p "${PERSIST_DIR}"

if [[ ! -f "${PERSISTED_CONFIG_PATH}" ]]; then
  install -m 600 "${WORKSPACE_DIR}/.devcontainer/codex-config.toml" "${PERSISTED_CONFIG_PATH}"
fi

ln -sfn "${PERSISTED_CONFIG_PATH}" "${HOME}/.codex/config.toml"
