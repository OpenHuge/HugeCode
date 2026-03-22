# Backend Pool Diagnostics

Updated: 2026-03-17

This document defines the Track B diagnostics model for backend pool operability.

## Boundary

- Diagnostics explain backend pool state, helper state, auth state, and onboarding state.
- Diagnostics do not redefine task truth, run truth, or placement truth.
- Overlay state is connectivity evidence only.

## Desktop Diagnostics Payload

`backend_pool_diagnostics` returns operator-facing data for Track C:

- runtime service binary resolution
- configured remote host and token presence
- selected TCP overlay
- registry source
- top-level diagnostic reasons
- backend-level diagnostic entries
- operator actions
- Tailscale helper state
- NetBird helper state
- managed TCP daemon state
- warnings

## Backend-Level Reasons

Current backend-level degraded reason codes include:

- `backend_disabled`
- `backend_draining`
- `health_check_failed`
- `connectivity_unreachable`
- `connectivity_degraded`
- `lease_expired`
- `lease_expiring`
- `heartbeat_stale`
- `capacity_saturated`
- `queue_backlog`
- `recent_failures_recorded`

Each backend entry should expose:

- `summary`
- `availability`
- `healthy`
- `status`
- `rolloutState`
- `connectivityReachability`
- `connectivityEndpoint`
- `connectivityReason`
- `leaseStatus`
- `lastHeartbeatAt`
- `heartbeatAgeMs`
- `reasons`
- `operatorActions`

## Top-Level Reasons

Desktop diagnostics also report environment and registry issues such as:

- `overlay_helper_missing`
- `overlay_not_authenticated`
- `daemon_error`
- `auth_missing`
- `registry_unavailable`
- `registry_payload_invalid`
- `backend_unregistered`
- `default_backend_missing`

These reasons explain why a backend is not operable even when the UI can still load.

## Onboarding Failure Taxonomy

`backend_pool_onboarding_preflight` returns structured failures before settings are persisted:

- `remote_host_missing`
- `remote_token_missing`
- `remote_health_unreachable`
- `remote_health_failed`
- `auth_invalid`
- `remote_rpc_unreachable`
- `remote_rpc_failed`
- `orbit_adapter_unavailable`

The payload also returns:

- `checks`
- `warnings`
- `errors`
- `state`
- `safeToPersist`
- `profilePatch`
- `applyContract`

## Operator Guidance

Track C should present diagnostics in this order:

1. top-level blocking reason
2. affected backend summary
3. operator action
4. supporting helper / daemon / auth detail

Recommended copy for UI surfaces:

- show connectivity and auth reasons separately
- show lease and heartbeat reasons separately
- keep operator actions copyable
- do not imply that helper status alone proves execution health
