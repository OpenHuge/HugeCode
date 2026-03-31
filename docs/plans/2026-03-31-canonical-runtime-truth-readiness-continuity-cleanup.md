# Canonical Runtime Truth, Readiness, And Continuity Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make runtime-authored or canonical contract-authored summaries the single source of truth for readiness, mission-control state, and continuity semantics, while shrinking client compatibility logic to wire aliases and explicitly temporary fallback.

**Architecture:** `packages/code-runtime-host-contract` becomes the canonical owner for shared readiness and mission-control summary semantics on top of runtime snapshot truth that already carries `continuation`, `nextOperatorAction`, `sessionBoundary`, `takeoverBundle`, `missionLinkage`, `reviewActionability`, and `publishHandoff`. `packages/code-workspace-client` and `apps/code` become consumers of those canonical helpers, and local thread/session persistence fallbacks become explicitly non-authoritative recovery shims with telemetry instead of ambient truth sources.

**Tech Stack:** TypeScript, pnpm monorepo, Vitest, React app runtime facades, shared host-contract package

---

### Task 1: Lock the duplicated ownership points with failing tests

**Files:**

- Test: `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.test.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeLaunchReadiness.test.ts`
- Test: `apps/code/src/services/tauriThreadSnapshotsBridge.test.ts`

**Step 1: Write the failing tests**

Cover:

- shared mission-control summary preferring canonical `continuation` / `nextOperatorAction` over ad hoc fragment inspection
- launch readiness composition moving to a shared canonical helper without changing current semantics
- thread snapshot/session fallback logging or telemetry when session or legacy local fallback is used

**Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @ku0/code-workspace-client test -- sharedMissionControlSummary.test.ts
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/runtimeLaunchReadiness.test.ts src/services/tauriThreadSnapshotsBridge.test.ts
```

Expected: FAIL because summary ownership and fallback telemetry are not yet centralized.

### Task 2: Add canonical host-contract summary helpers

**Files:**

- Add: `packages/code-runtime-host-contract/src/runtimeMissionControlSummary.ts`
- Modify: `packages/code-runtime-host-contract/src/index.ts`
- Test: `packages/code-runtime-host-contract/src/runtimeMissionControlSummary.test.ts`

**Step 1: Write the failing contract tests**

Cover:

- launch readiness summary composition
- shared mission-control summary composition from runtime snapshot truth
- canonical preference for `continuation` and `nextOperatorAction`
- fallback to fragment-based compat only when canonical fields are absent

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @ku0/code-runtime-host-contract test -- runtimeMissionControlSummary.test.ts
```

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Create a canonical contract helper that:

- owns launch-readiness summary composition
- owns shared mission-control summary composition
- reads `continuation` and `nextOperatorAction` first
- keeps review and mission-item presentation semantics as projection-only logic over canonical run/review fields

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @ku0/code-runtime-host-contract test -- runtimeMissionControlSummary.test.ts
```

Expected: PASS

### Task 3: Narrow workspace-client summary composition to a projection wrapper

**Files:**

- Modify: `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts`
- Modify: `packages/code-workspace-client/src/workspace-shell/missionControlSummaryLoader.ts`
- Test: `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.test.ts`

**Step 1: Use the failing summary test as the red/green guard**

Run:

```bash
pnpm --filter @ku0/code-workspace-client test -- sharedMissionControlSummary.test.ts
```

**Step 2: Write minimal implementation**

- Replace local readiness and mission/review semantic recomputation with the shared host-contract helper.
- Keep only thin package-local exports or naming compatibility if still needed.

**Step 3: Re-run the targeted workspace-client test**

Run:

```bash
pnpm --filter @ku0/code-workspace-client test -- sharedMissionControlSummary.test.ts
```

Expected: PASS

### Task 4: Reduce app launch/continuity adapters to canonical helper consumers

**Files:**

- Modify: `apps/code/src/application/runtime/facades/runtimeLaunchReadiness.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeContinuityReadiness.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeMissionControlOrchestration.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeLaunchReadiness.test.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeContinuityReadiness.test.ts`

**Step 1: Use targeted app tests as the red/green guard**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/runtimeLaunchReadiness.test.ts src/application/runtime/facades/runtimeContinuityReadiness.test.ts
```

**Step 2: Write minimal implementation**

- Re-export or adapt the canonical contract helper for launch readiness.
- Keep continuity wrapper logic limited to candidate selection and UI shaping.
- Do not reintroduce new route or continuation precedence in the app layer.

**Step 3: Re-run the targeted app tests**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/runtimeLaunchReadiness.test.ts src/application/runtime/facades/runtimeContinuityReadiness.test.ts
```

Expected: PASS

### Task 5: Split compat truth from fallback telemetry

**Files:**

- Add or modify: `apps/code/src/application/runtime/facades/runtimeTruthCompatTelemetry.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeMissionControlRunProjection.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeMissionControlReviewPackProjection.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeMissionControlFacade.test.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.test.ts`

**Step 1: Write failing tests**

Cover:

- telemetry/logging when `continuation`, `sessionBoundary`, or `nextOperatorAction` must be synthesized from compat fallback instead of runtime-published canonical fields
- no telemetry when canonical fields are already present

**Step 2: Run targeted tests to verify they fail**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/runtimeMissionControlFacade.test.ts src/application/runtime/facades/runtimeReviewPackSurfaceFacade.test.ts
```

Expected: FAIL because fallback telemetry is not emitted yet.

**Step 3: Write minimal implementation**

- Keep aliasing in `codeRuntimeRpcCompat.ts`.
- Keep canonical fallback resolution in host-contract compat helpers.
- Add app-local telemetry only when those compat paths are actually consumed by first-party projections.

**Step 4: Re-run targeted tests**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/application/runtime/facades/runtimeMissionControlFacade.test.ts src/application/runtime/facades/runtimeReviewPackSurfaceFacade.test.ts
```

Expected: PASS

### Task 6: Demote local thread/session persistence fallback to explicit temporary recovery behavior

**Files:**

- Modify: `apps/code/src/services/tauriThreadSnapshotsBridge.ts`
- Modify: `apps/code/src/features/threads/hooks/useThreadStorage.ts`
- Test: `apps/code/src/services/tauriThreadSnapshotsBridge.test.ts`
- Test: `apps/code/src/features/threads/hooks/useThreadStorage.test.tsx`

**Step 1: Write failing tests**

Cover:

- session-mirrored thread storage is marked non-authoritative and logged when used
- legacy localStorage snapshot hydration is logged as temporary fallback
- native/runtime-backed persistence remains preferred when available

**Step 2: Run targeted tests to verify they fail**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/tauriThreadSnapshotsBridge.test.ts src/features/threads/hooks/useThreadStorage.test.tsx
```

Expected: FAIL because fallback usage is silent and still treated as ambient recovery state.

**Step 3: Write minimal implementation**

- Add explicit telemetry/logging for session overlay and legacy local snapshot hydration.
- Keep fallback behavior temporary and clearly non-authoritative in code comments and copy.
- Avoid changing host cutover or transport ownership.

**Step 4: Re-run targeted tests**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/tauriThreadSnapshotsBridge.test.ts src/features/threads/hooks/useThreadStorage.test.tsx
```

Expected: PASS

### Task 7: Document the new canonical ownership and fallback retirement path

**Files:**

- Modify: `docs/runtime/runtime-continuity-readiness.md`
- Modify: `docs/runtime/runtime-launch-readiness.md`
- Modify: `docs/runtime/code-runtime-contract-compat.md`
- Modify: `docs/architecture/debt-inventory.md`

**Step 1: Record the new ownership**

Document:

- what is now runtime-owned
- what is contract-helper-owned
- where UI is formatting-only
- what fallback remains and how telemetry marks it

**Step 2: Verify stale ownership language is gone**

Run:

```bash
rg -n "buildSharedMissionControlSummary|silent fallback|snapshot fallback|session fallback|launch readiness is still derived only in app runtime facades" docs apps/code/src packages
```

Expected: only intentional updated references remain.

### Task 8: Run final targeted verification

**Files:**

- Verify only

**Step 1: Run shared package tests**

Run:

```bash
pnpm --filter @ku0/code-runtime-host-contract test -- runtimeContinuationFacade.test.ts runtimeMissionControlSummary.test.ts
pnpm --filter @ku0/code-workspace-client test -- sharedMissionControlSummary.test.ts missionControlBindings.test.ts
```

Expected: PASS

**Step 2: Run targeted app tests**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts \
  src/application/runtime/facades/runtimeLaunchReadiness.test.ts \
  src/application/runtime/facades/runtimeContinuityReadiness.test.ts \
  src/application/runtime/facades/runtimeMissionControlFacade.test.ts \
  src/application/runtime/facades/runtimeReviewPackSurfaceFacade.test.ts \
  src/services/tauriThreadSnapshotsBridge.test.ts \
  src/features/threads/hooks/useThreadStorage.test.tsx
```

Expected: PASS

**Step 3: Run boundary and contract verification**

Run:

```bash
pnpm ui:contract
pnpm check:runtime-contract
```

Expected: PASS
