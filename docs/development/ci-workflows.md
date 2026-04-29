# HugeCode CI Workflow Map

This document is the source of truth for how HugeCode maps public workflows to internal reusable workflow implementations.

## Workflow Governance

- `pnpm check:workflow-governance`
  Use this guard whenever `.github/workflows/*.yml`, workflow-facing docs, or reusable workflow wiring changes.
- Required GitHub Actions checks that protect `main` must include `merge_group`
  triggers when the repository uses a merge queue ruleset. Otherwise merge queue
  entries will not receive the required check contexts.
- Required merge-queue checks should scope `merge_group` to the
  `checks_requested` activity so workflow runs stay aligned with GitHub's
  required-check contract and do not widen accidentally if new activity types
  are added later.
- Required workflows that run on `merge_group` should not use unconditional
  `cancel-in-progress: true`. Keep cancellation limited to PR churn so merge
  queue and `push` to `main` still complete their post-merge proof instead of
  burning runner time on partially executed runs that GitHub cancels mid-flight.

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
  `pnpm validate:frontend-optimization` locally first. Workflow-only CI
  plumbing edits and generic feature-level `apps/code-t3` UI edits should stay in
  repository-governance or affected-build/test lanes instead of waking this
  browser/build gate.

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

Public workflow entrypoints currently include:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/codex-nightly.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/dependabot-auto-merge.yml`
- `.github/workflows/nightly.yml`
- `.github/workflows/pr-branch-maintenance.yml`
- `.github/workflows/pr-auto-merge.yml`
- `.github/workflows/release.yml`

## Rules

- Public workflows should compose reusable workflows instead of duplicating job definitions.
- Internal or tooling-only lanes should not be reintroduced as product-facing workflow entrypoints.
- Workflow docs must stay aligned with `scripts/check-workflow-governance.mjs`.
- Required merge-queue checks must trigger on `merge_group` as well as `pull_request`, or queued PRs will block waiting for checks that never report.
- Required workflows that protect merge queue or `main` should scope
  `cancel-in-progress` to PR events instead of cancelling all newer `push` or
  `merge_group` runs by default.
- Required checks that protect `main` should keep a stable aggregate check name even when the underlying reusable workflow fans out into parallel sub-jobs. This lets branch protection and merge queue wait on `Quality / Quality` and `PR Affected Checks / PR Affected Checks` while still shrinking wall-clock time.
- Shared Node/pnpm bootstrap should stay lockfile-first: prefetch with `pnpm fetch --frozen-lockfile`, then install with `pnpm install --offline --frozen-lockfile` unless a workflow has a documented reason to require a different install path.
- PR workflow gates may classify manifest-only dependency bumps before deciding whether expensive frontend lanes are needed; keep that classification script-backed and explicit instead of scattering ad hoc shell heuristics across workflows.
- Low-risk Dependabot development-version bumps may skip the expensive affected build/test lane when the remaining quality or frontend gates already cover the touched risk surface.
- `dependency-review.yml` should stay as the PR-time supply-chain gate for newly introduced vulnerable dependencies, with repo-owned policy living in `.github/dependency-review-config.yml`.
- `release.yml` should stay on the staged hybrid npm path until npm trusted publisher setup is complete: keep `id-token: write` and provenance enabled in GitHub Actions, but retain token auth as the temporary fallback release path.
- Public npm packages should publish with repo-owned `repository` metadata and `publishConfig.provenance: true` so npm provenance resolves back to the correct package directory in this monorepo.
- CodeQL should stay language-scoped and merge-queue-aware: npm-only updates should not queue Rust analysis, Rust-only updates should not queue JavaScript analysis, and when `MERGE_QUEUE_ENABLED=true` the PR path should fast-skip long CodeQL analysis in favor of `merge_group`, `push`, and scheduled scans.
- When a required workflow lane is intentionally idle, prefer a fast explicit skip inside the job over removing the check name entirely; this keeps branch protection stable while still reducing runner time.
- The shared `Quality` lane should reserve global governance checks for `repo_sot`-class changes. On normal product PRs, only run `ui:contract`, `check:circular`, and code-integration watch when their owned surfaces changed.
- Expensive frontend optimization lanes should restore Turbo cache before rebuilding so bundle-budget and targeted browser gates keep their coverage without recompiling from a cold local cache on every PR.
- Shared Playwright bootstrap should cache browser binaries by OS and lockfile
  so repeated frontend/browser gates do not redownload Chromium on every run.
- Exclude-heavy CI boundaries such as `quality_core`, `ui_contract`,
  `app_circular`, and `frontend_optimization` should stay script-backed in
  `scripts/classify-ci-change-scope.mjs` instead of relying on mixed positive
  and negative `paths-filter` globs.
- The `CI` workflow should keep those exclude-heavy boundaries out of
  `dorny/paths-filter` once the workflow consumes the script-backed outputs
  directly; do not carry duplicate YAML ownership maps for the same lane.
- Shared Playwright bootstrap should install Chromium with `--only-shell` when
  CI stays on the default headless Chromium lane without a `channel` override;
  this keeps browser downloads aligned with current Playwright guidance and
  avoids shipping unused headed binaries into every CI run.
- Shared Playwright bootstrap should cache browser binaries by OS and lockfile
  so repeated frontend/browser gates do not redownload Chromium on every run.
- Frontend optimization classification should stay focused on runtime or build-affecting frontend dependencies; pure type-package bumps should normally be covered by quality/typecheck instead of forcing bundle and browser lanes.
- Frontend optimization should wake for startup/build shell files,
  runtime-readiness wiring, Playwright/E2E owners, design-system surfaces,
  bundle-budget scripts, and frontend dependency churn. Generic `apps/code-t3`
  feature/component edits should normally stay out of that lane.
- Frontend optimization should not fan out for generic CI plumbing edits. Workflow-governance and shared action changes belong in repository governance lanes unless they also touch runtime-owning frontend or bundle-budget surfaces.
- Frontend optimization reusable-workflow edits should stay covered by workflow governance and validation, not by forcing the full browser and bundle lane on infrastructure-only pull requests.
- Runtime contract parity should stay scoped to runtime-owned contracts,
  runtime-client bindings, runtime specs, and runtime-parity scripts. CI entry
  workflows, reusable wrapper edits, and shared setup actions should stay in
  repository-governance validation unless a runtime-owned surface changed too.
- Affected-build and affected-test skip classification should stay split:
  storybook, fixture, and markdown-only support changes may skip
  `pnpm test:affected`, but real `.test` and `.spec` edits must continue to run
  the affected-test lane even when the affected-build lane can fast-skip.
- Workflow-governance regression tests for merge-queue paths, repo SOT, and CI
  scope classification should remain on the repository-governance path instead
  of waking product-facing quality or affected lanes by themselves.
- PR-triggered CodeQL lanes should stay path-scoped so dependency-only or docs-only changes do not fan out into static-analysis runs before `main`; keep broader protection on `push` to `main` and scheduled scans.
- Repo-governance-only pull requests should keep repository governance and required workflow visibility, but they should not wake up product-facing `Quality`, `frontend_optimization`, or affected-build/test execution when no product-owned surface changed.
- Public CodeQL workflows may still trigger for workflow-governance edits so syntax and required check names stay visible, but workflow-only changes should fast-skip heavyweight language-analysis lanes unless the owned product or build-runtime surfaces changed.
- Dependabot auto-merge must stay selective: only low-risk grouped updates such as `devcontainers-safe` and `github-actions-safe` should auto-enable merge after checks pass; runtime, frontend, and Rust dependency bumps remain manual-review lanes.
- Cross-directory Rust updates should prefer Dependabot `group-by: dependency-name` so the same crate bump lands in one PR across monorepo manifests instead of fan-out duplicates.
- Approved repo-hosted PRs may be updated with GitHub-native branch-update
  behavior when they are behind `main`, but the automation must leave `DIRTY`
  merge-conflict cases for manual resolution instead of attempting local merge
  or rebase repair.
- This repository defaults PR workflows to merge-queue fast-path behavior.
  Set the repo variable `MERGE_QUEUE_ENABLED=false` only when queue mode is
  intentionally disabled; otherwise keep branch-maintenance automation in
  report-only mode for `BEHIND` PRs. In queue mode, GitHub owns latest-base
  refresh and the maintenance workflow should only surface real conflicts or
  policy skips.
- When `MERGE_QUEUE_ENABLED` is not `false`, keep the PR fast path
  intentionally narrow:
  `pull_request` should prefer quick lint/typecheck/build proof, while heavy
  latest-base integration lanes such as runtime contract parity, affected test
  execution, and frontend optimization move to `merge_group`. Required
  aggregate check names stay stable; the queue run provides the final
  integration proof before merge.
- Apply the same principle to optional long-running security lanes: in
  merge-queue mode, PR-triggered CodeQL should remain visible but fast-skip
  analysis jobs, while `merge_group`, `push`, and scheduled runs carry the
  expensive scans.
- Auto-merge for non-Dependabot PRs should stay repo-branch-only and review-gated; the default path is "approved with no unresolved conversations means `gh pr merge --auto` is enabled unless the PR carries the opt-out `manual-merge` label."
- `PR Auto Merge` should not treat an existing auto-merge request as a final
  healthy state. When an approved PR is no longer in merge queue after
  GitHub removed it for timeout, latest-base conflict, or similar transient
  queue failure, the workflow should disable and re-enable auto-merge so the
  PR can be enqueued again.
- `PR Auto Merge` should also self-heal stale merge-queue entries: when an
  approved PR remains in `AWAITING_CHECKS` or `UNMERGEABLE` past the grace
  window and no matching `merge_group` run exists since enqueue time, dequeue
  and enqueue the current head SHA again instead of requiring a manual queue
  reset.
- npm Dependabot updates should prefer grouped low-risk development-version bumps to reduce queue pressure and redundant CI fan-out, while keeping higher-risk dependency changes in manual-review lanes.
