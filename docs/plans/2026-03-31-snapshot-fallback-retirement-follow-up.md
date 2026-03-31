# Snapshot Fallback Retirement Follow-Up

**Goal:** Reduce the remaining session/local snapshot fallback surface after canonical runtime truth consolidation, keep runtime-published snapshot truth authoritative, and make the next fallback deletion step lower-risk.

**Scope:** `apps/code` thread snapshot/session fallback behavior, legacy local snapshot migration fencing, fallback observability, and targeted regression coverage.

## Inventory

- `apps/code/src/services/threadSnapshotsBridge.ts`
  Session thread snapshot state still overlays an empty runtime response, even when there is no clear evidence that the empty runtime state only reflects an in-flight same-tab recovery window.
- `apps/code/src/features/threads/hooks/useThreadStorage.ts`
  Legacy local `loadThreadSnapshots()` hydration still restores thread snapshots after a successful native read that returns empty snapshots.
- `apps/code/src/features/threads/utils/threadStorage.ts`
  Legacy local thread snapshot helpers and storage key remain as migration residue.

## Implementation Steps

1. Add failing tests that prove empty-runtime session overlay is only allowed during an explicit short-lived recovery window and that stale session snapshot state no longer silently regains authority.
2. Narrow `threadSnapshotsBridge.ts` so:
   - runtime-unavailable reads may still use full session recovery,
   - runtime-available-but-empty reads only use session snapshot overlay when an explicit fresh recovery marker exists,
   - otherwise runtime truth stays authoritative and only client-owned session state is merged.
3. Fence the legacy local snapshot migration path in `useThreadStorage.ts` more clearly as one-time migration residue and strengthen telemetry so ignored-vs-used residue is observable.
4. Run focused tests for bridge, hook, and nearby bindings/storage surfaces.
5. Open a focused PR that documents what was removed, what remains temporary, and what next deletion step is unlocked.

## Success Criteria

- Empty runtime responses no longer automatically reactivate session snapshot truth.
- Remaining fallback paths are explicitly temporary and recovery-only.
- Fallback reporting distinguishes runtime unavailable, recovery-window overlay, and ignored migration residue.
- Targeted tests protect runtime-authoritative precedence.
