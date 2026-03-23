# HugeCode CI Workflow Map

This document is the source of truth for how HugeCode maps public workflows to internal reusable workflow implementations.

## Workflow Governance

- `pnpm check:workflow-governance`
  Use this guard whenever `.github/workflows/*.yml`, workflow-facing docs, or reusable workflow wiring changes.

## Public Workflows vs Internal Reusable Workflows

Public entry workflows live under `.github/workflows/*.yml` and are the only workflows that should be treated as user-facing automation entrypoints.

Internal reusable workflows live under `.github/workflows/_reusable-*.yml`.

Key reusable mappings currently in use:

- `.github/workflows/_reusable-ci-quality.yml`
- `.github/workflows/_reusable-ci-pr-affected.yml`
- `.github/workflows/_reusable-ci-frontend-optimization.yml`
- `.github/workflows/_reusable-desktop-prepare-frontend.yml`
- `.github/workflows/_reusable-desktop-build-pr.yml`
- `.github/workflows/_reusable-desktop-build-release.yml`

Public workflow entrypoints currently include:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/codex-nightly.yml`
- `.github/workflows/dependabot-auto-merge.yml`
- `.github/workflows/desktop.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/release.yml`

## Rules

- Public workflows should compose reusable workflows instead of duplicating job definitions.
- Internal or tooling-only lanes should not be reintroduced as product-facing workflow entrypoints.
- Workflow docs must stay aligned with `scripts/check-workflow-governance.mjs`.
- Shared Node/pnpm bootstrap should stay lockfile-first: prefetch with `pnpm fetch --frozen-lockfile`, then install with `pnpm install --offline --frozen-lockfile` unless a workflow has a documented reason to require a different install path.
- Desktop build lanes must install both `@ku0/code...` and `@ku0/code-tauri...` so Tauri `beforeBuildCommand` can build the frontend app without relying on a full workspace install.
- Dependabot auto-merge must stay selective: only low-risk grouped updates such as `devcontainers-safe` and `github-actions-safe` should auto-enable merge after checks pass; runtime, frontend, and Rust dependency bumps remain manual-review lanes.
