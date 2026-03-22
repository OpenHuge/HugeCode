# Runtime Truth Update · 2026-03-17

This note makes explicit how the runtime now surfaces backend registry, operability, review/mission, ACP readiness, and diagnostics evidence so that Mission Control, review, and observability flows can consume a single canonical truth.

## Backend registry persistence

- The runtime response builder (`packages/code-runtime-service-rs/src/agent_tasks_handlers_support.rs::build_agent_task_runtime_response_payload`) now attaches the backend summary whenever a backend snapshot is available, which is why `routing.lifecycleState` can reach `"confirmed"` while `routing.health`, `routing.backendId`, and `routing.resolutionSource` still come from runtime truth. `routing.lifecycleState = "confirmed"` means the backend registry snapshot traveled with the task payload; `"resolved"` means only a backend id was available and the confirmation metadata was omitted.
- `profileReadiness.health` and `profileReadiness.ready` are derived directly from the backend snapshot so UI surfaces can reflect runtime-lens readiness instead of inferring readiness heuristics.
- When a backend snapshot is present, placement clients should render `routing.health` and `profileReadiness.health` as the primary readiness signals and leave legacy overlay/placement heuristics behind.

## Operability-aware placement

- Placement evidence now includes lifecycle and operability signals that the review actionability helpers consider when deciding whether follow-up actions are available (`packages/code-runtime-service-rs/src/rpc_dispatch_mission_control_support.rs::build_runtime_review_actionability_summary`). `placement.lifecycleState`, `placement.healthSummary`, and the derived reasons such as `"placement_unconfirmed"` or `"placement_operability_blocked"` explain when runtime prefers to block action controls.
- Backend diagnostics surfaces (both `code_runtime_backends_list` and the `runtime/routing-health.json` section from `code_runtime_diagnostics_export_v1`) publish the `operability` and `diagnostics` objects that are computed by `build_runtime_backend_operability_value`/`assess_runtime_backend_operability` (see `rpc_dispatch_runtime_backends.rs`). Those objects enumerate why a backend is `blocked`, `attention`, or `ready` (disabled/draining flags, rollout state, heartbeat staleness, lease expiration, readiness probe state, connectivity reachability, queue backlog, capacity saturation, and recent failures). Control plane UIs should render those reasons as-is rather than inventing new placement rules.
- Diagnostics exports also capture the `diagnostics.summary` and `diagnostics.reasons` so trackers can correlate backend operability reasons with runtime task evidence.

## ACP readiness handshake

- ACP integrations surface `acpIntegrationId`, `acpSessionId`, `acpConfigOptions`, and `acpAvailableCommands` in runtime responses (`packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`). The runtime mirrors ACP readiness through `code_acp_integration_upsert`, `code_acp_integration_set_state`, and `runtime_acp_readiness_probe_v1`, so Mission Control and review can show ACP-specific readiness without guessing whether an ACP backend will accept commands.
- ACP readiness also manifests as `backendKind = "acp"` / `origin = "acp-projection"` on backend summaries so placements that involve ACP backends get the same operability instrumentation as native backends while still surfacing the ACP handshake state in the controller.

## Mission / review linkage & actionability

- Runtime now exposes a `missionLinkage` summary calculated by `build_runtime_mission_linkage_summary` (`rpc_dispatch_mission_control_support.rs`). It records the workspace/run/thread/request+review/trace/checkpoint identifiers that a runtime thread preserved (or which fallback to run-level linkage when no thread id exists). Mission Control should consume `missionLinkage.recoveryPath` / `navigationTarget` to resume work on another control device without reconstructing state from scratch.
- `reviewActionability` (`RuntimeReviewActionabilitySummary`) is derived from runtime review decisions, interventions, next actions, and the placement lifecycle/operability signals. Its `state` is `"ready"`, `"degraded"`, or `"blocked"` and its `degradedReasons` enumerate conditions like `run_not_review_ready`, `review_decision_recorded`, `runtime_evidence_incomplete`, `validation_outcome_unknown`, `thread_link_recovered_via_run`, `placement_unconfirmed`, and `placement_operability_blocked`. Clients must keep the canonical accept/reject/intervention availability objects that runtime emits instead of re-evaluating actionability heuristics locally.

## Diagnostics evidence & contract drift guard

- `code_runtime_diagnostics_export_v1` includes the `runtime/checkpoint-review-evidence.json` section that serializes `RuntimeCheckpointEvidenceTaskPayload` entries with `reviewDecision`, `publishHandoff`, `missionLinkage`, `reviewActionability`, `checkpoint`, and `traceId`. Those entries follow the runtime payload produced by `build_agent_task_runtime_response_payload`, so diagnostics tooling can replay exactly the same truth as Mission Control.
- The same export publishes `runtime/routing-health.json` via `build_runtime_routing_health_payload` (`rpc_dispatch_runtime_backends.rs`), summarizing backend counts, operability states, diagnostics fragments, and readiness exposures for every registered backend.
- Runtime also emits `runtime/contract-drift-guard.json` via `build_contract_drift_guard_payload` (`rpc_dispatch_diagnostics_export.rs`), baking `contractVersion`, `methodSetHash`, and `features` together with the `namespace` / `sourceOfTruth`. Observability tooling should compare this guard to the host contract to detect drift between `@ku0/code-runtime-host-contract` and the running runtime.
