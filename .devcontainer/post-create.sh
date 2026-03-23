#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PERSIST_DIR="${WORKSPACE_DIR}/.devcontainer/local/codex"
PERSISTED_CONFIG_PATH="${PERSIST_DIR}/config.toml"
AGENTS_PERSIST_DIR="${WORKSPACE_DIR}/.devcontainer/local/agents"
AGENTS_PERSISTED_SKILLS_DIR="${AGENTS_PERSIST_DIR}/skills"
AGENTS_SEED_SKILLS_DIR="${WORKSPACE_DIR}/.devcontainer/agents-skills"

mkdir -p "${HOME}/.codex"
mkdir -p "${PERSIST_DIR}"
mkdir -p "${HOME}/.agents"
mkdir -p "${AGENTS_PERSIST_DIR}"

if [[ ! -f "${PERSISTED_CONFIG_PATH}" ]]; then
  install -m 600 "${WORKSPACE_DIR}/.devcontainer/codex-config.toml" "${PERSISTED_CONFIG_PATH}"
fi

if [[ -d "${AGENTS_SEED_SKILLS_DIR}" ]]; then
  mkdir -p "${AGENTS_PERSISTED_SKILLS_DIR}"
  while IFS= read -r -d '' source_path; do
    relative_path="${source_path#"${AGENTS_SEED_SKILLS_DIR}/"}"
    target_path="${AGENTS_PERSISTED_SKILLS_DIR}/${relative_path}"

    if [[ -d "${source_path}" ]]; then
      mkdir -p "${target_path}"
      continue
    fi

    if [[ -e "${target_path}" ]]; then
      continue
    fi

    mkdir -p "$(dirname "${target_path}")"
    cp -a "${source_path}" "${target_path}"
  done < <(find "${AGENTS_SEED_SKILLS_DIR}" -mindepth 1 -print0)
fi

ln -sfn "${PERSISTED_CONFIG_PATH}" "${HOME}/.codex/config.toml"
ln -sfn "${AGENTS_PERSISTED_SKILLS_DIR}" "${HOME}/.agents/skills"
