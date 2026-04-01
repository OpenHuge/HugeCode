# Extension Activation Platform Design Note

## Current activatable sources

The new activation service composes runtime-facing truth from these sources:

- runtime-published plugins from `plugins.catalog`
  - runtime extensions
  - live skills not already consumed by a workspace behavior asset
  - route plugins
  - host binders
- installed registry packages from `plugins.registry`
  - published as installed/degraded/failed activation records until a runtime binder exists
- workspace behavior assets from `.hugecode/skills/*/manifest.json`
  - compiled into typed behavior asset descriptors
  - upgraded from declaration-only to active when a matching runtime live skill is present
- session overlays
  - layered on top of workspace/runtime truth per `sessionId`
  - refreshable and removable without mutating workspace/global composition

## Lifecycle semantics

Canonical lifecycle states are:

- `discovered`
- `verified`
- `installed`
- `bound`
- `active`
- `degraded`
- `refresh_pending`
- `deactivated`
- `failed`
- `uninstalled`

The activation service derives runtime truth through a staged pipeline:

1. discover catalog plugins, installed packages, workspace skill manifests, and runtime live skills
2. verify trust/compatibility/provenance
3. install or acknowledge installed presence
4. bind contributions into typed live descriptors
5. activate or degrade/fail based on runtime health, permission state, and compatibility
6. publish a stable activation snapshot with records, diagnostics, transition history, and active contributions

`cache_only` refresh reuses discovered source snapshots and only reapplies overlay/deactivation/tombstone state.
`full` refresh re-discovers sources and rebuilds activation truth from scratch.

## Active contribution publication

The runtime-facing publication boundary is:

- capability key: `extensions.activation`
- resolver: `resolveWorkspaceRuntimeCapability(scope, RUNTIME_KERNEL_CAPABILITY_KEYS.extensionActivation)`

The published snapshot contains:

- activation records with current state and transition history
- diagnostics by phase (`discover`, `verify`, `install`, `bind`, `activate`, `refresh`, `deactivate`, `uninstall`)
- active contributions for invocation-plane ingestion
- per-session overlay effects

Contribution kinds currently modeled are:

- `invocation`
- `skill`
- `hook`
- `resource`
- `route`
- `policy`
- `subagent_role`
- `host_binding`

## What remains stubbed

- installed registry packages do not yet auto-bind into executable runtime providers
- package-authored behavior assets are not yet compiled beyond installed package truth
- activation truth is currently published through the app runtime kernel capability layer, not a new runtime-service RPC contract
- invocation-plane integration is intentionally separate; this track publishes contribution truth but does not replace invocation routing/selection

## Track A ingestion

Track A should ingest only `activeContributions` plus the matching activation records from the `extensions.activation` snapshot.
Do not infer live contribution truth from `plugins.catalog` alone.

Recommended flow:

1. resolve `extensions.activation` from the workspace runtime scope
2. call `readSnapshot({ sessionId })` when session overlays matter, otherwise `readSnapshot()`
3. use `activeContributions` as the canonical live catalog
4. use record diagnostics/readiness when invocation needs to explain degraded or blocked contributions
