# PR Branch Maintenance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically update approved repo-hosted pull request branches when GitHub reports they are behind the base branch, and summarize true conflict cases without attempting automatic conflict resolution.

**Architecture:** Add a dedicated public workflow that evaluates eligible PRs in single-PR and repository-sweep modes, then invokes GitHub-native `gh pr update-branch` only for `BEHIND` PRs. Keep the existing auto-merge workflow focused on enabling auto-merge, and document the new workflow in the workflow map.

**Tech Stack:** GitHub Actions YAML, `gh` CLI, GraphQL via `gh api`, Vitest, workflow governance checks

---

### Task 1: Add workflow regression test coverage

**Files:**

- Create: `tests/scripts/pr-branch-maintenance-workflow.test.ts`

**Step 1: Write the failing test**

Assert that:

- `.github/workflows/pr-branch-maintenance.yml` exists
- it triggers on `pull_request_target`, `pull_request_review`, `push` to `main`, and `workflow_dispatch`
- it uses `gh pr update-branch`
- it filters to approved, resolved-thread, repo-hosted PRs
- it treats `DIRTY` as summary-only instead of update

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest --run tests/scripts/pr-branch-maintenance-workflow.test.ts`
Expected: FAIL because the workflow does not exist yet

### Task 2: Implement branch maintenance workflow

**Files:**

- Create: `.github/workflows/pr-branch-maintenance.yml`

**Step 1: Add workflow skeleton**

Include:

- `pull_request_target`
- `pull_request_review`
- `push` on `main`
- `workflow_dispatch`
- `contents: write`
- `pull-requests: write`

**Step 2: Implement evaluation logic**

Use `gh api graphql` to:

- read PR metadata
- filter out drafts, forks, `manual-merge`, unresolved review threads, and non-approved PRs
- update only when `mergeStateStatus=BEHIND`
- summarize `DIRTY` PRs

**Step 3: Implement mutation step**

Use:

- `gh pr update-branch <number>`

### Task 3: Document the workflow

**Files:**

- Modify: `docs/development/ci-workflows.md`

**Step 1: Add workflow to public workflow entrypoints**

Document `.github/workflows/pr-branch-maintenance.yml`

**Step 2: Document the rule**

Explain that approved repo PRs may be auto-updated with GitHub-native branch update behavior, while conflict cases remain manual-review lanes.

### Task 4: Verify

**Files:**

- Test: `tests/scripts/pr-branch-maintenance-workflow.test.ts`
- Test: `tests/scripts/check-workflow-governance.test.ts`

**Step 1: Run targeted tests**

Run: `pnpm -s vitest --run tests/scripts/pr-branch-maintenance-workflow.test.ts tests/scripts/check-workflow-governance.test.ts`

**Step 2: Run workflow governance**

Run: `pnpm check:workflow-governance`

**Step 3: Optional broader gate**

Run: `pnpm validate:full`
Expected: may expose unrelated repository-wide failures; report separately if outside touched scope
