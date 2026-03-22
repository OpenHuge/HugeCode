# Backend Pool Operations

Updated: 2026-03-17

This guide covers Track B backend-pool operations for HugeCode's distributed coding control plane.

## Boundary

- Runtime owns task truth, run truth, resolved placement, checkpoints, and review artifacts.
- Backend pool operations own backend registration, health, reachability, lease, connectivity helpers, onboarding, and diagnostics.
- Overlay state is transport evidence only. It does not become execution truth.

## Backend Classes

- `primary`: the stable default backend that should remain reachable and healthy.
- `burst`: an elastic backend that may join for extra capacity and leave cleanly.
- `specialized`: a backend with distinct capabilities or specialization tags such as `gpu`, `vision`, or `large-memory`.

Backend class is operator metadata stored in the backend registry. Runtime still confirms per-task routing and placement.

## Registry Fields

Backend registry entries support:

- identity and capability fields: `backendId`, `displayName`, `capabilities`, `specializations`
- pool role fields: `backendClass`, `rolloutState`, `status`
- health fields: `healthy`, `healthScore`, `failures`, `lastHeartbeatAt`, `heartbeatIntervalMs`
- pressure fields: `queueDepth`, `runningTasks`, `maxConcurrency`
- connectivity fields: `connectivity.mode`, `connectivity.overlay`, `connectivity.endpoint`, `connectivity.reachability`
- lease fields: `lease.status`, `lease.scope`, `lease.holderId`, `lease.expiresAt`
- diagnostics fields: `diagnostics.availability`, `diagnostics.summary`, `diagnostics.reasons`

## Expected Operating Model

1. Start or expose a backend runtime service.
2. Use `backend_pool_bootstrap_preview` to get a class-specific join command and prepared metadata shape.
3. Use `backend_pool_onboarding_preflight` to validate host, token, helper readiness, remote health, and remote RPC auth before persisting settings.
4. Persist the normalized remote profile only after preflight reports `safeToPersist = true`.
5. Register or refresh the backend through `code_runtime_backend_upsert`.
6. Send refreshed health, connectivity, and lease metadata through subsequent upserts.
7. Use `code_runtime_backend_set_state` for explicit drain, disable, or rollout transitions.
8. Use `code_runtime_backends_list` or diagnostics export to inspect pool state.

## Health And Reachability

- `healthy` and `healthScore` describe backend health from the backend or control-plane operator.
- `lastHeartbeatAt` and `heartbeatIntervalMs` expose stale-heartbeat conditions.
- `connectivity.reachability` explains whether the backend is reachable, degraded, unreachable, or unknown.
- ACP backends also surface `lastProbeAt` and `lastError` from ACP probe flow.

Do not infer task placement from overlay or reachability alone. Runtime routing evidence remains the source of truth for placement.

## Lease Guidance

Lease fields are for operability, not task truth:

- use `lease.status = active` for a backend that currently holds an operator or node lease
- use `expiring` or `expired` to explain degraded pool status
- use `released` when a burst node is intentionally leaving
- use `scope = node` for backend-node lifecycle and `scope = slot` for slot-oriented capacity helpers

## Diagnostics Surfaces

Use these outputs for Track C and operator tooling:

- `code_runtime_backends_list`
  Includes backend class, connectivity, lease, and backend diagnostics summary.
- `code_runtime_diagnostics_export_v1`
  Includes `runtime/routing-health.json` with backend counts, health, and diagnostics evidence.
- desktop `backend_pool_diagnostics`
  Includes backend-aware registry diagnostics, operator-readable degraded reasons, runtime-service binary resolution, overlay helper status, managed TCP daemon status, and onboarding warnings.
- desktop `backend_pool_bootstrap_preview`
  Includes preview commands and example registration payloads for primary, burst, and specialized backends.
- desktop `backend_pool_onboarding_preflight`
  Includes validate-before-persist checks, normalized profile patch, and prepared apply contract.

## Persistence Behavior

- Native runtime backends now persist to native runtime state so a primary backend can survive service restart in non-distributed mode.
- ACP projections remain projection-owned and are not persisted as native backend truth.
- Discovery-managed backends are still discovery-owned and must not be resurrected from stale local persistence.
- Distributed registry sync remains additive when distributed mode is enabled; it does not replace runtime-owned execution truth.

## Operational Rules

- Prefer additive updates through `code_runtime_backend_upsert` for heartbeats and diagnostics refresh.
- Use explicit drain and disable transitions instead of silently disappearing a backend.
- Specialized backends should advertise both capabilities and specialization tags.
- Burst backends should set or clear lease metadata when joining or leaving.
- If connectivity is degraded, record the reason in `connectivity.reason` and diagnostics rather than inventing placement semantics in the UI.
- For mobile and desktop setup flows, validate first and persist second. Bad host or token input must not be written into saved settings before preflight succeeds.
