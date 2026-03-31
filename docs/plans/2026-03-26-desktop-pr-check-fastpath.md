# Desktop PR Check Fast Path Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the non host-owned desktop PR Linux fast path full desktop host build with a cheaper frontend-prebuild plus desktop-check gate.

**Architecture:** The desktop workflow will mark the Linux-only PR fast path as `check` mode instead of `build` mode. The reusable PR desktop workflow will branch on that mode, and `apps/code-electron/scripts/check-fast.mjs` will skip `cargo check` when CI diff refs prove no Rust inputs changed.

**Tech Stack:** GitHub Actions workflows, Node ESM scripts, Vitest, desktop-host/Rust CI helpers

---

### Task 1: Add failing workflow regression coverage

**Files:**

- Modify: `tests/scripts/optional-pr-workflow-scope.test.ts`

**Step 1: Write the failing test**

Add assertions that the Linux-only PR fast path passes `verification_mode: check` and a PR base-branch input to the reusable desktop workflow.

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest --run tests/scripts/optional-pr-workflow-scope.test.ts`

Expected: FAIL because the workflow still wires the Linux-only PR fast path to the build mode.

### Task 2: Add failing `check-fast` diff-skip coverage

**Files:**

- Modify: `tests/scripts/check-fast.test.ts`

**Step 1: Write the failing test**

Create a fixture git repo with a frontend-only commit and run `apps/code-electron/scripts/check-fast.mjs` with explicit base/head refs.

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest --run tests/scripts/check-fast.test.ts`

Expected: FAIL because `check-fast.mjs` still runs cargo without consulting CI diff refs.

### Task 3: Implement workflow check mode

**Files:**

- Modify: `.github/workflows/desktop.yml`
- Modify: `.github/workflows/_reusable-desktop-build-pr.yml`

**Step 1: Add a reusable workflow input for verification mode**

Add `verification_mode` and a PR base-branch input to the reusable PR desktop workflow.

**Step 2: Route Linux-only non host-owned PRs to check mode**

Pass `verification_mode: check` from `build-pr-fast`, keep `build-pr-full` on the default full-build path, and fetch the PR base branch before running check mode.

### Task 4: Implement CI diff-aware `check-fast`

**Files:**

- Modify: `apps/code-electron/scripts/check-fast.mjs`

**Step 1: Add CI diff helper logic**

Resolve git diff args for explicit base/head refs and detect whether any Rust inputs changed under `apps/code-electron/desktop-host`.

**Step 2: Skip cargo work when the diff proves no Rust input changes**

If explicit refs are provided and no Rust inputs changed, log the skip and exit successfully before acquiring the cargo target build lock.

### Task 5: Wire the cheaper desktop gate

**Files:**

- Modify: `.github/workflows/_reusable-desktop-build-pr.yml`
- Modify: `docs/development/ci-workflows.md`

**Step 1: Replace build mode for fast PRs with the cheap gate**

In `check` mode run:

- `pnpm check:desktop-capabilities`
- `pnpm --filter @ku0/code-electron run check`

**Step 2: Document the new rule**

Document that frontend/runtime-only desktop PRs keep frontend prebuild proof and desktop capability/Rust-check proof, while host-owned PRs and mainline still keep full desktop host builds.

### Task 6: Verify

**Files:**

- Test: `tests/scripts/optional-pr-workflow-scope.test.ts`
- Test: `tests/scripts/check-fast.test.ts`

**Step 1: Run targeted tests**

Run: `pnpm -s vitest --run tests/scripts/optional-pr-workflow-scope.test.ts tests/scripts/check-fast.test.ts tests/scripts/check-workflow-governance.test.ts`

Expected: PASS

**Step 2: Run workflow governance**

Run: `pnpm check:workflow-governance`

Expected: PASS

**Step 3: Run full validation**

Run: `pnpm validate:full`

Expected: reproduce only the known unrelated failures in:

- `tests/scripts/design-system-package-exports.test.ts`
- `tests/scripts/check-design-system-family-adoption.test.ts`
