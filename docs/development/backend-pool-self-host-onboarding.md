# Backend Pool Self-Host Onboarding

Updated: 2026-03-17

This guide is the operator path for bringing a self-hosted backend into the backend pool.

## Goal

Join a backend as one of:

- primary
- burst
- specialized

without redefining runtime task or placement truth.

## Prerequisites

- built or installed `code-runtime-service-rs`
- a reachable network path or overlay path
- a configured runtime auth token for remote exposure
- access to a control-plane client that can call backend registry RPCs

## Product-Consumable Join Flow

Track B now exposes three operator-facing surfaces:

- `backend_pool_bootstrap_preview`
  Returns class-specific join commands and sample registration metadata.
- `backend_pool_onboarding_preflight`
  Validates host, token, overlay helper readiness, remote health, and remote RPC auth before any settings are persisted.
- `backend_pool_diagnostics`
  Explains why a backend is healthy, degraded, unreachable, stale, draining, or blocked by auth/helper/daemon issues.

The intended flow is:

1. open bootstrap preview for a primary, burst, or specialized backend
2. run onboarding preflight with the host/token/provider drafts
3. persist the normalized profile only when `safeToPersist = true`
4. use the returned `applyContract.registrationPayload` instead of hand-editing a registry payload
5. keep the backend alive through heartbeat/connectivity/lease refresh

## Start The Backend Service

Use the desktop bootstrap preview command when available:

- Tauri command: `backend_pool_bootstrap_preview`

That payload returns:

- a resolved runtime-service binary path
- preview command arguments
- example registration payloads for primary, burst, and specialized backends

The preview intentionally uses placeholder token wiring such as `$CODEX_BACKEND_TOKEN`. Do not hardcode secrets into docs, screenshots, or exported payloads.

## Run Preflight Before Persist

Use the desktop onboarding command:

- Tauri command: `backend_pool_onboarding_preflight`

The payload accepts:

- `provider`
- `remoteHost`
- `remoteToken`
- `orbitWsUrl`
- `backendClass`
- `overlay`

The result returns:

- `ok`
- `safeToPersist`
- `state`
- `checks`
- `warnings`
- `errors`
- `profilePatch`
- `applyContract`

`profilePatch` is the normalized settings patch that mobile or desktop UI should persist only after preflight succeeds.

`applyContract` contains:

- a copyable join command
- the join env contract, including `CODEX_BACKEND_TOKEN`
- a prepared backend registration payload
- retry / regenerate / revoke operator guidance

If `safeToPersist = false`, do not update saved remote settings. Fix the reported failure and rerun preflight first.

## Register The Backend

After the backend service is reachable, use `applyContract.registrationPayload` with `code_runtime_backend_upsert`.

The prepared payload includes:

- `backendId`
- `displayName`
- `capabilities`
- `maxConcurrency`
- `costTier`
- `latencyClass`
- `rolloutState`
- `status`
- `backendClass`

Recommended additions:

- `specializations` for specialized backends
- `connectivity` for overlay or gateway evidence
- `lease` for burst-node lifecycle
- `healthScore`, `lastHeartbeatAt`, and `heartbeatIntervalMs` for health reporting

Avoid operator-authored ad hoc JSON patches when a prepared apply contract is available.

## Overlay Guidance

- Tailscale and NetBird helper status belongs in connectivity and onboarding diagnostics.
- Overlay availability helps explain whether a backend is reachable.
- Overlay status must not be treated as confirmed task placement or run continuity.

## Join And Leave Flows

Primary backend:

- keep `backendClass = primary`
- refresh heartbeat metadata through repeated upserts
- prefer stable endpoint and token management

Burst backend:

- set `backendClass = burst`
- attach lease metadata
- when leaving, move to `status = draining` or `lease.status = released`, then remove or disable explicitly

Specialized backend:

- set `backendClass = specialized`
- add both capabilities and specialization tags
- keep specialization metadata descriptive rather than placement-authoritative

## Diagnostics Checklist

Use:

- `code_runtime_backends_list` for pool entry diagnostics
- `code_runtime_diagnostics_export_v1` for routing-health evidence
- desktop `backend_pool_diagnostics` for backend-aware diagnostics plus local overlay helper and daemon status

When a backend is unavailable or degraded, provide:

- connectivity reachability
- last heartbeat age
- lease status
- recent failure reason
- explicit status and rollout state
- auth / token failure state
- helper / daemon failure state

## Retry / Regenerate / Revoke

Preflight and apply-contract payloads now include operator guidance for:

- retry after fixing connectivity or auth errors
- regenerate when a backend token should be rotated
- revoke when a backend is being offboarded or a secret is compromised

These actions are operational metadata. They do not become task truth or placement truth.

## Non-Goals

This onboarding flow does not:

- make overlay state the source of truth for execution
- redefine runtime placement semantics
- replace checkpoint or review artifacts with live repo hot-sync
