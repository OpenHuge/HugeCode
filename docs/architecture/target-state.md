# Target Runtime Architecture

## Summary

The target architecture has one runtime truth path per capability.

- Rust runtime owns execution state, checkpoints, handoff, review artifacts, and event emission.
- `@ku0/code-runtime-host-contract` owns public TypeScript contract truth.
- `@ku0/code-runtime-client` owns runtime client transport and runtime-client type truth.
- `@ku0/code-runtime-webmcp-client` owns WebMCP client behavior and WebMCP/runtime-agent type truth.
- `@ku0/code-workspace-client` owns shared workspace-shell composition only.
- `apps/code`, `apps/code-web`, and `apps/code-tauri` are composition shells and host adapters, not alternate runtime layers.

## Ownership Model

### Runtime core

- `packages/code-runtime-service-rs`
  - RPC dispatch
  - event stream emission
  - execution lifecycle
  - checkpoint and durability
  - backend routing
  - review artifact assembly

### Contracts

- `packages/code-runtime-host-contract`
  - canonical request/response/event shapes
  - mission-control and kernel-projection shapes
  - runtime capability and compatibility metadata

### Client packages

- `packages/code-runtime-client`
  - runtime transport
  - capability handshake
  - runtime client state-machine helpers
  - canonical `RuntimeClient` type surface

- `packages/code-runtime-webmcp-client`
  - WebMCP client lifecycle
  - WebMCP catalog/context helpers
  - canonical WebMCP/runtime-agent type surface

### Shared workspace shell

- `packages/code-workspace-client`
  - shared workspace bindings
  - kernel-projection consumers
  - mission-control summary presentation model

### App shells

- `apps/code`
  - app/runtime facades
  - Tauri composition
  - platform-specific UI wiring

- `apps/code-web`
  - browser bindings
  - shared workspace shell composition

- `apps/code-tauri`
  - host bridge only

## Single Execution Path

Every core capability must follow:

1. UI or host intent
2. app/runtime facade
3. shared runtime client package
4. host contract
5. Rust runtime state transition
6. runtime event / kernel projection / mission-control snapshot
7. UI projection

The client may cache and subscribe.
The client must not reconstruct alternate run/task/review truth.

## Deletion Rules

- No app-local duplicate type surfaces for runtime or WebMCP packages.
- No second mission-control vocabulary in active consumers.
- No client fallback that creates business truth.
- No new compat export from root barrels unless it has a deletion plan.

## Observability Rules

All canonical path outputs should carry runtime linkage:

- `workspaceId`
- `taskId`
- `runId`
- `checkpointId`
- `traceId`
- `parentRunId` where relevant
- resolved backend identity where relevant

## Monorepo Rules

- Shared package truth moves down into packages, not up into apps.
- Apps consume package APIs; they do not fork them.
- Affected builds and tests must follow package ownership, not historical file placement.
