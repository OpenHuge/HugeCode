# Code Runtime Specification v2026.1

**Spec ID**: SPEC-CODE-RUNTIME-2026.1
**Status**: Active
**Date**: 2026-03-22
**Supersedes**: All previous drafts in `docs/archive/research/`

## 1. Purpose

This specification defines the active HugeCode code runtime for the coding-agent product. It describes the current runtime boundaries, transport surface, contract ownership, and validation expectations that guide work in:

- `apps/code`
- `apps/code-tauri`
- `packages/code-runtime-service-rs`
- `packages/code-runtime-host-contract`
- `packages/native-runtime-host-contract`

It is intentionally narrower than older research documents that described a more generic agent-runtime or broader platform shape.

For the current product definition and user-facing object model, use `docs/specs/apps/code-product-shape-2026.md`. This runtime spec describes how the runtime supports that product shape; it does not replace the product definition.

## 2. Normative Sources

Use these tracked sources before any older narrative document:

- `docs/prd.md`
- `docs/specs/apps/code-product-shape-2026.md`
- `packages/code-runtime-host-contract`
- `packages/native-runtime-host-contract`
- `packages/code-runtime-service-rs`
- `apps/code/src/services/runtimeClient.ts`
- `docs/runtime/README.md`
- `docs/arch.md`

Historical research remains available for context only:

- `docs/archive/research/final_consensus_best_technical_solution.md`
- `docs/archive/research/expanded_framework_analysis.md`

When this document conflicts with the tracked contract packages or runtime source, the code and frozen contract packages win.

## 3. Repository Naming Guardrails

These requirements keep active runtime docs aligned with the current repository:

1. Runtime package, fixture, and example names use current active surfaces or neutral technical families.
2. Removed placeholder or retired package names MUST NOT reappear in tracked runtime package paths, fixtures, or implementation examples.
3. Policy-domain examples and package references MUST use the `runtime-policy` family.
4. Generated AGENTS scaffolding markers MUST use `project-context:*`.

## 4. Active Runtime Boundaries

The code runtime is the orchestration subsystem for the coding workspace, not a generic multi-product agent platform.

### 4.1 Product-Defining Surfaces

- `apps/code`
  Primary React 19 + Vite coding workspace UI.
- `apps/code-tauri`
  Desktop container and host bridge for the coding workspace.
- `packages/code-runtime-service-rs`
  Rust-first runtime service that owns transport, orchestration, readiness, and server-side execution support.
- `packages/code-runtime-host-contract`
  Canonical TypeScript transport contract, RPC method catalog, event payloads, and frozen spec generation.
- `packages/native-runtime-host-contract`
  Native host parity surface for non-TypeScript clients.

### 4.2 Supporting Layers

These packages support the code runtime but do not define separate product surfaces:

- `packages/design-system`
- `packages/shared`
- `packages/native-bindings`

Internal parity helpers may remain under `internal/`, but they do not define runtime transport or product surface.

## 5. Canonical Transport Surface

The contracted runtime transport surface is:

- `/rpc`
  JSON-RPC request/response transport.
- `/events`
  SSE transport for replayable runtime events.
- `/ws`
  WebSocket transport for additive streaming workflows.
- `/health`
  Lightweight liveness probe.
- `/ready`
  Readiness and diagnostics probe.

These surfaces are exported through the current host-contract packages. Active runtime docs should describe them together when discussing transport compatibility.

## 6. Canonical Runtime Operations

Runtime task, run, approval, and sub-agent lifecycle behavior is expressed through RPC methods, not a separate REST-style agent platform surface.

Representative method families include:

- `code_agent_task_*`
- `code_sub_agent_*`
- `code_approval_*`
- `runtime_*`

Method names, payloads, and compatibility rules come from `packages/code-runtime-host-contract`, not client-local copies or narrative docs.

For this specification phase, canonical task payloads should carry an additive task-source summary wherever task start, task status/list/summary, or review-linkage payloads need to preserve upstream intake context.
That summary is source-agnostic and currently covers manual-thread, GitHub-issue, GitHub-PR-follow-up, schedule, and external-runtime cases without introducing tracker-specific workflow behavior.

### 6.1 Runtime Kernel v2

The preferred evolution path for run planning, execution, and review is the
runtime kernel v2 method family:

- `code_runtime_run_prepare_v2`
- `code_runtime_run_start_v2`
- `code_runtime_run_get_v2`
- `code_runtime_run_subscribe_v2`
- `code_runtime_review_get_v2`
- `code_runtime_run_resume_v2`
- `code_runtime_run_intervene_v2`

`code_runtime_run_prepare_v2` is the canonical pre-execution planning surface.
It returns runtime-owned preparation truth for:

- normalized intent (`runIntent`)
- context shaping (`contextWorkingSet`)
- execution structure (`executionGraph`)
- approval grouping (`approvalBatches`)
- validation scope (`validationPlan`)
- review emphasis (`reviewFocus`)

New control-plane work should consume these runtime-owned summaries directly
instead of rebuilding intent clarity, repo context, approval grouping, or
validation scope in UI facades.

Legacy run methods may remain during migration, but they are compatibility
surfaces. New product meaning should land in the v2 contract rather than
continuing to grow v1 run payloads.

## 6.2 Product Object Mapping

The runtime and contract surface should be read through the current product model rather than as a separate platform taxonomy.

| Product object    | Runtime interpretation                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Workspace         | Repo-bound runtime context, instructions, validation defaults, enabled integrations, and profile defaults                      |
| Task              | Delegated engineering objective, canonical task normalization, subordinate task-source summary, scope, and clarification state |
| Run               | Durable execution lifecycle with timestamps, tools used, files read or modified, validations executed, and final outcome       |
| Execution Profile | Execution environment, network policy, identity source, tool availability, file-system constraints, and timeout strategy       |
| Review Pack       | Review-ready result assembled from diff metadata, validations, logs, assumptions, warnings, and rollback guidance              |

This mapping is normative for active narrative docs. If an implementation-level contract uses narrower terms, the document should still explain how those terms map back to the product objects above.

Supporting operational terms still appear in active runtime docs:

- `Backend Profile`
  Placement and backend-governance metadata that supports a `Run`
- `Ledger`
  Structured execution evidence that supports a `Review Pack`

These terms are valid, but they should be explained as subordinate to the primary product objects rather than introduced as a parallel product taxonomy.

## 7. Client And Service Responsibilities

### 7.1 Client Surfaces

- `apps/code` owns runtime client adapters, transport selection, capability probing, and UI-facing integration.
- `apps/code-tauri` owns desktop host bridging and packaging concerns.
- `apps/code` should prefer the v2 run/review lifecycle when introducing new
  runtime-planning, review, or operator-guidance behavior.
- App-runtime facades may continue reading compat-backed projections during the
  migration window, but they must not reintroduce UI-owned planning truth as a
  substitute for missing runtime fields.

### 7.2 Runtime Service

`packages/code-runtime-service-rs` owns:

- transport bootstrap and router construction
- RPC dispatch
- runtime events
- task and run durability plus lifecycle handling
- provider request routing
- diagnostics, health, and readiness behavior
- review-pack assembly inputs and evidence capture support

The runtime is expected to serve the canonical product loop of define, delegate, observe, review, and decide. UI surfaces may present that loop differently, but should not invent a conflicting source of truth for run state or review evidence.
Mission Control snapshots, AutoDrive execution state, and Review Pack artifacts are runtime-owned. The app may cache or adapt those objects for presentation, but it must not fall back to a separate client-owned projection or local execution ledger as a primary truth path.
Task-source summaries are part of that runtime-owned truth once a task has been normalized, even when older compatibility fields such as `threadId` remain present for manual-thread flows.
Manual review continuation and relaunch defaults should likewise resolve from runtime-published continuation truth such as `relaunchContext`, `missionLinkage`, `reviewActionability`, `publishHandoff`, `taskSource`, and `validationPresetId`, with repo-owned defaults only filling additive launch fields inside the existing runtime start contract.
Runtime-owned review intelligence may publish additive review truth such as `reviewProfileId`, `reviewGate`, `reviewFindings`, `reviewRunId`, `skillUsage`, and `autofixCandidate` so Review Pack and Mission Control can read the same decision-ready summary without reconstructing findings from transcript-only UI state.
Workspace-native skills may be repo-owned through `.hugecode/skills/<skill-id>/manifest.json` when those manifests reuse the existing `skills_source_manifest.v1` substrate and feed additive review/delegation metadata back into the shared workspace-client layer.

This spec does not claim that the runtime must match any older fictional directory tree.

### 7.3 Launch Readiness Is Advisory

Control-device launch surfaces may present a `launch readiness` or operator preflight summary before a run starts.

That summary is allowed to combine existing runtime truth surfaces such as:

- transport or method capabilities
- runtime health and readiness probes
- provider-routing readiness from runtime provider, account, and pool state
- operator pressure such as pending approvals or stale approval backlog
- execution reliability signals derived from existing runtime tool metrics and
  guardrail state

This summary is advisory and launch-scoped only.

It must not:

- replace canonical runtime task or run truth
- redefine backend placement after launch
- become a second approval or orchestration state machine
- become a separate diagnostics dashboard with its own reliability truth
- justify page-local routing heuristics outside `apps/code/src/application/runtime/*`

If launch readiness is exposed in the app, WebMCP, or other operator surfaces, those surfaces should reuse one app-runtime summary instead of recomputing divergent heuristics per page.

## 8. Validation Requirements

Changes must use the narrowest gate that matches the blast radius:

- `pnpm validate:fast`
  Small UI or isolated TypeScript changes.
- `pnpm validate`
  Default gate for multi-file runtime, adapter, or behavior work.
- `pnpm validate:full`
  Shared contracts, workflows, CI, or release-sensitive changes.
- `pnpm check:runtime-contract`
  Frozen-spec and runtime source-of-truth checks for contract updates.
- `pnpm ui:contract`
  Required when `apps/code` UI/runtime boundaries change.
- `pnpm desktop:verify:fast`
  Default desktop verification gate for Tauri integration changes.
- `pnpm desktop:verify`
  Escalate when the change is packaging-sensitive or needs a full debug/no-bundle desktop build.

Targeted E2E and focused runtime-client tests are preferred over broad default suites.

## 9. Non-Goals

This specification does not define:

- a generic multi-agent chat product
- a separate platform taxonomy for every experimental runtime concept
- top-level product navigation or product-mode expansion beyond Ask, Pair, Delegate, and Review
- backlog polling, unattended retry or reconcile loops, workspace lifecycle schedulers, post-run hooks, or broad repository policy DSL execution in this phase
- manual desktop-triggered GitHub issue and PR follow-up launches are allowed when they reuse the existing runtime `taskSource` contract and do not introduce a second execution model
- a repo-owned `Repository Execution Contract` v1 is allowed when it only resolves launch defaults, source mapping, and validation preset inheritance into the existing runtime start contract
- shared manual review continuation and relaunch flows are allowed when they remain runtime-truth-backed, additive-only, and reusable by both `apps/code` and `apps/code-web` workspace-client surfaces
- native review-intelligence and workspace-skill summaries are allowed when they remain additive to canonical task/run/review truth and do not introduce a second review ledger, Agent HQ control plane, post-run hook DSL, or marketplace-first surface
- ownership rules for inactive placeholder app surfaces
- a requirement to restore retired package families or deleted placeholder apps

Those topics belong either in archival research or in a future ADR if they become active again.

## 10. Change Management

- Breaking contract changes require coordinated updates in the host-contract packages and frozen specs.
- Narrative docs may clarify current implementation, but they must not override tracked runtime contracts.
- Historical research under `docs/archive/research/` remains useful as supporting evidence, not as the active runtime definition.
