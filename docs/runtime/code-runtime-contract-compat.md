# Code Runtime Contract Compatibility Policy

Updated: 2026-03-22

## Current Strategy

- Canonical RPC methods are `code_*` only.
- Legacy RPC aliases are excluded from canonical method negotiation.
- Clients must call canonical methods directly and must not depend on alias retry branches.
- Request payload compatibility fields are generated from one helper (`buildCodeRuntimeRpcCompatFields`) to keep camelCase + snake_case aligned.

## Frozen Contract Baseline (2026-03-22)

- Required capabilities contract fields:
  - `profile` should identify runtime capability surface (`full-runtime` or `desktop-core`)
  - `contractVersion = "2026-03-22"`
  - `freezeEffectiveAt = "2026-03-22"`
  - `methodSetHash` must match the advertised `methods` set
  - `features` must include `contract_frozen_2026_03_22`
  - `features` must include `runtime_kernel_prepare_v2`
- `methods` in frozen specs represent canonical methods only.
- `canonicalMethods` is the canonical `code_*` only set.
- `desktop-core` profile may expose a reduced `features` subset while preserving frozen baseline markers.
- Service and adapters must treat this frozen baseline as the single source of truth.

## Transport Contract

- HTTP RPC (`/rpc`) returns:
  - success: `{ ok: true, result }`
  - error: `{ ok: false, error: { code, message, details? } }`
- SSE events (`/events`) stream unified turn/runtime envelopes and support replay via `Last-Event-ID`.
- WebSocket (`/ws`) is additive and supports:
  - client -> server: `rpc.request`, `ping`
  - server -> client: `transport.ready`, `rpc.response`, `runtime.event`, `pong`
  - replay cursor via `lastEventId` query parameter
- Service/web `code_rpc_capabilities` publishes `transports` metadata, including endpoint paths, protocol ids, and replay key semantics.
- Tauri `code_rpc_capabilities` may omit `transports` because invoke transport is in-process.
- Service runtime (`@ku0/code-runtime-service-rs`) emits structured method-not-found:
  - `error.code = "METHOD_NOT_FOUND"`
- Tauri invoke path must preserve structured error semantics without introducing alias-specific fallback behavior.
- Adapters should probe `code_rpc_capabilities` and use its method/feature/transport baseline directly.
- Runtime SOT guard (`scripts/check-runtime-sot.mjs`) enforces host/service method parity and bounded tauri method-gap rollout via allowlist.

## Client Integration Rules

- Web / Tauri / future clients:
  - import method constants from `@ku0/code-runtime-host-contract`
  - import contract baseline constants (`CODE_RUNTIME_RPC_CONTRACT_VERSION`, `CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT`) from `@ku0/code-runtime-host-contract`
  - call canonical `code_*` methods only
  - do not implement legacy alias fallback branches
  - do not hardcode contract dates or `contract_frozen_*` feature literals in adapters/clients

## Runtime-Owned Task Truth Baseline

- `AgentTaskSummary` is the canonical runtime-owned task snapshot for `code_runtime_run_start`, `code_runtime_run_subscribe`, and `code_runtime_runs_list`.
- Clients must treat the following fields as runtime truth and must not backfill them from page-local state:
  - `executionProfile`
  - `routing`
  - `profileReadiness`
  - `reviewPackId`
  - `checkpointState`
  - `checkpointId`
  - `traceId`
- `routing.resolutionSource` communicates why runtime selected the backend route.
- `routing.lifecycleState` communicates whether placement is `unresolved`, `requested`, `resolved`, `confirmed`, or `fallback`.
- `routing.lifecycleState = "confirmed"` indicates runtime attached a backend registry snapshot to the task payload; `resolved` means a backend id exists but backend confirmation details were not attached.
- `profileReadiness` is derived from runtime routing evidence; clients may present it, but must not recompute readiness from UI-only heuristics.
- `checkpointState` is the canonical checkpoint/handoff summary for task payloads; `checkpoint` is the canonical Mission Control run/review projection of the same runtime truth.
- Review, Mission Control, settings, and handoff flows must consume these task-truth fields directly when present instead of reconstructing routing semantics or checkpoint resumability locally.
- `apps/code` runtime bridge types and normalization helpers must preserve these fields end to end; do not collapse them back to `null`, empty arrays, or synthetic defaults once runtime has supplied them.
- Runtime task RPC responses should also carry runtime-derived control-state fields when available:
  - `approvalState`
  - `intervention`
  - `operatorState`
  - `nextAction`
  - `reviewDecision`
  - `publishHandoff`
  - `takeoverBundle`
- `reviewPackId` is the canonical task-level review artifact identity for terminal runs; clients must prefer it over reconstructing review-pack ids from task ids or local run-state heuristics.
- These fields must be derived from the same canonical runtime helpers used by Mission Control, not by a separate task-only state machine.
- `publishHandoff` is the canonical task-level operator handoff reference when runtime materializes a publish-ready handoff artifact; clients must prefer it over deriving handoff paths from `autoDrive.stop`.
- `takeoverBundle` is the canonical operator-facing continuation object. Clients
  must prefer it over reconstructing approval, resume, handoff, or review
  follow-up semantics from separate runtime fields when it is present.

## Continuation Summary Compatibility Boundary

- First-party UI surfaces must derive readiness / continuation / review
  follow-up semantics from the canonical continuation facade in
  `packages/code-runtime-host-contract/src/runtimeContinuationFacade.ts`.
- `code_mission_control_summary_v1` has been removed from the frozen canonical
  RPC surface. First-party UI must continue consuming mission-control snapshot
  truth plus the canonical continuation facade.
- Workspace shell, Mission Control, and Review Pack must consume mission-control
  snapshot truth plus the canonical continuation facade instead of reading
  summary semantics from the compatibility RPC.
- Compat projections may preserve transport shape, but they must not keep
  growing new product-semantic precedence rules.
- Do not reintroduce a summary RPC as a first-party semantic shortcut.

## Runtime Kernel v2 Compatibility Rule

- New planning and review semantics belong in the v2 lifecycle methods, not in
  additional growth on legacy run payloads.
- `code_runtime_run_prepare_v2` is the canonical pre-execution planning
  surface.
- `code_runtime_run_start_v2`, `code_runtime_run_get_v2`,
  `code_runtime_run_subscribe_v2`, `code_runtime_review_get_v2`,
  `code_runtime_run_resume_v2`, and `code_runtime_run_intervene_v2` are the
  preferred shared client/runtime lifecycle for new work.
- Legacy `code_runtime_run_start`, `code_runtime_run_subscribe`,
  `code_runtime_run_resume`, and `code_runtime_run_intervene` remain valid
  compatibility methods during migration, but they are not the preferred place
  to introduce new product meaning.
- Clients may rely on the frozen v2 contract even when the runtime service is
  still temporarily fulfilling some v2 reads through compat-backed projections.
  The compat bridge lives in the runtime/service side, not in client-local
  heuristics or alias retry behavior.

### Backend & routing persistence

- `routing.lifecycleState = "confirmed"` now explicitly indicates the backend registry snapshot lived inside the task payload. `routing.health`, `routing.backendId`, and `routing.resolutionSource` flow from the same snapshot that the runtime uses when building responses (`packages/code-runtime-service-rs/src/agent_tasks_handlers_support.rs::build_agent_task_runtime_response_payload`), rather than being reconstructed by the client.
- `profileReadiness` and `placement` health fields are derived from that snapshot as well, so any UI readiness indicators should read the runtime-provided values instead of improvising heuristics or overlay inference.

### Mission linkage & review actionability

- The runtime publishes `missionLinkage` (`RuntimeMissionLinkageSummary`) so Mission Control and handoff flows can resume a run on another device using the preserved thread id, navigation target, checkpoint, review pack, and trace identifiers defined by `build_runtime_mission_linkage_summary` (`rpc_dispatch_mission_control_support.rs`).
- `reviewActionability` (`RuntimeReviewActionabilitySummary`) is built from runtime review decisions, interventions, next actions, placement lifecycle, and operability reasons. It communicates whether accept/reject actions are enabled, whether follow-up interventions such as `retry` or `continue_with_clarification` are still supported, and precise `degradedReasons` such as `run_not_review_ready`, `review_decision_recorded`, `runtime_evidence_incomplete`, `validation_outcome_unknown`, `thread_link_recovered_via_run`, `placement_unconfirmed`, and `placement_operability_blocked`. Clients must trust this summary instead of re-evaluating whether a review result is actionable.
- The runtime should also publish `takeoverBundle` so Mission Control, Review
  Pack, and sub-agent surfaces can point at one canonical continuation target
  and one canonical next operator action without stitching together checkpoint,
  handoff, approval, and review logic locally.

### ACP readiness handshake

- ACP backends now surface handshake fields (`acpIntegrationId`, `acpSessionId`, `acpConfigOptions`, `acpAvailableCommands`) in runtime task responses (`packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`). The runtime populates those fields as the ACP probe flow (for example `code_acp_integration_upsert`, `code_acp_integration_set_state`, `runtime_acp_readiness_probe_v1`) confirms readiness, and backend summaries mark the `backendKind = "acp"` / `origin = "acp-projection"` to keep ACP deployments on par with native backend operability instrumentation.

### Diagnostics evidence & contract drift guard

- `code_runtime_diagnostics_export_v1` now emits runtime checkpoint evidence where each entry mirrors the runtime payload (`build_agent_task_runtime_response_payload`) by including `reviewDecision`, `publishHandoff`, `missionLinkage`, `reviewActionability`, `takeoverBundle`, `checkpoint`, and `traceId`. This lets diagnostics tooling replay exactly the same truth that Mission Control displayed.
- The diagnostics export also includes `runtime/routing-health.json` (`build_runtime_routing_health_payload` in `rpc_dispatch_runtime_backends.rs`), publishing backend counts, operability and diagnostics fragments, and readiness states for every registered backend.
- The `runtime/contract-drift-guard.json` section (`build_contract_drift_guard_payload` in `rpc_dispatch_diagnostics_export.rs`) captures the runtime’s `contractVersion`, `methodSetHash`, and `features` together with a `namespace`/`sourceOfTruth`. Observability tooling should compare that guard to the frozen `@ku0/code-runtime-host-contract` baseline to detect drift between host-contract code and runtime service.

## Deprecation Plan

- Legacy alias strategy is retired for runtime RPC methods.
- Any temporary compatibility shim must live outside the frozen contract and must not alter canonical method names.

## Rollback Plan

- If rollout regresses:
  - rollback service + host-contract commits together
  - restore the previous frozen spec file pair
  - keep `METHOD_NOT_FOUND` code semantics unchanged
