# Runtime Architecture Debt Inventory

## Highest-Value Debt

### 1. Shared client ownership is incomplete

- `packages/code-runtime-client` exists, but `apps/code/src/services/runtimeClient*.ts` still contains neighboring logic and types.
- `packages/code-runtime-webmcp-client` exists, but `apps/code/src/services/webMcpBridge*.ts` still contains duplicated type and behavior surfaces.

### 2. Public contract naming is still split

- `packages/code-runtime-host-contract` still carries `HypeCode*` mission-control types plus `HugeCode*` compatibility aliases.
- Downstream packages mix both names.

### 3. Client-side fallback surfaces are too broad

- event transport fallback
- text-file fallback
- thread snapshot fallback
- diagnostics/session portability/security preflight fallbacks

### 4. Shared workspace shell still consumes legacy mission-control naming

- `packages/code-workspace-client` uses `HypeCodeMissionControl*` and `HypeCodeReviewPack*` names.

## Duplicate Contracts and DTOs

- `apps/code/src/services/webMcpBridgeTypes.ts`
  Duplicates the shared WebMCP/runtime-agent type surface.
- `apps/code/src/services/runtimeClientTypes.ts`
  Duplicates runtime-client type ownership beside `packages/code-runtime-client`.
- app-local WebMCP schema-validation shim files still exist in `apps/code/src/services/*` instead of consumers depending directly on package-owned modules.

## Compatibility Surfaces

- `codeRuntimeRpcCompat`
  Still public and broad.
- `hugeCodeMissionControlCompat`
  Alias bridge still needed because downstream packages have not fully migrated.
- deprecated Tauri aggregation surfaces are blocked by tests, which is good, but their existence shows the repo is still carrying compatibility cleanup work.

## Suspicious Layering

- `apps/code/src/application/runtime/facades/*`
  Large and numerous. Some are correct app-facing facades; some still compensate for missing canonical projections or naming cleanup.
- `apps/code/src/services/*`
  Wide runtime/Tauri/WebMCP layer. Too much system knowledge still sits under the app.
- `packages/code-runtime-service-rs/src/lib.rs`
  Very broad import surface, which suggests runtime subsystems are still coupled at the top level.

## Persistence and State Risks

- Runtime checkpoints and journals are already runtime-owned.
- Risk remains in client-side stores and fallbacks that can preserve session/thread/projection state outside runtime.

## Monorepo Risks

- Extracted packages and app-local copies coexist.
- Installed dependency state currently blocks `pnpm check:circular`, so one graph guard is not verifiable in the current workspace state.

## Immediate Deletion Candidates

- app-local duplicated WebMCP/runtime-agent type ownership in `apps/code/src/services/webMcpBridgeTypes.ts`
- lingering app-local imports of package-owned runtime-client/WebMCP primitives
- downstream uses of `HypeCode*` aliases in shared client packages once canonical `HugeCode*` imports are migrated
