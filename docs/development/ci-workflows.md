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
- `.github/workflows/_reusable-electron-beta.yml`

Public workflow entrypoints currently include:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/codex-nightly.yml`
- `.github/workflows/dependabot-auto-merge.yml`
- `.github/workflows/desktop.yml`
- `.github/workflows/electron-beta.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/release.yml`

## Rules

- Public workflows should compose reusable workflows instead of duplicating job definitions.
- Internal or tooling-only lanes should not be reintroduced as product-facing workflow entrypoints.
- Workflow docs must stay aligned with `scripts/check-workflow-governance.mjs`.
- Shared Node/pnpm bootstrap should stay lockfile-first: prefetch with `pnpm fetch --frozen-lockfile`, then install with `pnpm install --offline --frozen-lockfile` unless a workflow has a documented reason to require a different install path.
- Turbo-backed jobs should cache `.turbo/cache` instead of the whole `.turbo` directory, and reusable workflows that execute `turbo` should inherit secrets so optional `TURBO_TOKEN` / `TURBO_TEAM` remote-cache wiring can be enabled without duplicating setup per lane.
- Linux Playwright lanes should install OS dependencies explicitly and then install the required browser runtime directly. Do not add browser-binary cache layers by default; Playwright documents that the cache restore cost is often comparable to a fresh download on CI.
- PR workflow gates may classify manifest-only dependency bumps before deciding whether expensive desktop or frontend lanes are needed; keep that classification script-backed and explicit instead of scattering ad hoc shell heuristics across workflows.
- Low-risk Dependabot development-version bumps may skip the expensive affected build/test lane when the remaining quality, frontend, or desktop gates already cover the touched risk surface.
- The PR affected lane should keep `Tests (affected)` for code confidence, but it may skip `Build (affected)` when the diff is limited to tests, fixtures, stories, or markdown-like surfaces that do not alter shipped build output.
- CodeQL remains a required security guardrail, but its language lanes should be scoped to the languages actually touched by the change so npm-only updates do not queue Rust analysis and Rust-only updates do not queue JavaScript analysis.
- When a required workflow lane is intentionally idle, prefer a fast explicit skip inside the job over removing the check name entirely; this keeps branch protection stable while still reducing runner time.
- Desktop build lanes must install both `@ku0/code...` and `@ku0/code-tauri...` so Tauri `beforeBuildCommand` can build the frontend app without relying on a full workspace install.
- Expensive frontend optimization lanes should restore Turbo cache before rebuilding so bundle-budget and targeted browser gates keep their coverage without recompiling from a cold local cache on every PR.
- Frontend optimization classification should stay focused on runtime or build-affecting frontend dependencies; pure type-package bumps should normally be covered by quality/typecheck instead of forcing bundle and browser lanes.
- Frontend optimization should not trigger for frontend test-only, fixture-only, story-only, or markdown-only edits under `apps/code` or `packages/design-system`; those changes stay covered by quality and affected-test lanes without paying the extra bundle and browser gate cost.
- PR-triggered desktop and CodeQL lanes should stay path-scoped so dependency-only or docs-only changes do not fan out into full desktop matrices or static-analysis runs before `main`; keep broader protection on `push` to `main` and scheduled scans.
- The desktop PR workflow should keep a reduced matrix for renderer-only `apps/code/**` changes and reserve the full macOS + Windows + Linux matrix for Tauri/Electron host, desktop workflow, or desktop-manifest changes.
- The desktop PR workflow should also skip desktop build lanes for renderer test-only, fixture-only, story-only, or markdown-only edits; keep those changes on the cheap governance and affected-test paths instead of queueing even the reduced Linux desktop build.
- The `CI` workflow should apply the same rule to `desktop:verify:fast`: PRs should only run that fast desktop gate for desktop-owned surfaces, while root dependency and lockfile churn stays covered by the dedicated desktop workflow on `push` to `main`.
- Electron beta lanes should run the staged Forge entrypoints (`desktop:electron:verify`, `desktop:electron:make:smoke`, `desktop:electron:publish:dry-run`, `desktop:electron:publish`) instead of calling Forge directly from the workspace package root.
- Dependabot auto-merge must stay selective: only low-risk grouped updates such as `devcontainers-safe` and `github-actions-safe` should auto-enable merge after checks pass; runtime, frontend, and Rust dependency bumps remain manual-review lanes.
- npm Dependabot updates should prefer grouped low-risk development-version bumps to reduce queue pressure and redundant CI fan-out, while keeping higher-risk dependency changes in manual-review lanes.
