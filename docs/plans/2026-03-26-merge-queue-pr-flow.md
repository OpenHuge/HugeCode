# Merge Queue PR Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `main` from strict branch-refresh semantics to merge queue semantics and make PR maintenance automation stop fighting the queue.

**Architecture:** Keep the existing stable aggregate required checks on `CI`, use merge queue for latest-base validation, and make `PR Branch Maintenance` detect queue mode so it only reports true conflicts instead of mutating healthy PR branches. Repository settings change and workflow behavior change land together so automation matches the new merge path.

**Tech Stack:** GitHub Actions YAML, GitHub branch protection and merge queue settings, Vitest workflow tests, GitHub CLI

---

### Task 1: Update design and operator docs

**Files:**

- Create: `docs/plans/2026-03-26-merge-queue-pr-flow-design.md`
- Create: `docs/plans/2026-03-26-merge-queue-pr-flow.md`
- Modify: `docs/development/ci-workflows.md`
- Modify: `docs/development/README.md`

**Step 1: Document the approved design**

Write the merge-queue migration rationale, the current strict-protection problem, and the queue-aware workflow behavior.

**Step 2: Document operator-facing behavior**

Describe that `main` merges should go through merge queue and that branch maintenance should only report real conflicts in queue mode.

**Step 3: Verify doc references stay aligned**

Run: `rg -n "merge queue|update branch|PR Branch Maintenance" docs/development docs/plans`

Expected: updated docs mention queue-first merge behavior and queue-aware branch maintenance.

### Task 2: Add failing workflow tests for queue-aware maintenance

**Files:**

- Modify: `tests/scripts/pr-branch-maintenance-workflow.test.ts`

**Step 1: Add the failing assertions**

Add assertions that the workflow:

- detects queue mode explicitly
- skips `gh pr update-branch` when queue mode is enabled
- still records conflict-only summaries

**Step 2: Run the focused test**

Run: `pnpm -s vitest --run tests/scripts/pr-branch-maintenance-workflow.test.ts`

Expected: fail until the workflow logic is updated.

### Task 3: Make `PR Branch Maintenance` queue-aware

**Files:**

- Modify: `.github/workflows/pr-branch-maintenance.yml`

**Step 1: Detect queue mode**

Read repository protection or ruleset state inside the workflow so it can distinguish classic strict protection from merge queue operation.

**Step 2: Remove branch mutation in queue mode**

When queue mode is active:

- do not run `gh pr update-branch`
- summarize `BEHIND` PRs as queue-managed instead of mutating them

**Step 3: Preserve classic fallback behavior**

If queue mode is not active, keep the current GitHub-native `update-branch` behavior for `BEHIND` PRs.

**Step 4: Re-run the focused test**

Run: `pnpm -s vitest --run tests/scripts/pr-branch-maintenance-workflow.test.ts`

Expected: pass.

### Task 4: Run governance validation

**Files:**

- Modify: `.github/workflows/pr-branch-maintenance.yml`
- Modify: `docs/development/ci-workflows.md`
- Modify: `docs/development/README.md`
- Modify: `tests/scripts/pr-branch-maintenance-workflow.test.ts`

**Step 1: Run targeted workflow checks**

Run: `pnpm -s vitest --run tests/scripts/pr-branch-maintenance-workflow.test.ts tests/scripts/check-workflow-governance.test.ts`

Expected: all tests pass.

**Step 2: Run workflow governance**

Run: `pnpm check:workflow-governance`

Expected: pass.

### Task 5: Enable merge queue on the repository

**Files:**

- No tracked file changes

**Step 1: Verify current state**

Run:

- `gh api repos/OpenHuge/HugeCode/branches/main/protection`
- `gh api repos/OpenHuge/HugeCode/rulesets`

Expected: confirm current strict branch protection and no active ruleset.

**Step 2: Enable merge queue in GitHub settings**

Use repository settings to switch `main` to merge queue semantics while preserving the stable required check names.

**Step 3: Re-verify repository state**

Run the same `gh api` commands again and confirm queue/ruleset state reflects the new merge path.

### Task 6: Deliver the migration with explicit residual risks

**Files:**

- None

**Step 1: Summarize changed workflow behavior**

State that queue mode removes repeated `update branch` churn and keeps conflict reporting.

**Step 2: Call out remaining risk**

Note any CI lanes that are still slow even after queue adoption, so follow-up work can focus on real execution hotspots rather than branch refresh churn.
