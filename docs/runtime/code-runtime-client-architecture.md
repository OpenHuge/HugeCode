# Code Runtime Client Architecture (apps/code)

Date: 2026-03-22
Status: Active

## Decision

`apps/code` has fully deprecated the legacy `code-runtime` bridge.

Supported runtime modes are now:

- `tauri` (legacy desktop-host compatibility label retained for runtime-mode stability)
- `runtime-gateway-web`
- `unavailable`

There is no runtime mode, marker, or fallback path for `code-runtime`.

## Target Architecture

All clients must consume one shared contract:

`UI / CLI / TUI / Telegram adapter` -> `RuntimeGateway (RPC contract)` -> `code-runtime-service-rs`

Rules:

- RPC method names and payload aliases come only from `packages/code-runtime-host-contract`.
- Runtime contract baseline (`contractVersion`, `freezeEffectiveAt`, `contract_frozen_*` feature expectation) must come from `@ku0/code-runtime-host-contract` constants; do not hardcode date literals in clients/adapters.
- Runtime method-set source of truth is guarded by `scripts/check-runtime-sot.mjs` (host=service exact set, no desktop-host gap allowlist, optional strict compatibility checks).
- Frontend does not infer provider/model routing semantics; it consumes routed metadata from service responses.
- Compatibility fallback to legacy aliases is removed in the frozen `2026-03-22` baseline.
- Shared runtime clients should now expose the runtime kernel v2 lifecycle
  directly:
  - `runtimeRunPrepareV2`
  - `runtimeRunStartV2`
  - `runtimeRunGetV2`
  - `runtimeRunSubscribeV2`
  - `runtimeReviewGetV2`
  - `runtimeRunResumeV2`
  - `runtimeRunInterveneV2`
- New control-plane work in `apps/code` should prefer those v2 methods over
  extending the legacy run lifecycle.

## Deprecation Policy

`code-runtime` in `apps/code` is retired and must not be reintroduced.

Do not add:

- window bridge markers (for example `__OPEN_WRAP_AGENT_RUNTIME_RPC__`)
- runtime mode branches or clients named `code-runtime`
- adapter-specific fallback logic outside contract error semantics

If migration compatibility is needed in future, it must be implemented in
service/transport adapters while preserving the same host contract.

Runtime kernel v2 follows the same rule: temporary compat-backed fulfillment is
allowed in the service layer while the runtime converges on a smaller native
kernel, but the client should still call the canonical v2 methods instead of
adding local fallback semantics.

## Why

- Prevents semantic drift between UI and service.
- Keeps cross-platform behavior deterministic across web/desktop-host/future clients.
- Removes historical fallback debt based on non-contract heuristics.
