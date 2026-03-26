# Runtime Borrowing Blueprint

Date: 2026-03-25
Status: active
HugeCode baseline: `origin/main` @ `cf3e5bcf90aef4ddbd45f037121befea932818bb`
External calibration baseline: `badlogic/pi-mono` `main` @ `629341c18f3482d891b665a844975096b47b4779`
Release calibration: `v0.62.0` published 2026-03-23

## Purpose

This blueprint recalibrates HugeCode's borrowing strategy against the current public `pi-mono`
repository.

The earlier borrowing frame leaned heavily on HugeCode's own `fastcode`-era runtime shape. The
current `pi-mono` `main` branch changes the correct reading:

- `pi-mono` is a strong source for agent harness, tool lifecycle, and extension loading patterns
- `pi-mono` is not the right source for replacing HugeCode's runtime-owned execution, review, or
  continuity truth

The goal of this document is to make the next borrowing decisions explicit:

- what HugeCode should copy directly from `pi-mono`
- what HugeCode should adapt instead of clone
- what should be deferred
- what should be explicitly rejected

## Non-Negotiable HugeCode Invariants

Any borrowing from `pi-mono` must preserve all of the following:

1. `apps/code/src/application/runtime/*` remains the only approved frontend runtime boundary
2. runtime remains the source of truth for execution, review, checkpoint, and continuity state
3. runtime/public contracts stay contract-first and additive
4. desktop/web shell differences remain outside page-local orchestration logic
5. HugeCode styling constraints remain intact; no Tailwind, inline styles, or `mini-lit`
   backsliding in repo-owned UI surfaces

## Current Reading Of `pi-mono`

The latest `pi-mono` architecture is best understood as:

```text
pi-ai
  -> provider/model unification

pi-agent-core
  -> evented agent loop
  -> queueing
  -> tool execution policy hooks

pi-coding-agent
  -> sessions
  -> compaction
  -> skills
  -> prompt templates
  -> extensions
  -> package/resource loading
  -> interactive / RPC / SDK modes

pi-tui / pi-web-ui
  -> shell implementations

pi-pods / pi-mom
  -> peripheral product surfaces
```

For HugeCode, this means the right borrowing boundary is:

- above the runtime truth layer
- inside app-facing orchestration, eventing, resource loading, and operator ergonomics

It does not mean:

- replacing runtime truth with local session files
- weakening the contract-first boundary
- turning HugeCode into a terminal-first coding harness product

## Borrowing Decisions

### Copy Directly

#### 1. Event taxonomy for agent and tool lifecycle

Borrow directly from the current `pi-agent-core` idea that a UI should receive a stable stream of
structured lifecycle events instead of reconstructing progress from transcript text.

Why this is safe:

- it improves legibility without changing truth ownership
- it belongs naturally in app-facing runtime facades
- it makes tool and turn progress easier to render in Mission Control and related surfaces

HugeCode application:

- define a stable app/runtime-facing event vocabulary for user turn, assistant turn, tool start,
  tool progress, tool end, and run summary progression
- keep these events derived from runtime truth or runtime-approved execution channels

#### 2. Hookable pre/post tool execution model

Borrow directly from the `beforeToolCall` and `afterToolCall` shape in `pi-agent-core`.

Why this is safe:

- it provides a clear intervention model
- it separates validation, policy, execution, and postprocessing
- it avoids page-local ad hoc interception logic

HugeCode application:

- express this as a proposal inside app/runtime facades and runtime orchestration layers
- do not expose raw page-level hooks that bypass runtime or contract constraints

#### 3. Resource loading discipline for skills and extensions

Borrow directly from `pi-coding-agent`'s explicit loader model for:

- skills
- prompt templates
- extensions
- resource/package loading

Why this is safe:

- HugeCode is already `skills`-first
- the borrowing target is loading discipline and capability discovery
- it complements, rather than replaces, runtime-governed execution

### Adapt

#### 1. Session tree, fork, and compaction ideas

Adapt the operator ergonomics, not the persistence authority.

Borrowed idea:

- branching, revisiting, compacting, and naming a work stream should be explicit

Required adaptation:

- HugeCode runtime must remain the source of truth
- session tree or compaction affordances must be grounded in runtime-backed run/thread/review data
- do not let a local session file become the canonical continuation model

#### 2. Model/provider registry ergonomics

`pi-ai` is a good example of keeping provider/model shape coherent and reusable.

Required adaptation:

- HugeCode must retain backend routing, policy, and capability constraints
- provider ergonomics can improve without flattening runtime-backed routing decisions

#### 3. SDK-style reusable surfaces

`pi-coding-agent` exports an SDK that lets external apps construct sessions with controlled tools,
resource loaders, and settings.

Required adaptation:

- HugeCode's reusable surfaces should stay runtime-aware and shell-aware
- do not replace the shared workspace client or runtime boundary with a local harness SDK

### Defer

#### 1. TUI-first shell patterns

`pi-tui` is technically strong, but it is not aligned with HugeCode's current primary surfaces.

Reason to defer:

- HugeCode is a desktop/web mission-control product, not a terminal-first coding harness

Revisit only if:

- a terminal-native HugeCode surface becomes an active product requirement

#### 2. Standalone reusable web chat shell

`pi-web-ui` proves that the stack can ship a reusable browser shell around the agent core.

Reason to defer:

- HugeCode already has a React-based product architecture and a shared workspace client
- `pi-web-ui`'s stack choices conflict with current repo constraints

Revisit only if:

- HugeCode intentionally creates a separate embeddable public shell with different architectural
  goals

#### 3. Peripheral product surfaces such as `pi-pods` and `pi-mom`

Reason to defer:

- they are outside the highest-leverage borrowing path for HugeCode today

### Reject

#### 1. Tailwind plus `mini-lit` plus web-components stack

Reject entirely for repo-owned HugeCode surfaces.

Protected invariant:

- HugeCode's React plus `vanilla-extract` plus design-system direction

#### 2. CLI-local session ownership as canonical execution truth

Reject entirely.

Protected invariant:

- runtime owns execution, review, checkpoint, and continuity truth

#### 3. Monolithic harness ownership of continuation and review semantics

Reject entirely.

Protected invariant:

- review and continuation must stay runtime-backed, additive, and consumable across shells

## Recommended Roadmap

### Phase 1: app-facing event vocabulary

Goal:
define a HugeCode-specific event vocabulary for tool and turn lifecycle that can be consumed by UI
surfaces without transcript archaeology.

Deliverables:

- a design for event names, payload shape, and ordering guarantees
- placement of those types inside approved application/runtime boundaries
- explicit distinction between runtime truth events and UI summary events

Success bar:

- a UI can render progress, tool status, and turn boundaries from structured events alone
- no page code needs raw transport choreography

### Phase 2: hookable tool lifecycle facade

Goal:
define a HugeCode-specific pre/post tool lifecycle model inspired by `pi-agent-core`.

Deliverables:

- proposed interception points
- allowed responsibilities for each hook
- interaction rules with policy, approvals, and runtime guardrails

Success bar:

- tool execution shaping is explicit and testable
- hooks do not become a backdoor around runtime policy or contract rules

### Phase 3: skills/resource loading discipline

Goal:
tighten HugeCode's skills/resource discovery and packaging rules based on `pi-coding-agent`'s
resource loading discipline.

Deliverables:

- explicit loader responsibilities
- discovery precedence rules
- runtime-approved capability publication rules

Success bar:

- skills loading is consistent and inspectable
- new capability sources do not bypass runtime governance

## Candidate Future Interface Additions

These are proposals only. They are not approved contract changes.

### Candidate app-facing event families

- `run_turn_started`
- `run_turn_completed`
- `tool_execution_started`
- `tool_execution_progress`
- `tool_execution_completed`
- `tool_execution_blocked`
- `tool_result_postprocessed`

Rules:

- these should live behind `apps/code/src/application/runtime/*` or shared runtime-aware client
  layers
- they should summarize runtime or runtime-approved channels, not replace them

### Candidate tool lifecycle interception points

- pre-validation summary hook
- post-validation pre-execution hook
- post-execution pre-publication hook

Rules:

- page code must not own these hooks directly
- runtime policy and approval logic must remain authoritative

## First Useful Adoption Slice

The first implementation after this research should be:

> add a HugeCode-specific design for runtime/app-facing tool lifecycle hooks and event vocabulary,
> informed by `pi-agent-core`, without changing runtime RPC contracts yet.

Why this is the right first slice:

- it is high leverage
- it keeps the borrowing surface narrow
- it improves operator-facing clarity
- it does not compromise HugeCode's runtime-first architecture

## Decision Summary

The corrected borrowing strategy is:

- copy `pi-mono`'s event vocabulary discipline directly
- copy `pi-mono`'s pre/post tool lifecycle model directly
- copy `pi-mono`'s resource loading discipline directly
- adapt session/compaction and provider-registry ergonomics carefully
- defer TUI, standalone web shell, and peripheral products
- reject any move that relocates canonical truth away from HugeCode runtime

This is the highest-value interpretation of `pi-mono` `main` for HugeCode on 2026-03-25.
