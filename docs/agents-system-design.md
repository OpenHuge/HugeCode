# Runtime Agent System Design Guide

## Active Design Rules For HugeCode Runtime Agents

**Spec ID:** SPEC-RUNTIME-AGENT-SYSTEM-2026.2  
**Status:** Active guidance  
**Date:** March 16, 2026  
**Audience:** engineers working in runtime, contracts, desktop, app-runtime, orchestration, and agent bridges

---

## 1. Purpose

This document defines the active design rules for HugeCode’s runtime agent system.

It is intentionally repository-specific.
It should not be used to reintroduce broad platform abstractions, generic multi-agent taxonomy, or product ideas that are not grounded in the current runtime-first direction.

Use this guide when designing or changing:

- runtime agent task lifecycle
- runtime run lifecycle and governance
- sub-agent orchestration
- backend placement and routing
- approvals, durability, replay, and recovery
- runtime-facing bridges such as WebMCP or host adapters
- review-pack and evidence generation tied to runtime execution

This document complements [`code-runtime-spec-2026.md`](./specs/code-runtime-spec-2026.md) and should be read together with the optimized PRD and architecture specification.

If this document conflicts with tracked contracts or runtime source, the code and contracts win.

---

## 2. Canonical Sources

Read these sources before making runtime-agent changes:

- [`prd.md`](./prd.md)
- [`arch.md`](./arch.md)
- [`code-runtime-spec-2026.md`](./specs/code-runtime-spec-2026.md)
- [`workspace-map.md`](./workspace-map.md)
- `packages/code-runtime-host-contract`
- `packages/native-runtime-host-contract`
- `packages/code-runtime-service-rs`
- `apps/code/src/application/runtime/*`
- runtime bridge implementations such as `webMcpBridgeRuntimeSubAgentTools`

Historical research may help explain tradeoffs, but it is not active design authority.

---

## 3. Design Goal

The runtime agent system exists to support the **personal distributed coding control plane** with governed async engineering delegation, durable handoff, and reviewability.

The system must:

1. keep execution truth in the runtime service
2. support explicit multi-backend routing without page-local placement logic
3. preserve durable task and sub-agent state across reconnects, retries, recovery, and control-device handoff
4. make approval boundaries explicit and observable
5. keep frontend/runtime boundaries narrow and enforceable
6. prefer additive contract evolution over client forks
7. make review evidence, replay, and diagnostics first-class outputs
8. expose governance and placement as structured state rather than UI heuristics
9. preserve canonical task normalization, including subordinate task-source summaries, across runtime, app, and review projections

---

## 4. Design Invariants

### 4.1 Runtime Service Is The Source Of Truth

All canonical state for tasks, runs, sub-agent sessions, checkpoints, approvals, recovery markers, and placement must be owned by the runtime service.

### 4.2 UI Is Not A Second Orchestrator

Frontend layers may cache, summarize, and present runtime state, but they must not invent alternate lifecycle truth or hidden orchestration logic.

Control-device UX is allowed to be richer and more distributed than before, but it still cannot invent placement or checkpoint truth locally.

### 4.3 Contracts Define Lifecycle Behavior

Method names, request shapes, summary payloads, and event payloads must be defined in the shared contract layer first.

### 4.4 Reviewability Is A Design Requirement

If a feature makes execution harder to review, explain, replay, or audit, it is regressive even if it improves raw autonomy.

### 4.5 Placement Must Be Inspectable

Resolved backend placement cannot remain an implicit side effect of task start.

### 4.6 Launch Readiness Must Stay Advisory

Operator-facing launch readiness may summarize whether a run should start now, but it must remain a launch-scoped advisory surface over existing runtime truth.

It must not become:

- a second placement authority
- a hidden orchestration state machine
- a page-local backend scheduler
- a generic diagnostics dashboard that competes with runtime truth

---

## 5. Canonical System Model

### 5.1 Layer Responsibilities

| Layer                                 | Owns                                                                                                                   | Must not own                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/code/src/application/runtime/*` | app-facing runtime facades, launch defaults, backend preference resolution, capability-aware UI integration            | raw page-local orchestration or transport sprawl                     |
| `apps/code/src/services/*`            | transport adapters, WebMCP bridges, thin runtime integration helpers                                                   | canonical task state, backend policy, or page-shaped lifecycle truth |
| `apps/code-tauri`                     | desktop host transport adaptation and native bridge behavior                                                           | product runtime policy decisions                                     |
| host-contract packages                | canonical method names, payloads, event shapes, compatibility expectations                                             | UI heuristics or repo-local workarounds                              |
| `packages/code-runtime-service-rs`    | task execution truth, run lifecycle, sub-agent lifecycle, durability, distributed runtime, diagnostics, event emission | UI-specific state derivation or presentation policy                  |

### 5.2 Product Objects Mapped To Runtime Concepts

| Product object    | Runtime interpretation                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Workspace         | repo-bound execution context, defaults, integrations, backend preferences                  |
| Task              | delegated engineering objective represented by canonical task lifecycle methods            |
| Run               | durable execution attempt with checkpoints, approvals, evidence, and stop state            |
| Sub-agent session | runtime-managed delegated worker channel identified by stable `sessionId`                  |
| Backend           | placement target used for execution and scheduling                                         |
| Review Pack       | review-ready summary assembled from runtime evidence, diff metadata, validations, and logs |
| Ledger            | structured execution chronology emitted from runtime-owned evidence                        |

---

## 6. Agent Task Design

### 6.1 Canonical Start Surface

There must be one canonical task-start surface for runtime agent work.
New capabilities should extend that surface additively rather than introducing parallel task-start paths.

A start request should support, where relevant:

- task source summary for upstream intake lineage
- execution mode
- required capabilities
- max subtask or fan-out limits
- preferred backend IDs
- route or step hints
- explicit constraints and done definition

The preferred lifecycle for new work is now the runtime kernel v2 family:

- `code_runtime_run_prepare_v2`
- `code_runtime_run_start_v2`
- `code_runtime_run_get_v2`
- `code_runtime_run_subscribe_v2`
- `code_runtime_review_get_v2`
- `code_runtime_run_resume_v2`
- `code_runtime_run_intervene_v2`

`code_runtime_run_prepare_v2` is the canonical place to publish intent
clarification, context shaping, execution graph, approval grouping, and
validation scope before execution starts.

### 6.2 Start-Time Backend Resolution Rule

Backend preference must resolve in runtime-facing application logic before crossing the host-native boundary.

Preferred resolution order:

1. explicit `preferredBackendIds`
2. caller-supplied launch default
3. app-level default backend setting
4. runtime fallback if required

Once resolved, the selected or preferred placement intent must flow through the canonical start contract. UI components must not infer placement independently after the run has started.
After launch, Mission Control, AutoDrive progress, intervention availability, handoff state, and review evidence must come from the runtime snapshot path. Client-local compatibility projections are allowed only as explicit non-primary debugging fixtures.
When thread detail is unavailable, control-device UX may only route operators to runtime-published review, checkpoint, or publish handoff artifacts. It must not synthesize a replacement thread truth from local state, cached transcript fragments, or compatibility projections.

Source-driven orchestration is an upstream intake concern. Runtime-agent design may carry task-source lineage, but this phase does not introduce GitHub ingestion, backlog polling, unattended reconcile loops, workspace schedulers, or repository execution contracts.

### 6.3 Task Summary Rule

Task and run summaries should carry runtime-owned placement and orchestration state, including where applicable:

- `taskSource`
- `backendId`
- `preferredBackendIds`
- lineage fields such as `rootTaskId` and `parentTaskId`
- distributed or placement status
- `checkpointId`
- `traceId`
- recovery markers

---

## 7. Run Governance Model

### 7.1 Governance Summary Is Canonical

Approval state, review state, intervention availability, and next-step guidance must collapse into a canonical run-level governance summary.

Minimum governance states:

- `in_progress`
- `awaiting_approval`
- `awaiting_review`
- `action_required`
- `completed`

### 7.2 Governance Ownership Rule

Runtime and contract layers own canonical governance state.
The UI may render or group it, but must not invent alternate state-machine semantics.

During migration, compat-backed runtime projections are acceptable inside the
service layer. They are not a license for app-runtime facades or pages to
rebuild governance, review, or planning truth locally.

### 7.3 Review Surface Rule

Review surfaces should read governance state directly instead of reverse-engineering operator state from loose combinations of approval flags, review decisions, and intervention hints.
Review Pack remains the primary completed-run artifact. If placement is unconfirmed, runtime snapshot data is degraded, or thread detail is missing, the UI must still explain the current runtime-published actionability state, the blocking reason, and the next valid operator path without demoting review back to transcript archaeology.

---

## 8. Sub-Agent System Design

### 8.1 Durable Handles

Sub-agent orchestration must use canonical lifecycle methods and preserve `sessionId` as the durable primary handle.

### 8.2 Scope Controls

Sub-agent spawn and execution should preserve structured controls such as:

- access mode
- effort or reasoning configuration
- provider and model selection when applicable
- scope profile
- allowed skill IDs
- network permission
- workspace read paths
- parent run linkage

### 8.3 Explicit Scope Rule

Scope must be explicit, not inferred only from prompt text.

### 8.4 No Shell Smuggling

Shell or workspace-command tools must not become a covert sub-agent control plane.
If the instruction is actually sub-agent orchestration, the design should extend canonical runtime task or sub-agent tools instead of bypassing them.

---

## 9. Multi-Backend And Placement Design

### 9.1 Backend Preference Is Explicit

Treat the client as capable of connecting to multiple execution backends.
New task-start, reroute, and intervention flows must support:

- explicit backend preference
- shared default-backend fallback
- runtime-visible resolved placement

### 9.2 Placement Logic Belongs Outside Pages

Do not place backend selection logic inside:

- React components
- review-surface local reducers
- page-local state machines

Placement selection belongs in application/runtime facades and host/runtime contracts.

### 9.3 Placement Evidence Is Canonical

At minimum, runtime and contract layers should expose:

- requested backend IDs
- resolved backend ID
- placement resolution source, including explicit preference vs fallback
- backend contract snapshot when available
- operator-readable placement rationale

### 9.4 Observability Must Ship With Scheduling

If a change affects placement, concurrency, or scheduling, it must also account for:

- backend health
- queue depth
- running task counts
- launch-readiness guidance that explains whether operators should launch now or resolve a blocking issue first

Launch-readiness guidance should be derived from canonical runtime or app-runtime summary data and should prefer the first concrete blocking reason over broad diagnostics dumps.

- execution slot availability
- readiness and degraded-state signals

Those signals exist so control devices can explain what runtime actually confirmed, not to license UI-side placement inference.

---

## 10. Durability, Replay, And Recovery

### 10.1 Checkpointing Is First-Class

The runtime agent system must checkpoint:

- agent task snapshots
- run snapshots
- sub-agent session snapshots
- tool-call lifecycle snapshots where applicable

### 10.2 Replayability Rule

Long-running features that cannot be resumed, recovered, or audited after interruption are not production-ready.

### 10.3 Canonical Live-Update Signal

Mutating runtime behavior should emit canonical additive update signals with diagnostics where relevant.

### 10.4 Recovery Must Be Observable

Recovery is not an implementation detail.
Task and run summaries should continue to expose recovery-related fields such as:

- `checkpointId`
- `traceId`
- `recovered`
- checkpoint state where applicable

### 10.5 Control-Plane Presentation Rule

Mission Control, Review Pack surfaces, and settings explanations must present checkpoint, handoff, placement, and backend-health facts from canonical runtime summaries.

In particular:

- checkpoint and handoff messaging should reuse the runtime-published summary whenever available
- review surfaces should treat Review Pack as the primary completed-run artifact rather than reconstructing transcript-first narratives
- backend health and routing diagnostics may explain degraded or fallback conditions, but they must not redefine placement truth

---

## 11. Approval And Safety Design

### 11.1 Approval Is Runtime State

Approval handling must remain part of the task or run lifecycle rather than a UI-only pause mechanism.

### 11.2 Bridge Safety Rule

WebMCP and other runtime-facing bridges should confirm write-capable or risky actions before dispatching mutating runtime methods.

Do not add bridges that:

- auto-run mutating runtime methods without approval controls
- collapse approval-required and read-only methods into one undifferentiated tool
- hide which runtime method actually executed

### 11.3 Scope-Safe Paths And Commands

Runtime-facing bridges must continue to enforce:

- workspace-relative path constraints
- command and payload-size limits where relevant
- dangerous shell-command rejection
- explicit separation between polling and mutation

---

## 12. Review Pack And Ledger Design

### 12.1 Review Pack Rule

Every meaningful delegated run should end in either:

- a reviewable evidence bundle, or
- an evidence-preserving failure outcome

### 12.2 Ledger Rule

The runtime should emit enough structured evidence to reconstruct:

- route selection
- key waypoints
- tools used
- files changed
- validations executed
- approvals requested and resolved
- reroutes and stop reasons

### 12.3 Review Speed Principle

The purpose of the Review Pack and ledger is to reduce human review time without hiding risk.

---

## 13. Integration Strategy

### 13.1 Adapters Are Not The Runtime

Runtime-facing tools and bridges are adapter surfaces over canonical runtime behavior.
They should stay thin:

- normalize input
- enforce guardrails
- request approvals
- forward to runtime control methods
- return structured handles and summaries

### 13.2 External Capability Growth Should Stay Narrow

When adding runtime-adjacent integrations:

- prefer a narrow facade plus canonical contract update
- keep write-capable integrations explicit
- avoid wide catch-all ports for settings, workspace, or automation growth

---

## 14. Recommended Workflow For New Runtime-Agent Work

1. define the product behavior in task, run, review-pack, or sub-agent terms
2. identify whether the change belongs in app runtime facades, host contract, runtime service, or bridge adapters
3. update contract payloads first if transport or durable state changes
4. implement runtime lifecycle, durability, diagnostics, and event behavior
5. adjust application/runtime facades to keep placement and runtime access out of UI components
6. keep Tauri and WebMCP layers thin and contract-driven
7. add focused tests for lifecycle, approval, replay, and placement behavior

---

## 15. Validation Expectations

Choose the narrowest validation gate that matches the real blast radius.

Examples:

- docs-only changes: no runtime validation required
- runtime or adapter behavior: standard validation path
- shared contracts or release-sensitive work: full validation path
- contract updates: runtime-contract checks
- desktop runtime integration: desktop verification path

Targeted runtime and replay tests are preferred over broad suites when they cover the changed path.

---

## 16. Anti-Patterns

Avoid these patterns:

- rewriting active docs into generic vendor comparisons
- making UI components call transport or desktop methods directly
- resolving backend placement inside pages after task start
- using shell execution as an unofficial sub-agent orchestration API
- adding long-running runtime state without checkpoints
- duplicating host-contract types in app code
- inventing new wide adapter ports for every new runtime feature

---

## 17. Non-Goals

This guide does not define:

- a generic cross-product agent platform
- arbitrary multi-agent swarm semantics
- a mandatory vendor-routing strategy for every deployment
- UI copy or page-level content strategy
- fictional package families or placeholder app surfaces

---

## 18. Change Management

- keep this guide aligned with active runtime contracts and source files
- update this guide or the narrower runtime spec when runtime behavior changes materially
- if a proposal conflicts with this guide, prefer the narrower active contract/spec or document the change explicitly in an ADR

---

## 19. One-Sentence Summary

HugeCode runtime agents should be designed as **durable, runtime-owned, placement-aware, review-centric execution systems for governed async engineering delegation**.
