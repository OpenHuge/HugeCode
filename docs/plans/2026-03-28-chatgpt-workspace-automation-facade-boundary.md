# ChatGPT Workspace Automation Facade Boundary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move settings/browser automation consumers onto a single approved runtime facade entrypoint that matches the PR #141 and PR #142 boundary style.

**Architecture:** Introduce a dedicated feature-facing facade file for ChatGPT workspace automation, keep the existing module as the internal implementation layer, then add guard coverage so feature code cannot bypass the approved facade path again.

**Tech Stack:** TypeScript, React, Vitest, repo boundary scripts

---

### Task 1: Add the approved facade entrypoint

**Files:**

- Create: `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomationFacade.ts`
- Modify: `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

**Step 1: Write the failing test**

Add a focused runtime test that imports the new facade entrypoint and asserts it exposes the existing settings-facing actions and types.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

Expected: FAIL because the new facade file does not exist yet.

**Step 3: Write minimal implementation**

Create `chatgptWorkspaceAutomationFacade.ts` as the approved entrypoint that re-exports:

- `reviewDeactivatedChatgptWorkspaces`
- `leaveDeactivatedChatgptWorkspaces`
- settings-facing result and candidate types

Keep all implementation logic in `chatgptWorkspaceAutomation.ts`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/code/src/application/runtime/facades/chatgptWorkspaceAutomationFacade.ts apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts
git commit -m "refactor: add chatgpt automation facade entrypoint"
```

### Task 2: Move settings consumers onto the approved facade

**Files:**

- Modify: `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx`
- Modify: `apps/code/src/features/settings/components/sections/settings-codex-accounts-card/useCodexAccountActions.ts`
- Modify: `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

**Step 1: Write the failing test**

Update the settings card test mocks so they target the new facade path.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

Expected: FAIL until the feature imports are migrated.

**Step 3: Write minimal implementation**

Replace direct imports of `chatgptWorkspaceAutomation` with imports from `chatgptWorkspaceAutomationFacade`.
Do not change user-visible behavior.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx apps/code/src/features/settings/components/sections/settings-codex-accounts-card/useCodexAccountActions.ts apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx
git commit -m "refactor: route settings through chatgpt automation facade"
```

### Task 3: Add boundary guard coverage

**Files:**

- Modify: `scripts/lib/ui-service-boundary.mjs`
- Modify: `tests/scripts/ui-service-boundary.test.ts`

**Step 1: Write the failing test**

Add one test that rejects a feature import from `application/runtime/facades/chatgptWorkspaceAutomation` and one test that allows `application/runtime/facades/chatgptWorkspaceAutomationFacade`.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scripts/ui-service-boundary.test.ts`

Expected: FAIL because the new rule does not exist yet.

**Step 3: Write minimal implementation**

Add a new rule to `ui-service-boundary.mjs` that blocks direct implementation imports from UI/product code while allowing the approved facade file.

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scripts/ui-service-boundary.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/lib/ui-service-boundary.mjs tests/scripts/ui-service-boundary.test.ts
git commit -m "test: guard chatgpt automation facade boundary"
```

### Task 4: Run end-to-end validation for the slice

**Files:**

- Modify: none unless validation exposes regressions

**Step 1: Run targeted verification**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx
pnpm exec vitest run tests/scripts/ui-service-boundary.test.ts
node scripts/check-ui-service-boundary.mjs
pnpm validate
```

Expected: PASS, or a clearly scoped pre-existing failure.

**Step 2: Fix only real regressions**

If validation exposes boundary or import regressions, adjust the facade or guard with the smallest change that preserves the approved architecture.

**Step 3: Final commit**

```bash
git add apps/code/src/application/runtime/facades/chatgptWorkspaceAutomationFacade.ts apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx apps/code/src/features/settings/components/sections/settings-codex-accounts-card/useCodexAccountActions.ts apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx scripts/lib/ui-service-boundary.mjs tests/scripts/ui-service-boundary.test.ts docs/plans/2026-03-28-chatgpt-workspace-automation-facade-boundary-design.md docs/plans/2026-03-28-chatgpt-workspace-automation-facade-boundary.md
git commit -m "refactor: align chatgpt automation with facade boundary"
```
