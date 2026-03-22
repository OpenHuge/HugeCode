# HugeCode Code Runtime

This directory is the canonical entrypoint for runtime transport, contract, and service-governance documentation.

## Start Here

- Product direction: [`docs/prd.md`](../prd.md)
- Architecture: [`docs/arch.md`](../arch.md)
- Runtime-agent rules: [`docs/agents-system-design.md`](../agents-system-design.md)
- Active runtime spec: [`docs/specs/code-runtime-spec-2026.md`](../specs/code-runtime-spec-2026.md)
- Runtime docs index: `docs/runtime/README.md`
- TS host contract package: [`packages/code-runtime-host-contract/README.md`](../../packages/code-runtime-host-contract/README.md)
- Native host contract package: [`packages/native-runtime-host-contract/README.md`](../../packages/native-runtime-host-contract/README.md)
- Frozen runtime specs: [`docs/runtime/spec/README.md`](./spec/README.md)

## Runtime Contract Source Of Truth

- TS contract source: `packages/code-runtime-host-contract`
- Rust service implementation: `packages/code-runtime-service-rs`
- Native parity layer: `packages/native-runtime-host-contract`
- Tauri bridge surface: `apps/code-tauri/src-tauri`
- Task/start/status/list runtime truth now includes the shared Track A baseline fields:
  - `taskSource`
  - `executionProfile`
  - `routing`
  - `profileReadiness`
  - `reviewPackId`
  - `checkpointState`
  - `approvalState`
  - `intervention`
  - `operatorState`
  - `nextAction`
  - `reviewDecision`
  - `publishHandoff`
  - `takeoverBundle`
  - `checkpointId`
  - `traceId`
- These fields are intended for Track B and Track C consumers to read directly from runtime-owned payloads rather than reconstructing placement or handoff state in UI code.
- Mission Control task, run, and review payloads now expose the same task-source, checkpoint, and handoff truth while preserving older compatibility fields such as `threadId` for manual-thread flows.
- This phase now includes a manual desktop-triggered GitHub source-launch MVP for issue and PR follow-up delegation through canonical `taskSource` payloads.
- This phase now also includes a repo-owned `Repository Execution Contract` v1 for launch defaults, source mapping, and validation preset inheritance.
- This phase now also includes a shared review continuation loop v1 that resolves relaunch and follow-up defaults from runtime truth plus repo defaults, and exposes those continuation summaries through Review Pack, Mission Control, and shared workspace-client surfaces.
- This phase now also includes `Native Review Intelligence + Workspace Skills` v1:
  - runtime task and mission/review projections may publish additive review truth such as `reviewProfileId`, `reviewGate`, `reviewFindings`, `reviewRunId`, `skillUsage`, and `autofixCandidate`
  - repo-owned `reviewProfiles` and workspace-native `.hugecode/skills/<skill-id>/manifest.json` inputs are allowed when they remain additive to the canonical runtime task/run/review loop
  - Review Pack, Mission Control, and shared workspace-client surfaces may consume the same review-intelligence and workspace-skill summaries without introducing a second review state model
- It still does not implement backlog polling, unattended reconcile loops, workspace schedulers, post-run hooks, bounded unattended orchestration, or broad policy DSL execution.

## Contracted Transport Endpoints

- `/rpc`
  JSON-RPC over HTTP for request/response operations. Local default: `http://127.0.0.1:8788/rpc`
- `/events`
  SSE stream for replayable runtime events. Local default: `http://127.0.0.1:8788/events`
- `/ws`
  Duplex runtime transport for additive streaming workflows. Local default: `ws://127.0.0.1:8788/ws`

These three surfaces are the transport contract exported by `@ku0/code-runtime-host-contract`.

Internal parity helpers such as `internal/runtime-policy-rs` may support tooling or fixture validation, but they are not part of the contracted runtime surface.

## Service Probes

- `/health`
  Lightweight liveness probe. Local default: `http://127.0.0.1:8788/health`
- `/ready`
  Readiness and runtime diagnostics probe. Local default: `http://127.0.0.1:8788/ready`

## Key Documents

- [code-runtime-contract-compat.md](./code-runtime-contract-compat.md)
  Compatibility rules for adapters and clients.
- [code-runtime-client-architecture.md](./code-runtime-client-architecture.md)
  Client/runtime boundary notes for `apps/code`.
- [code-runtime-provider-catalog.md](./code-runtime-provider-catalog.md)
  Runtime provider catalog and backend-facing capability notes.
- [code-runtime-oauth-account-pool.md](./code-runtime-oauth-account-pool.md)
  Account-pool and provider-routing domain guidance.
- [runtime-launch-readiness.md](./runtime-launch-readiness.md)
  Launch-scoped operator preflight guidance over existing runtime truth surfaces.
- [pi-mono-runtime-source-deep-dive-2026-03-22.md](./pi-mono-runtime-source-deep-dive-2026-03-22.md)
  Runtime 主线源码解剖，解释宿主装配、shared bindings、projection fabric、frozen contract 与 Rust 真相源如何闭环。
- [runtime-borrowing-blueprint-2026-03-22.md](./runtime-borrowing-blueprint-2026-03-22.md)
  Migration-first borrowing blueprint for runtime truth, kernel projection, backend preference, and review continuation.
- [runtime-takeover-bundle.md](./runtime-takeover-bundle.md)
  Canonical runtime-owned continuation object for post-launch operator takeover.
- [spec/README.md](./spec/README.md)
  Current frozen JSON and Markdown runtime specs.
- [runtime-truth-2026-03-17.md](./runtime-truth-2026-03-17.md)
  Runtime truth update that anchors the backend, ACP, mission/review, and diagnostics exposures.
- [../archive/runtime/README.md](../archive/runtime/README.md)
  Historical rollout notes, audits, task prompts, and older frozen snapshots.

## Validation And CI

- Contract dates, features, and canonical method names come from `@ku0/code-runtime-host-contract`, not client-local literals.
- Runtime transport docs should describe `/rpc`, `/events`, and `/ws` together when discussing multi-client support.
- Policy-domain package names, fixtures, and examples use the neutral `runtime-policy` family; removed product-branded policy names must not return in tracked runtime docs or code examples.
- `pnpm check:runtime-contract`
  Fast frozen-spec + runtime SOT guard for the shared code runtime contract.
- `pnpm --filter @ku0/native-runtime-host-contract test`
  Native namespace parity guard when `packages/native-runtime-host-contract` changes.
- Service and adapter changes should be validated with `pnpm validate` at minimum.
- CI surfaces the same checks through the primary `CI` workflow `Runtime Contract` step plus the repository SOT job for runtime docs discoverability.
