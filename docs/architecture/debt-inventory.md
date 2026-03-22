# Runtime Architecture Debt Inventory

## Highest-Value Debt

### 1. Shared client ownership is incomplete

- `packages/code-runtime-client` exists, but `apps/code/src/services/runtimeClient*.ts` still contains neighboring behavior and one remaining app-local type-instantiation shim.
- `packages/code-runtime-webmcp-client` exists, but `apps/code/src/services/webMcpBridge*.ts` still contains app-owned behavior wiring even after type/helper shims were deleted.

### 2. Public contract naming is still split

- `packages/code-runtime-host-contract` root entrypoint is now canonical `HugeCode*` only.
- Remaining debt is the explicit `./hypeCodeMissionControl` compat subpath, which still exists for short-lived legacy access.
- Downstream active packages no longer mix both names in the live path.

### 3. Client-side fallback surfaces are too broad

- event transport fallback
- text-file fallback
- thread snapshot fallback
- diagnostics/session portability/security preflight fallbacks

### 4. Shared workspace shell still consumes legacy mission-control naming

- Resolved in the active path. Remaining risk is public compat export surface, not active workspace-client imports.

## Duplicate Contracts and DTOs

- `packages/code-runtime-webmcp-client/src/webMcpInputSchemaValidationError.ts`
  Still exists as a compatibility entrypoint, even though the canonical implementation now lives in `packages/code-runtime-client`.

## Compatibility Surfaces

- `codeRuntimeRpcCompat`
  Still public and broad.
- `hypeCodeMissionControl`
  Explicit compat subpath still exists because the underlying source file and legacy names have not been deleted yet.
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

- remaining `packages/code-runtime-host-contract/src/hypeCodeMissionControl.ts` compat module once downstream compatibility consumers are gone
- any Tauri adapter code that still normalizes runtime-domain errors or state instead of forwarding canonical contracts
