# HugeCode CI Workflow Map

This document is the source of truth for how HugeCode maps public workflows to internal reusable workflow implementations.

## Workflow Governance

- `pnpm check:workflow-governance`
  Use this guard whenever `.github/workflows/*.yml`, workflow-facing docs, or reusable workflow wiring changes.
- Required merge-queue checks should scope `merge_group` to the
  `checks_requested` activity so workflow runs stay aligned with GitHub's
  required-check contract and do not widen accidentally if new activity types
  are added later.

## PR Author Guide

Treat the CI check names as explicit requests for missing local proof:

- `Quality / Quality`
  This lane is where `format`, `lint`, `ui:contract`, `check:circular`, and
  affected typecheck fail. If a PR changes TypeScript behavior, runtime/UI
  boundaries, or import shape, the author should already have run the matching
  local gate before opening the PR.
- `PR Affected Checks / PR Affected Checks`
  This lane validates affected builds and tests. If it fails, the usual fix is
  to reproduce with `pnpm build:affected` and `pnpm test:affected` or the
  narrower build/test commands that cover the changed surface, not to rerun
  unrelated repo-wide validation.
- `frontend_optimization / frontend_optimization`
  This is the expensive browser/build/startup proof. Treat failures here as a
  sign that the PR changed shell startup, runtime readiness, bundle-sensitive
  code, or frontend-owning dependencies without running
  `pnpm validate:frontend-optimization` locally first.

When documenting or reviewing PR process, point authors to the local command
that corresponds to the failing gate instead of telling them to "wait for CI and
fix whatever fails next".

## Public Workflows vs Internal Reusable Workflows

Public entry workflows live under `.github/workflows/*.yml` and are the only workflows that should be treated as user-facing automation entrypoints.

Internal reusable workflows live under `.github/workflows/_reusable-*.yml`.

Key reusable mappings currently in use:

- `.github/workflows/_reusable-ci-quality.yml`
- `.github/workflows/_reusable-ci-quality-baseline.yml`
- `.github/workflows/_reusable-ci-quality-typecheck.yml`
- `.github/workflows/_reusable-ci-runtime-contract-parity.yml`
- `.github/workflows/_reusable-ci-pr-affected.yml`
- `.github/workflows/_reusable-ci-pr-affected-build.yml`
- `.github/workflows/_reusable-ci-pr-affected-tests.yml`
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
- `.github/workflows/pr-auto-merge.yml`
- `.github/workflows/release.yml`

## Rules

- Public workflows should compose reusable workflows instead of duplicating job definitions.
- Internal or tooling-only lanes should not be reintroduced as product-facing workflow entrypoints.
- Workflow docs must stay aligned with `scripts/check-workflow-governance.mjs`.
- Required merge-queue checks must trigger on `merge_group` as well as `pull_request`, or queued PRs will block waiting for checks that never report.
- Required checks that protect `main` should keep a stable aggregate check name even when the underlying reusable workflow fans out into parallel sub-jobs. This lets branch protection and merge queue wait on `Quality / Quality` and `PR Affected Checks / PR Affected Checks` while still shrinking wall-clock time.
- Shared Node/pnpm bootstrap should stay lockfile-first: prefetch with `pnpm fetch --frozen-lockfile`, then install with `pnpm install --offline --frozen-lockfile` unless a workflow has a documented reason to require a different install path.
- PR workflow gates may classify manifest-only dependency bumps before deciding whether expensive desktop or frontend lanes are needed; keep that classification script-backed and explicit instead of scattering ad hoc shell heuristics across workflows.
- Low-risk Dependabot development-version bumps may skip the expensive affected build/test lane when the remaining quality, frontend, or desktop gates already cover the touched risk surface.
- CodeQL remains a required security guardrail, but its language lanes should be scoped to the languages actually touched by the change so npm-only updates do not queue Rust analysis and Rust-only updates do not queue JavaScript analysis.
- When a required workflow lane is intentionally idle, prefer a fast explicit skip inside the job over removing the check name entirely; this keeps branch protection stable while still reducing runner time.
- The shared `Quality` lane should reserve global governance checks for `repo_sot`-class changes. On normal product PRs, only run `ui:contract`, `check:circular`, and code-integration watch when their owned surfaces changed.
- Desktop build lanes must install both `@ku0/code...` and `@ku0/code-tauri...` so Tauri `beforeBuildCommand` can build the frontend app without relying on a full workspace install.
- Expensive frontend optimization lanes should restore Turbo cache before rebuilding so bundle-budget and targeted browser gates keep their coverage without recompiling from a cold local cache on every PR.
- Shared Playwright bootstrap should install Chromium with `--only-shell` when
  CI stays on the default headless Chromium lane without a `channel` override;
  this keeps browser downloads aligned with current Playwright guidance and
  avoids shipping unused headed binaries into every CI run.
- Frontend optimization classification should stay focused on runtime or build-affecting frontend dependencies; pure type-package bumps should normally be covered by quality/typecheck instead of forcing bundle and browser lanes.
- Frontend optimization should not fan out for generic CI plumbing edits. Workflow-governance and shared action changes belong in repository governance lanes unless they also touch runtime-owning frontend or bundle-budget surfaces.
- Frontend optimization reusable-workflow edits should stay covered by workflow governance and validation, not by forcing the full browser and bundle lane on infrastructure-only pull requests.
- PR-triggered desktop and CodeQL lanes should stay path-scoped so dependency-only or docs-only changes do not fan out into full desktop matrices or static-analysis runs before `main`; keep broader protection on `push` to `main` and scheduled scans.
- PR-triggered Tauri desktop builds should prefer shell-, runtime-, bootstrap-, and updater-owned frontend surfaces instead of treating every `apps/code` page change as a desktop packaging risk; generic app changes stay covered by core CI and the broader `push` to `main` desktop workflow.
- The `CI` workflow should apply the same rule to `desktop:verify:fast`: PRs should only run that fast desktop gate for desktop-owned surfaces, while root dependency, lockfile churn, and generic CI workflow plumbing stay covered by the dedicated desktop workflow or repository-governance validation instead of the shared `Quality` lane.
- Electron beta lanes should run the staged Forge entrypoints (`desktop:electron:verify`, `desktop:electron:make:smoke`, `desktop:electron:publish:dry-run`, `desktop:electron:publish`) instead of calling Forge directly from the workspace package root.
- Electron beta change classification should stay script-backed (`scripts/classify-electron-beta-scope.mjs`) so workflow-wrapper edits can keep a lightweight verification lane without accidentally waking the three-platform packaging matrix.
- Electron beta PR lanes should keep stable check names, but internal changes detection should fast-skip the full verify/make/publish chain when a PR does not touch electron-owned packaging surfaces.
- Electron beta wrapper or workflow-only changes may still run the lightweight `verify` lane, but they should not fan out into the three-platform `make-smoke` matrix unless packaging-owned surfaces changed.
- Repo-governance-only pull requests should keep repository governance and required workflow visibility, but they should not wake up product-facing `Quality`, `frontend_optimization`, affected-build/test execution, or Tauri desktop builds when no product-owned surface changed.
- Public desktop, electron, and CodeQL workflows may still trigger for workflow-governance edits so syntax and required check names stay visible, but workflow-only changes should fast-skip heavyweight packaging or language-analysis lanes unless the owned product or build-runtime surfaces changed.
- Dependabot auto-merge must stay selective: only low-risk grouped updates such as `devcontainers-safe` and `github-actions-safe` should auto-enable merge after checks pass; runtime, frontend, and Rust dependency bumps remain manual-review lanes.
- Auto-merge for non-Dependabot PRs should stay repo-branch-only and review-gated; the default path is "approved with no unresolved conversations means `gh pr merge --auto` is enabled unless the PR carries the opt-out `manual-merge` label."
- npm Dependabot updates should prefer grouped low-risk development-version bumps to reduce queue pressure and redundant CI fan-out, while keeping higher-risk dependency changes in manual-review lanes.
