# ChatGPT Workspace Deactivation Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local-Chrome CDP powered review-and-confirm flow that detects ChatGPT workspaces recorded on a Codex account but confirmed as deactivated on ChatGPT, then leaves those workspaces and refreshes account state.

**Architecture:** Keep browser automation behind app runtime facades instead of embedding CDP orchestration in React components. Electron owns local Chrome debugger endpoint discovery through the desktop host bridge, while the renderer facade owns review, matching, leave execution, and explicit result typing. The same facade surface remains reusable for a future Electron `webContents.debugger` adapter, while the current implementation prefers discovered local browser endpoints before falling back to common debug ports.

**Tech Stack:** TypeScript, React 19, Vitest, browser `fetch`/`WebSocket`, app runtime facades, Electron desktop host bridge compatibility

---

### Task 1: Refresh the plan and absorb the latest baseline

**Files:**

- Modify: `docs/plans/2026-03-27-chatgpt-workspace-deactivation-cleanup.md`

**Step 1: Update the plan to match the approved architecture**

Capture:

- Electron-first endpoint discovery via desktop host bridge
- runtime-facade-owned review and leave logic
- explicit `supported` / `blocked` / `failed` result handling
- post-leave OAuth refresh and default-workspace cleanup expectations

**Step 2: Safely absorb the latest baseline**

Run:

- `git diff > /tmp/feature-browser-prebaseline.patch`
- `git stash push -u -m "feature/browser pre-baseline sync"`
- `git fetch origin --prune`
- `git merge --ff-only origin/main`
- `git stash pop`

Expected:

- branch fast-forwards to the latest `origin/main`
- local worktree changes restore cleanly or produce only actionable conflicts in touched files

### Task 2: Add failing core automation tests

**Files:**

- Create: `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

**Step 1: Write the failing tests**

Add unit coverage for:

- local Chrome target discovery from `/json/version`
- matching local `chatgptWorkspaces` against ChatGPT-reported workspaces
- reporting only workspaces that exist locally and are confirmed `deactivated` remotely

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest --run apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

Expected: FAIL because the facade and matching helpers do not exist yet.

### Task 3: Add failing settings action coverage

**Files:**

- Modify: `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

**Step 1: Write the failing test**

Add a test that simulates:

- refresh/review action on a Codex account with stored `chatgptWorkspaces`
- runtime/browser facade returning one confirmed deactivated workspace
- confirm dialog approval
- leave action execution
- OAuth state refresh after completion

**Step 2: Run test to verify it fails**

Run: `pnpm -s vitest --run apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

Expected: FAIL because the UI action and facade wiring are missing.

### Task 4: Implement the local Chrome CDP facade and desktop endpoint discovery integration

**Files:**

- Create: `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.ts`
- Modify: `apps/code/src/application/runtime/ports/desktopHostBridge.ts`
- Modify: `apps/code-electron/src/main/createDesktopHostHandlers.ts`
- Create: `apps/code-electron/src/main/localChromeDebuggerDiscovery.ts`
- Modify: `apps/code-electron/src/main/registerDesktopHostIpc.ts`
- Modify: `apps/code-electron/src/preload/preload.ts`
- Modify: `apps/code-electron/src/shared/ipc.ts`
- Modify: `packages/code-platform-interfaces/src/index.ts`

**Step 1: Add the failing endpoint-resolution test case**

Cover:

- preference for desktop-host-discovered endpoints when available
- fallback to common localhost debug ports when the desktop host is unavailable
- blocked result when neither discovery path resolves a valid target

**Step 2: Run the core facade test to verify it fails**

Run: `pnpm -s vitest --run apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

Expected: FAIL for the new endpoint-resolution assertions.

**Step 3: Add local Chrome discovery and CDP transport helpers**

Implement:

- endpoint discovery over common localhost ports
- desktop host bridge endpoint discovery for Electron
- `/json/version` lookup
- a minimal JSON-RPC-over-WebSocket CDP session

**Step 4: Add ChatGPT workspace review and leave operations**

Implement:

- `reviewDeactivatedChatgptWorkspaces`
- `leaveChatgptWorkspaces`
- strict result typing for supported, blocked, and failed states
- resilient matching by workspace id and title
- actionable blocked messages for remote debugging unavailable, missing ChatGPT session, and known leave preconditions

**Step 5: Keep Electron extensibility explicit**

Structure the module so the local Chrome adapter is one implementation of a small automation client contract instead of page-owned logic.

**Step 6: Run the core facade test to verify it passes**

Run: `pnpm -s vitest --run apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`

Expected: PASS

### Task 5: Wire the settings review-and-confirm flow

**Files:**

- Modify: `apps/code/src/features/settings/components/sections/settings-codex-accounts-card/types.ts`
- Modify: `apps/code/src/features/settings/components/sections/settings-codex-accounts-card/useCodexAccountActions.ts`
- Modify: `apps/code/src/features/settings/components/sections/settings-codex-accounts-card/SettingsCodexAccountsTab.tsx`
- Modify: `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.tsx`

**Step 1: Add busy-state and action plumbing**

Add a dedicated busy action for reviewing and cleaning deactivated ChatGPT workspaces.

**Step 2: Add the review/confirm action**

When the user triggers the action:

- run the review facade
- surface a no-op notice when nothing is deactivated
- show a confirmation prompt when one or more deactivated workspaces are found
- execute leave operations only after confirmation
- refresh OAuth state after successful leave

**Step 3: Keep copy explicit**

Show actionable error text when local Chrome CDP is unavailable, including the need for a running Chrome remote-debugging session.

**Step 4: Normalize post-leave local state**

After a successful leave:

- clear removed workspace memberships from the local account snapshot
- clear `defaultChatgptWorkspaceId` when it points at a removed workspace
- rely on the canonical OAuth refresh to repopulate final state

**Step 5: Run the settings test to verify it passes**

Run: `pnpm -s vitest --run apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

Expected: PASS

### Task 6: Verify and prepare PR

**Files:**

- Test: `apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts`
- Test: `apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

**Step 1: Run targeted tests**

Run: `pnpm -s vitest --run apps/code/src/application/runtime/facades/chatgptWorkspaceAutomation.test.ts apps/code/src/features/settings/components/sections/SettingsCodexAccountsCard.test.tsx`

Expected: PASS

**Step 2: Run fast validation**

Run: `pnpm validate:fast`

Expected: PASS, or report only unrelated pre-existing failures if they appear.

**Step 3: Open or update the PR**

Run:

- `gh pr create --fill` if no PR exists for `feature/browser`
- otherwise `gh pr view --json number,url` and `gh pr edit` / `gh pr comment` as needed

Expected:

- a PR exists for the branch with an English summary covering the lifecycle-governance behavior, validation evidence, and any residual edge cases
