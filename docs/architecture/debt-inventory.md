# Runtime Architecture Debt Inventory

## Highest-Value Debt

### 1. Shared client ownership is incomplete

- Resolved for the runtime-client and core WebMCP ownership seam.
- `packages/code-runtime-client` now owns the shared RPC client construction that previously remained adjacent in `apps/code/src/services/runtimeClient*.ts`.
- `packages/code-runtime-webmcp-client` now owns the canonical WebMCP descriptors, tool-name catalogs, read tools, and shared agent-control helper logic.
- `apps/code` keeps only host binding, app runtime composition, and runtime-specific invalidation/tool wiring on this seam.

### 2. Public contract naming split is resolved

- `packages/code-runtime-host-contract` mission-control contracts now publish only canonical `HugeCode*` names.
- The temporary `./hypeCodeMissionControl` compat subpath is deleted.
- Downstream active packages no longer mix both names in the live path.

### 3. Client-side fallback surfaces are too broad

- event transport fallback
- text-file fallback
- thread snapshot fallback
- diagnostics/session portability/security preflight fallbacks

### 4. Shared workspace shell still consumes legacy mission-control naming

- Resolved in the active path. No legacy mission-control naming remains in active workspace-client imports.

## Duplicate Contracts and DTOs

- Resolved for `webMcpInputSchemaValidationError`. The canonical implementation now lives only in `packages/code-runtime-client`.

## Compatibility Surfaces

- `codeRuntimeRpcCompat`
  Still public and broad.
- deprecated desktop-host aggregation surfaces are blocked by tests, which is good, but their existence shows the repo is still carrying compatibility cleanup work.

## Suspicious Layering

- `apps/code/src/application/runtime/facades/*`
  Large and numerous. Some are correct app-facing facades; some still compensate for missing canonical projections or naming cleanup.
- `apps/code/src/services/*`
  Wide runtime/desktop-host/WebMCP layer. Too much system knowledge still sits under the app.
- `packages/code-runtime-service-rs/src/lib.rs`
  Very broad import surface, which suggests runtime subsystems are still coupled at the top level.

## Persistence and State Risks

- Runtime checkpoints and journals are already runtime-owned.
- Risk remains in client-side stores and fallbacks that can preserve session/thread/projection state outside runtime.

## Monorepo Risks

- Extracted packages and app-local copies coexist.
- `pnpm check:circular` now passes, so the remaining monorepo risk is ownership drift, not an unverified dependency graph.

## Immediate Deletion Candidates

- any legacy desktop-host adapter code that still normalizes runtime-domain errors or state instead of forwarding canonical contracts
