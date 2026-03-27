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
- Filled missing `HugeCode*` alias exports in the host contract layer

### Step 3. Runtime client type ownership consolidation

- Moved the canonical `RuntimeClient` interface into `@ku0/code-runtime-client`
- Converted `apps/code/src/services/runtimeClientTypes.ts` into an app-local generic instantiation shim

### Step 4. App-local runtime helper shim deletion

- Migrated `apps/code` runtime/WebMCP helper imports from local service shims to
  `@ku0/code-runtime-client` and `@ku0/code-runtime-webmcp-client`
- Deleted 15 app-local shim files from `apps/code/src/services`
- Restored `application/runtime/ports/*` as the frontend boundary instead of
  letting package imports leak through the runtime infrastructure aggregator
- Collapsed `packages/code-runtime-webmcp-client/src/webMcpInputSchemaValidationError.ts`
  into a compatibility re-export of the canonical runtime-client implementation

### Step 5. Final app-local runtime client type shim deletion

- Folded the `RuntimeClient<AppSettings>` specialization into `apps/code/src/services/runtimeClient.ts`
- Migrated all remaining local consumers off `apps/code/src/services/runtimeClientTypes.ts`
- Deleted `apps/code/src/services/runtimeClientTypes.ts`

### Step 6. Host-contract internal canonical naming shift

- Migrated `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts` from direct `HypeCode*` mission-control imports to `HugeCode*` aliases
- Kept the public compat surface stable while removing another active internal dependency on legacy names

### Step 7. Host-contract root export cleanup

- Renamed `hugeCodeMissionControlCompat.ts` into canonical `hugeCodeMissionControl.ts`
- Deleted the old compat file and pointed `codeRuntimeRpc.ts` at the canonical module
- Removed `HypeCode*` mission-control names from the package root entrypoint
- Exposed legacy names only through the explicit `./hypeCodeMissionControl` subpath

### Step 8. Host-contract mission-control compat deletion

- Replaced the alias-only `hugeCodeMissionControl.ts` bridge with canonical `HugeCode*` source definitions
- Exported canonical `HUGECODE_*` value constants from the package root
- Deleted `packages/code-runtime-host-contract/src/hypeCodeMissionControl.ts`
- Removed the `./hypeCodeMissionControl` package subpath entirely

### Step 9. WebMCP schema-validation compat deletion

- Migrated the last active app consumer off `@ku0/code-runtime-webmcp-client/webMcpInputSchemaValidationError`
- Deleted `packages/code-runtime-webmcp-client/src/webMcpInputSchemaValidationError.ts`
- Removed the package subpath so schema-validation errors now come only from `@ku0/code-runtime-client`

## Next steps

### Step 10. Collapse mission-control snapshot/projection fallback logic

Target:

- shared workspace shell reads kernel projection and runtime snapshot truth only
- remove local projection fallback logic that reconstructs equivalent truth from older shapes

### Step 11. Reduce desktop bridge surface to host adaptation only

Target:

- remove runtime-domain normalization from desktop adapters where canonical contract types already exist
- keep only transport adaptation and platform-specific error mapping

### Step 12. Delete the remaining broad compat helpers

Target:

- narrow `codeRuntimeRpcCompat` to frozen wire-field aliasing only
- remove convenience/domain helpers that still let clients depend on compatibility behavior

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
