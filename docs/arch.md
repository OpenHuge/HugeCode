# HugeCode Architecture Specification

## Personal Distributed Coding Control Plane

**Document Version:** v2.0  
**Date:** March 16, 2026  
**Status:** Optimized working architecture  
**Language:** English

---

## 1. Purpose

This document translates the optimized PRD into an implementation-guiding architecture for **HugeCode**.
HugeCode is a control plane for governed async engineering delegation across durable runtime-backed execution surfaces.

It answers six practical questions:

1. What system are we actually building?
2. Which layer owns which kind of truth?
3. How should the current repository map to the target product shape?
4. Which architectural decisions are fixed?
5. Which runtime behaviors must be inspectable?
6. How do we measure whether the architecture is being followed?

This is not a vision memo. It is a build-and-review document.

---

## 2. Source Inputs

### Internal Inputs

This architecture is derived from:

- [prd.md](./prd.md)
- [agents-system-design.md](./agents-system-design.md)
- [code-runtime-spec-2026.md](./specs/code-runtime-spec-2026.md)
- [workspace-map.md](./workspace-map.md)
- current repository boundaries in `apps/code`, `apps/code-electron`, `packages/code-runtime-host-contract`, and `packages/code-runtime-service-rs`

### External Reference Patterns

The following sources influenced pattern selection, not product authority:

- OpenAI Codex and Codex app for background execution, multi-agent supervision, and evidence-backed review
- GitHub Copilot coding agent for PR-centric delegation and ephemeral environments
- Claude Code for permission models, project-scoped controls, hooks, and MCP-oriented extension
- JetBrains Junie for task modes, approval-aware action execution, and GitHub task delegation

---

## 3. Architecture Thesis

The product thesis becomes the following architectural thesis:

> HugeCode is a personal distributed coding control plane in which delegated engineering work is normalized into canonical tasks, executed as governed autonomous runs by a durable runtime service, supervised from control devices, and completed through Review Pack plus Ledger evidence rather than conversational output.

If a feature does not improve one of the following, it is not core architecture work:

- supervision cost
- execution trust
- review speed
- intervention safety
- backend governance
- runtime maintainability

---

## 4. Architectural Invariants

The following are non-negotiable unless superseded by an ADR.

### 4.1 Runtime Owns Execution Truth

The canonical source of truth for task state, run state, sub-agent state, approvals, checkpoints, and placement is the runtime service.

### 4.2 UI Is Control Plane, Not Execution Brain

The UI may summarize, present, and control runtime state across devices, but it must not become a second orchestration engine.

### 4.3 Contracts Come Before Clients

Shared runtime contracts must be defined in host-contract packages before client-specific behavior evolves.

### 4.4 Review Pack Is The Trust Artifact

The most important output of a meaningful delegated run is a reviewable Review Pack evidence bundle, not a long transcript.

### 4.5 Placement Must Be Explicit

Resolved backend placement, fallback source, and placement rationale must be inspectable. Routing cannot remain a hidden side effect.

### 4.6 Additive Evolution Over Forked Behavior

New fields and lifecycle states should be added additively. Avoid client-specific copies, aliases, and divergent payloads.

### 4.7 Runtime Kernel v2 Is The Preferred Lifecycle Path

Truth-first run preparation, execution, and review semantics should land in the
runtime kernel v2 contract first.

The app may keep consuming compatibility projections while migration is in
flight, but new meaning must not be implemented by expanding UI-side heuristics
or by continuing to grow legacy v1 run payloads.

### 4.8 Activation, Invocation, And Composition Must Stay Split

HugeCode's extension and capability platform now has three different ownership planes:

- `activation` owns lifecycle truth such as active, degraded, failed, refresh-pending, and deactivated state
- `invocation` owns discoverable operator-facing IDs, visibility, shadowing, and execute routing
- `composition` owns profile-based assembly of sources, routes, backend preference, trust policy, and publication rules

These planes may share data, but they are not interchangeable.
New architecture work must not collapse:

- plugin installation into activation truth
- activation truth into invocation visibility
- publication or catalog presence into executability
- UI-side settings merges into composition truth

---

## 5. System Context

HugeCode consists of five major layers:

1. **Desktop product surfaces** in `apps/code` and `apps/code-electron`
2. **App runtime facade layer** in `apps/code/src/application/runtime/*`
3. **Transport and adapter layer** in `apps/code/src/services/*`
4. **Shared host contracts** in `packages/code-runtime-host-contract` and `packages/native-runtime-host-contract`
5. **Runtime service** in `packages/code-runtime-service-rs`

### System Role Summary

| Layer                       | Primary responsibility                                                       | Must not own                                         |
| --------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/code`                 | task definition, control-plane UX, review UX, capability-aware presentation  | execution truth, placement policy, durable lifecycle |
| `apps/code-electron`        | desktop host transport and native bridge integration                         | product policy, page-local orchestration             |
| `src/application/runtime/*` | stable UI-facing runtime APIs and backend preference resolution              | direct page-local transport sprawl                   |
| `src/services/*`            | transport adapters, bridges, helper implementations                          | canonical task state or product lifecycle truth      |
| host-contract packages      | method names, payloads, event shapes, compatibility rules                    | UI heuristics or repo-local policy                   |
| runtime service             | execution lifecycle, durability, diagnostics, placement, evidence, approvals | presentation logic                                   |

---

## 6. Product Objects And Ownership

Only the following product objects are first-class in narrative architecture:

| Product object    | Owned by                                       | Meaning                                                                      |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Workspace         | app + runtime configuration surfaces           | repo context, defaults, integrations, policy envelope                        |
| Task              | runtime contract + runtime lifecycle           | canonical engineering objective plus subordinate source summary              |
| Run               | runtime service                                | durable execution attempt, lineage, evidence, governance                     |
| Execution Profile | app/runtime boundary                           | policy, capability, model, timeout, network, and file-scope defaults         |
| Backend Profile   | runtime-facing configuration                   | execution target metadata, health, and constraints                           |
| Review Pack       | runtime-owned artifact assembled for UI review | summary, diffs, validations, warnings, and rationale                         |
| Ledger            | runtime evidence model                         | structured trail of route, actions, approvals, validations, and stop reasons |

The default product mental model remains `Workspace`, `Task`, `Run`, `Execution Profile`, and `Review Pack`.
`Backend Profile` and `Ledger` are supporting operational objects that make placement and review trustworthy; they are not separate product centers.
Mission Control snapshots and AutoDrive route state must resolve back to those runtime-owned objects. UI compatibility projections or local ledgers are not valid primary sources of truth.

### 6.3 Source-Driven Intake Stays Upstream

Source-driven work such as GitHub issue intake is an upstream task-intake concern inside the canonical `Task -> Run -> Review Pack` model.

It must not introduce:

- a second execution model
- a separate top-level product center
- page-local tracker orchestration
- client-owned backlog truth

### 6.1 Operating Roles

The distributed control-plane model depends on two operating roles:

- Control devices observe, approve, intervene, resume, and review
- Execution backends in the backend pool perform the work, with one primary backend handling most runs and burst or specialized backends joining when runtime selects them

### 6.2 Control-Plane Interpretation

The active `apps/code` experience should interpret those roles as follows:

- Mission Control is the multi-device supervision surface for observing, approving, intervening, and resuming runtime-owned runs
- Review Pack is the primary completed-run surface and must remain the default finish-line experience when runtime evidence is available
- checkpoint and handoff state must be presented from runtime-published artifacts, not reconstructed from page-local state
- Settings must separate execution-routing defaults from backend-pool operability and from transport or daemon maintenance
- backend pool health, onboarding payloads, and routing diagnostics are observability inputs for explanation and triage, not alternate execution truth
- thread-missing or degraded control-device states must stay explicit; the UI may route operators to Review Pack, checkpoint, or publish handoff artifacts, but it must not fabricate a missing thread or transcript
- web and gateway surfaces must explain capability limits honestly, including what remains writable, what is read-only, and what still requires a desktop or runtime-backed path

---

## 7. Repository Mapping

The current repo already suggests the target architecture and should be formalized rather than reinvented.

### Active Product Surfaces

- `apps/code`: primary coding workspace UI
- `apps/code-electron`: desktop container and native integration surface

### Core Runtime Layers

- `packages/code-runtime-host-contract`
- `packages/native-runtime-host-contract`
- `packages/code-runtime-service-rs`

### Required Frontend Boundary

Within `apps/code`, all runtime-facing access should enter through:

- `src/application/runtime/*`
- `src/application/runtime/ports/*`

`src/services/*` stays implementation detail and must not become the public architecture for feature code.

---

## 8. High-Level Component Model

### 8.0 Composition Planes

The runtime-first control plane now depends on four explicit composition concepts:

1. source plane
   - runtime extensions
   - workspace skills
   - prompt overlays
   - session commands
   - future rpc or wasi host binders
2. activation plane
   - canonical lifecycle and readiness truth for contributed capabilities
3. invocation plane
   - stable discoverable identities and execute dispatch keyed by invocation id
4. composition profile plane
   - layered policy and assembly over built-in, user, workspace, and launch override inputs

`apps/code` and shared workspace-client layers may render these planes, but they must not redefine them.

### 8.1 Define Layer

Responsible for task creation, execution profile selection, constraints, and backend preference capture.

### 8.2 Delegate Layer

Responsible for canonical task normalization and for turning task intent, including optional source summaries, into one canonical runtime start request.

### 8.3 Runtime Execution Layer

Responsible for:

- task lifecycle
- run lifecycle
- sub-agent orchestration
- placement resolution
- approval gating
- checkpointing
- evidence capture

### 8.4 Observe Layer

Responsible for replayable event updates, diagnostics, progress, warnings, and governance state.

### 8.5 Review Layer

Responsible for assembling and rendering the Review Pack and ledger in a human-decision-friendly form.

---

## 9. Core Architectural Decisions

| Decision             | Rule                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Product center       | HugeCode is the control plane for governed async engineering delegation                  |
| Primary client       | Desktop-first via `apps/code` + `apps/code-electron`                                     |
| Runtime core         | `packages/code-runtime-service-rs` owns execution truth                                  |
| Frontend entry point | `src/application/runtime/*` is the only approved UI boundary                             |
| Contract authority   | host-contract packages define payloads and event shapes                                  |
| Transport split      | commands and queries via RPC, updates via event streams, duplex only when truly required |
| Trust artifact       | Review Pack and runtime ledger are first-class                                           |
| Extension strategy   | runtime-owned adapters and MCP-compatible integrations only                              |
| Placement model      | explicit backend preference plus runtime-visible fallback resolution                     |
| Styling governance   | keep existing repo styling governance; no architecture drift through ad hoc UI stacks    |

---

## 10. Canonical Lifecycle Model

### 10.1 Product Loop

**Define -> Delegate -> Observe -> Approve / Intervene -> Resume / Handoff -> Review -> Decide**

### 10.2 Runtime Lifecycle Responsibilities

The runtime must own:

- task creation and mutation
- run status transitions
- route and waypoint progression
- approval waits
- sub-agent lifecycle
- checkpointing and replay
- completion, failure, and stop reasons
- source-summary carriage and lineage continuity once a task has been normalized

### 10.3 Governance Model

Run-level governance must collapse into a canonical structured summary.

Minimum governance states:

- `in_progress`
- `awaiting_approval`
- `awaiting_review`
- `action_required`
- `completed`

The UI may group or label these states differently, but it must not invent a conflicting lifecycle model.

---

## 11. Runtime Domain Architecture

The runtime service is the system-of-record for delegated work.

### 11.1 Runtime Service Responsibilities

The runtime service owns:

- canonical task and run state
- backend placement resolution results
- sub-agent session lifecycle
- checkpoint lineage and recovery state
- runtime health and diagnostics
- approval identifiers and approval state
- review-pack assembly inputs
- evidence and ledger emission

### 11.2 Runtime Service Must Not Own

The runtime service must not own:

- page-local UI state
- presentation-only grouping logic
- visual review rendering
- client-specific transport hacks

---

## 12. Task, Run, And Review-Pack Data Model

### 12.1 Task

A task should capture:

- objective
- done definition
- execution mode
- required capabilities
- constraints
- preferred backend IDs if explicitly requested
- max subtasks or fan-out limits when applicable

### 12.2 Run

A run should capture:

- durable run identity
- task linkage
- current lifecycle state
- backend placement
- checkpoint and trace references
- governance state
- approval summary
- progress and evidence summary
- completion, failure, or stop reason

### 12.3 Review Pack

A Review Pack should capture:

- task intent
- result summary
- files changed
- validation outcomes
- warnings and unresolved issues
- backend placement evidence
- rollback or next-step guidance
- references to logs, commands, and checkpoints

### 12.4 Ledger

The ledger is the structured chronology that explains how the run reached its outcome.
It should be machine-readable first and user-readable second.

---

## 13. Backend And Placement Architecture

### 13.1 Placement Inputs

Placement may derive from:

1. explicit backend preference from the task start request
2. caller-supplied launch defaults
3. app-level default backend configuration
4. runtime fallback rules when the preferred backend is unavailable

### 13.2 Placement Ownership

Frontend code may prepare backend preference, but the runtime must record and expose the resolved placement result.

### 13.3 Placement Evidence

At minimum, the system should make these fields inspectable:

- requested backend IDs
- resolved backend ID
- resolution source: explicit preference, launch default, app default, or fallback
- backend capability snapshot when available
- operator-readable placement rationale

### 13.4 Placement Observability

Changes affecting scheduling or concurrency must also account for:

- backend health
- queue depth
- active task counts
- execution slot availability
- degraded state signaling

---

## 14. AutoDrive Architecture

AutoDrive is the bounded autonomy layer, not a separate product.

### AutoDrive Responsibilities

- decompose a task into route segments or waypoints
- select the next viable step under current constraints
- reroute when new evidence changes the best path
- stop cleanly on success, policy block, no-progress, repeated failure, or human intervention
- emit enough structured evidence for review and recovery

### AutoDrive Must Not Become

- a hidden planner with opaque decision making
- a page-local reducer or UI-only abstraction
- a shell-scripted orchestration bypass

---

## 15. Sub-Agent And Fan-Out Architecture

Sub-agents are runtime-owned delegated worker sessions.

### Design Rules

- sub-agent lifecycle must be represented through canonical runtime methods
- `sessionId` is the durable handle
- parent-child lineage must remain explicit
- fan-out must remain bounded and policy-aware
- workspace, network, and tool scopes must be explicit and inspectable

### Architectural Intention

Sub-agents extend bounded execution capacity. They must not create “swarm theater” disconnected from reviewability, governance, and durability.

---

## 16. Transport And Contract Model

### 16.1 Contract Authority

Canonical method names, request payloads, summary payloads, and event shapes must be defined in shared host-contract packages first.

### 16.2 Transport Model

- RPC for commands and queries
- event stream for replayable updates
- duplex channels only where continuous interaction is actually required

### 16.3 Frontend Contract Rule

UI components must not bypass runtime facades to call transport internals directly.

---

## 17. Persistence, Recovery, And Replay

Durability is a product requirement, not a technical nice-to-have.

The system must preserve:

- task snapshots
- run snapshots
- sub-agent snapshots
- tool-call lifecycle snapshots where applicable
- checkpoint lineage
- recovery markers

### Recovery Design Rule

If a long-running execution path cannot be resumed, diagnosed, or audited after interruption, it is not production-ready.

---

## 18. Security And Approval Architecture

### 18.1 Approval State Is Runtime State

Approval handling must be embedded in runtime lifecycle, not implemented as a UI-only pause convention.

### 18.2 Permission Boundaries

The system must preserve:

- workspace-relative file boundaries
- explicit write scope
- network permission controls
- explicit separation between read-only and mutating actions
- dangerous command rejection where applicable

### 18.3 Bridge Rule

Any WebMCP or external bridge must preserve approval boundaries and reveal which runtime method actually executed.

---

## 19. Review Pack As Primary Trust Artifact

Review speed is the most important downstream effect of good architecture.

Therefore:

- runtime evidence should be structured for summarization
- the Review Pack must be stable across reconnects, client restarts, and control-device handoff
- review surfaces should read canonical run and governance state directly
- review artifacts must support approval, rejection, and guided iteration

---

## 20. Observability And Diagnostics

The architecture must ship diagnostics with lifecycle complexity.

### Minimum Observability Requirements

- replayable event history
- run- and backend-level diagnostics
- checkpoint write totals and failures
- recovery counters
- degraded-state signaling
- approval wait visibility
- placement visibility

The goal is not observability for its own sake. The goal is low-cost supervision and fast failure diagnosis.

---

## 21. Performance And UX Budgets

The product should optimize for:

- responsive desktop interaction during long-running runs
- progressive updates instead of blocking refreshes
- compact payloads for high-frequency run summaries
- efficient idle behavior
- review-pack generation fast enough to preserve user flow at the end of a run

---

## 22. Delivery Sequence

### Phase 1

- runtime-owned task/run truth
- canonical governance state
- backend placement resolution visibility
- baseline review-pack generation

### Phase 2

- AutoDrive waypoint and reroute model
- checkpoint and replay hardening
- bounded sub-agent orchestration

### Phase 3

- richer review-pack and ledger summarization
- stronger diagnostics and placement rationale
- team-level execution profiles and policy envelopes

### Phase 4

- ecosystem depth through MCP-compatible and runtime-owned adapters
- analytics for review throughput and supervision cost

---

## 23. Fitness Functions

Architecture progress should be judged by the following questions:

1. Can delegated work survive reconnects and restarts?
2. Can a reviewer understand what happened without replaying the whole session?
3. Is backend placement explicit and explainable?
4. Can the user intervene faster than they could manually take over?
5. Are UI/runtime boundaries getting narrower rather than blurrier?
6. Do contracts evolve additively instead of forking across clients?

---

## 24. Anti-Drift Rules

Avoid the following:

- UI components calling transport or desktop-host APIs directly
- page-local backend routing after task start
- shell commands becoming unofficial orchestration APIs
- duplicated runtime types in app packages
- feature growth that increases review cost instead of lowering it
- chat-first surfaces replacing Review Pack as the core trust artifact

---

## 25. One-Sentence Summary

HugeCode’s architecture should converge on a **runtime-owned, review-centric, multi-backend control plane for governed async engineering delegation**.
