# Workspace Runtime Disconnect Steady Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep `/workspaces/:name` inside the workspace layout when runtime connectivity fails, and show reconnect guidance inside the workspace instead of falling back to Home.

**Architecture:** Preserve route intent separately from resolved active workspace truth. The layout should continue rendering the workspace shell when the route still targets a workspace, while the message lane reuses the runtime status banner as the in-workspace disconnected prompt.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the regression with failing tests

**Files:**

- Modify: `apps/code/src/features/workspaces/hooks/useWorkspaces.test.tsx`
- Modify: `apps/code/src/features/app/hooks/useMainAppHomeState.test.tsx`

**Step 1: Write the failing tests**

- Add a `useWorkspaces` test proving a `/workspaces/:id` route remains identifiable as a workspace route even when workspace loading fails.
- Add a `useMainAppHomeState` test proving desktop `showHome` stays `false` when the UI is on a workspace route but the runtime can no longer resolve an active workspace.

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest apps/code/src/features/workspaces/hooks/useWorkspaces.test.tsx apps/code/src/features/app/hooks/useMainAppHomeState.test.tsx`

Expected: failures showing workspace route intent is not preserved and the shell still falls back to Home.

### Task 2: Preserve workspace-route intent into layout state

**Files:**

- Modify: `apps/code/src/features/workspaces/hooks/useWorkspacesCore.ts`
- Modify: `apps/code/src/features/app/composition/useDesktopWorkspaceConversationDomain.ts`
- Modify: `apps/code/src/features/app/composition/useDesktopWorkspaceChromeDomain.ts`
- Modify: `apps/code/src/features/app/hooks/useMainAppHomeState.ts`

**Step 1: Expose workspace-route intent from `useWorkspaces`**

- Return a boolean or route selection signal that says the current route still targets a workspace even if `activeWorkspaceId` cannot be resolved.

**Step 2: Keep desktop shell on workspace mode**

- Update `useMainAppHomeState` so desktop `showHome` depends on route intent, not only `activeWorkspaceId`.
- Update `useDesktopWorkspaceChromeDomain` so `AppLayout` keeps rendering workspace chrome when a workspace route is active but unresolved.

**Step 3: Keep truth boundaries explicit**

- Do not synthesize a fake active workspace object.
- Do not revive cached workspace data as canonical truth.

### Task 3: Keep the disconnected guidance inside the workspace lane

**Files:**

- Modify: `apps/code/src/features/messages/utils/timelineSurface.ts`
- Modify: `apps/code/src/features/messages/components/Messages.turn-and-plan-ui.test.tsx`

**Step 1: Refine workspace runtime-disconnect copy**

- Update the runtime-unavailable timeline banner copy so it clearly says the workspace remains open, reconnection is needed, and another workspace can be chosen from the sidebar when available.

**Step 2: Verify the banner still renders inside the message lane**

- Update or extend message-lane tests to assert the in-workspace guidance remains visible and still routes to settings.

### Task 4: Verify and launch for manual testing

**Files:**

- Modify: none

**Step 1: Re-run focused tests**

Run: `pnpm vitest apps/code/src/features/workspaces/hooks/useWorkspaces.test.tsx apps/code/src/features/app/hooks/useMainAppHomeState.test.tsx apps/code/src/features/messages/components/Messages.turn-and-plan-ui.test.tsx`

Expected: all targeted tests pass.

**Step 2: Run the repo fast gate**

Run: `pnpm validate:fast`

Expected: exit 0.

**Step 3: Start the UI dev server**

Run: `pnpm dev:code:ui`

Expected: Vite serves the UI for manual verification.
