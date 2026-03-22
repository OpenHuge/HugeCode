# Runtime Architecture Migration Plan

## Goal

Collapse duplicated runtime-adjacent ownership into the canonical path while deleting replaced code immediately.

## Completed in this wave

### Step 1. Architecture truth inventory

- Added `current-state.md`
- Added `debt-inventory.md`

### Step 2. WebMCP type ownership consolidation

- Canonicalized shared WebMCP/runtime-agent type naming to `HugeCode*`
- Converted `apps/code/src/services/webMcpBridgeTypes.ts` from a full duplicate into a package shim
- Migrated `packages/code-workspace-client` mission-control consumers to `HugeCode*`
- Filled missing `HugeCode*` alias exports in the host contract compat layer

### Step 3. Runtime client type ownership consolidation

- Moved the canonical `RuntimeClient` interface into `@ku0/code-runtime-client`
- Converted `apps/code/src/services/runtimeClientTypes.ts` into an app-local generic instantiation shim

## Next steps

### Step 4. Delete remaining app-local runtime-client helpers that are already package-owned

Target:

- `apps/code/src/services/runtimeClientCapabilitiesContract.ts`
- `apps/code/src/services/runtimeClientErrorUtils.ts`
- `apps/code/src/services/runtimeClientMethodSets.ts`
- `apps/code/src/services/runtimeClientWebRequestTimeouts.ts`
- `apps/code/src/services/runtimeClientWebRetryUtils.ts`
- `apps/code/src/services/runtimeEvent*`
- remaining WebMCP schema/helper shims

Rule:

- if the app file is only a compatibility re-export, migrate imports and delete it
- if the app file still diverges, move the canonical version into the package first, then delete the app copy

### Step 5. Collapse mission-control snapshot/projection fallback logic

Target:

- shared workspace shell reads kernel projection and runtime snapshot truth only
- remove local projection fallback logic that reconstructs equivalent truth from older shapes

### Step 6. Reduce Tauri bridge surface to host adaptation only

Target:

- remove runtime-domain normalization from Tauri adapters where canonical contract types already exist
- keep only transport adaptation and platform-specific error mapping

### Step 7. Shrink public compat surface

Target:

- stop exposing legacy mission-control names to active consumers
- narrow root-level compat exports once downstream imports are migrated

## Validation gates

Minimum for each migration slice:

- touched package `typecheck`
- touched package `test`
- `apps/code` typecheck when shared runtime-client or WebMCP surfaces change

Escalate to:

- `pnpm check:runtime-contract`
- `pnpm ui:contract`
- `pnpm validate`

when transport contracts or app/runtime boundaries move.
