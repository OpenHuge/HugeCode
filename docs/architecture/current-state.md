# Current Runtime Architecture

## Summary

HugeCode is already runtime-first in intent, but not yet single-path in implementation.

The authoritative execution service is `packages/code-runtime-service-rs`.
The authoritative TypeScript contract surface is `packages/code-runtime-host-contract`.
The main architectural debt is duplicated client/runtime-adjacent logic and compatibility surfaces that still exist beside the canonical path.

## Canonical Runtime Path

The real end-to-end runtime path today is:

1. UI intent enters through `apps/code/src/application/runtime/*` or shared workspace-client bindings.
2. App/runtime ports compose calls into `apps/code/src/services/*` runtime client and desktop host bridge helpers.
3. Runtime transport crosses the host contract via `@ku0/code-runtime-host-contract`.
4. The Rust runtime handles `/rpc`, `/events`, `/ws`, `/health`, and `/ready` in `packages/code-runtime-service-rs`.
5. Runtime emits snapshots, kernel projection deltas, event-stream updates, and review artifacts back to clients.

## Runtime Entrypoints

### Service

- `packages/code-runtime-service-rs/src/main.rs`
- `packages/code-runtime-service-rs/src/lib.rs`
- Contracted transport endpoints:
  - `/rpc`
  - `/events`
  - `/ws`
  - `/health`
  - `/ready`

### Desktop app

- `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`
- `apps/code/src/application/runtime/kernel/createWorkspaceClientRuntimeBindings.ts`

### Web app

- `apps/code-web/app/components/createWebWorkspaceClientBindings.tsx`

### Shared workspace shell

- `packages/code-workspace-client/src/workspace/browserBindings.ts`
- `packages/code-workspace-client/src/workspace-shell/kernelProjectionStore.ts`
- `packages/code-workspace-client/src/workspace-shell/missionControlSnapshotStore.ts`

## Orchestration Paths

### Canonical execution path

- Runtime jobs, task start/resume/intervention, sub-agents, git/runtime tools, and review outputs ultimately route to the Rust runtime through the host contract.

### Shadow or duplicated client paths

- `apps/code/src/services/*`
  Still contains a broad runtime client layer, WebMCP layer, desktop host bridge layer, transport state machines, fallback handling, and some duplicated shared-client logic.
- `packages/code-runtime-client`
  Already owns part of the canonical runtime client surface, but extraction is incomplete because `apps/code/src/services/*` still carries neighboring forks.
- `packages/code-runtime-webmcp-client`
  Already owns part of the WebMCP client surface, but `apps/code/src/services/*` still has app-local implementations and duplicate types.
- `packages/code-workspace-client`
  Correctly owns shared workspace-shell state, but still consumes older mission-control type names and projection-specific read models.

## Tool Invocation Layers

- App-facing facades:
  `apps/code/src/application/runtime/facades/*`
- App runtime ports:
  `apps/code/src/application/runtime/ports/*`
- App transport and host bridges:
  `apps/code/src/services/runtimeClient*.ts`
  `apps/code/src/services/desktopHost*.ts` plus legacy `desktop-host*.ts` shims
  `apps/code/src/services/webMcpBridge*.ts`
- Shared client packages:
  `packages/code-runtime-client`
  `packages/code-runtime-webmcp-client`
- Runtime execution handlers:
  `packages/code-runtime-service-rs/src/agent_tasks*`
  `packages/code-runtime-service-rs/src/turn_*`
  `packages/code-runtime-service-rs/src/rpc_dispatch*`

## Persistence, Checkpoints, Journals, and Caches

Runtime-owned durable state exists today in the Rust runtime:

- agent task durability and checkpoints:
  `agent_task_durability.rs`
  `agent_task_durability_checkpoint.rs`
  `agent_task_durability_sqlite.rs`
- runtime checkpoints:
  `runtime_checkpoint.rs`
- native and OAuth stores:
  `native_state_store.rs`
  `oauth_pool*.rs`
- runtime metrics and guardrail storage:
  `runtime_tool_metrics_storage.rs`

Client-side storage and fallback state also still exist:

- workspace shell mission-control/kernel-projection stores in `packages/code-workspace-client`
- browser gateway/runtime profile state in `packages/code-workspace-client`
- thread snapshot and text-file fallback state in `apps/code/src/services`

## Contract and Schema Duplication

### Canonical

- `packages/code-runtime-host-contract`

### Duplicated or drifting

## Compatibility Layers Still Active

- `packages/code-runtime-host-contract/src/codeRuntimeRpcCompat.ts`
- app runtime and desktop-host compatibility ports/tests explicitly guard against deprecated compat ports, which confirms the repo is still actively unwinding older surfaces

## Domain Logic Outside Runtime

- Mission-control projection and routing presentation logic in `apps/code/src/application/runtime/facades/*`
- WebMCP tool wiring and policy exposure in `apps/code/src/services/webMcpBridge*.ts`
- workspace shell mission-control and kernel-projection stores in `packages/code-workspace-client`

This code should remain presentation/composition only.
Any part that reconstructs execution truth instead of reading runtime truth is architectural debt.

## Suspicious Dependency and Packaging Edges

- `apps/code` now routes package-owned runtime/WebMCP helper imports directly to `@ku0/code-runtime-client` and `@ku0/code-runtime-webmcp-client`, but `services/runtimeClient.ts` still owns the app-specific `AppSettings` specialization.
- Shared workspace-client code still imports older mission-control aliases directly from the contract package.
- The repo defines package-boundary rules in `turbo.json`, but the currently installed dependency state was not ready to run `pnpm check:circular`, so circular-dependency status still needs confirmation after install.

## Feature Flags and Env-Based Runtime Branches

Runtime behavior is still strongly affected by environment/config branches in `packages/code-runtime-service-rs/src/main.rs`, including:

- distributed runtime enablement
- discovery enablement
- runtime auth token
- sandbox mode and network access
- provider/API configuration
- runtime backend identity/capabilities

These branches are legitimate runtime config.
The debt is when equivalent truth is reinterpreted again in client-side fallbacks or compatibility projections.
