# `pi-mono` Latest Main Source Deep Dive

Date: 2026-03-25
Status: active
HugeCode baseline: `origin/main` @ `cf3e5bcf90aef4ddbd45f037121befea932818bb`
External calibration baseline: `badlogic/pi-mono` `main` @ `629341c18f3482d891b665a844975096b47b4779`
Release calibration: `v0.62.0` published 2026-03-23

## Purpose

This document refreshes the older `fastcode`-era reading of `pi-mono` against the current public
`main` branch.

The old reading was useful for HugeCode's runtime-first control-plane design, but the current
`pi-mono` repository is not a runtime-truth system in the HugeCode sense. It is now better read as
a package-first agent toolkit with a reusable provider layer, a generic evented agent loop, and a
coding harness that can run in interactive, RPC, and SDK modes.

The most important conclusion is:

> HugeCode should study `pi-mono` for agent-harness composition, tool lifecycle design, and
> resource loading discipline, not as a replacement model for runtime-owned execution truth.

## Package Topology On `main`

Pinned repository facts from `629341c18f3482d891b665a844975096b47b4779`:

| Package                                                            | Current role                                                                                               | What it means for HugeCode                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `@mariozechner/pi-ai`                                              | Unified provider/model API with generated model catalogs and provider-specific subpath exports             | Strong reference for model/provider ergonomics                   |
| `@mariozechner/pi-agent-core`                                      | Generic stateful agent loop with tool calling, event streaming, queueing, and hook points                  | Strong reference for app-facing agent event vocabulary           |
| `@mariozechner/pi-coding-agent`                                    | Terminal coding harness with sessions, compaction, skills, prompt templates, extensions, RPC mode, and SDK | Strong reference for harness composition and extensibility       |
| `@mariozechner/pi-tui`                                             | Differential-rendering terminal UI library                                                                 | Useful, but not directly aligned with HugeCode product direction |
| `@mariozechner/pi-web-ui`                                          | Web component chat UI built with `mini-lit` and Tailwind                                                   | Useful as an existence proof, not as a stack template            |
| `packages/pods` published as `@mariozechner/pi` with `pi-pods` CLI | vLLM / GPU-pod deployment tooling                                                                          | Product-peripheral for HugeCode today                            |
| `@mariozechner/pi-mom`                                             | Slack bot wrapper around the coding agent                                                                  | Product-peripheral for HugeCode today                            |

The structural chain is:

```text
pi-ai
  -> pi-agent-core
    -> pi-coding-agent
      -> interactive mode / RPC mode / SDK
      -> pi-tui / pi-web-ui shells
      -> pods / mom as peripheral integrations
```

This is not the same shape as HugeCode's:

```text
apps/code
  -> application/runtime boundary
    -> shared workspace client
      -> runtime host contract
        -> Rust runtime service
```

That difference matters. `pi-mono` optimizes for reusable local harnesses. HugeCode optimizes for
runtime-owned execution truth across shells and control surfaces.

## The Three Core Layers Worth Studying

### 1. `pi-ai`: provider and model unification

`packages/ai/package.json` shows the package exports multiple provider-specific entrypoints while
still preserving one root API surface. The package owns:

- built-in provider adapters
- model generation scripts
- a single stream contract consumed by higher layers
- transport and auth concerns at the provider boundary

What is worth borrowing:

- one coherent provider/model vocabulary instead of page-local provider branching
- provider subpath exports instead of leaking backend-specific logic everywhere
- a generated or centrally curated model registry instead of scattered model literals

What is not the main lesson:

- HugeCode should not import `pi-ai`'s exact package shape into runtime contracts
- HugeCode already has a stronger runtime boundary than `pi-mono`; the value here is ergonomics,
  not truth ownership

### 2. `pi-agent-core`: generic evented agent loop

`packages/agent/src/agent.ts`, `packages/agent/src/agent-loop.ts`, and
`packages/agent/src/types.ts` are the most important current files in the repo for HugeCode.

The key chain is:

```text
AgentMessage[]
  -> transformContext()
  -> convertToLlm()
  -> stream assistant response
  -> execute tool calls
  -> emit structured events
```

The important design decisions are:

- app-specific message types are allowed before the LLM boundary
- `transformContext()` prunes or injects context before provider conversion
- `convertToLlm()` is the explicit narrowing point to provider-compatible messages
- tool execution can be `parallel` or `sequential`
- `beforeToolCall()` can block execution after validation
- `afterToolCall()` can replace or augment the finalized tool result
- steering and follow-up queues are explicit first-class concepts
- event emission is consistent across user message, assistant stream, tool start, tool update, and
  tool end

For HugeCode, this is the highest-value direct reading in the current `pi-mono` repository. It is
not a runtime contract, but it is a strong model for application/runtime-facing event taxonomy.

### 3. `pi-coding-agent`: harness composition

`packages/coding-agent` is where `pi-mono` stops being a generic agent library and becomes a
complete product harness.

The package currently combines:

- `AgentSession`
- `session-manager`
- `compaction`
- `settings-manager`
- `auth-storage`
- `model-registry`
- `skills`
- `prompt templates`
- `extensions`
- `resource-loader`
- `package-manager`
- `interactive` and `rpc` modes
- an exported SDK for embedding

The most important reading is not "this package is large"; it is "the package draws a stable line
between reusable agent core and workflow-specific harness."

That line is what HugeCode should learn from.

## The Four Abstractions Most Worth Comparing

### A. Hookable tool lifecycle

`pi-agent-core` exposes two very practical hook points:

- `beforeToolCall`
- `afterToolCall`

This is valuable because it separates:

- argument validation
- policy or guard logic
- tool execution
- final result shaping

HugeCode already has stronger runtime-side truth and policy machinery. What `pi-mono` adds is a
clean app-facing model for lifecycle interception without forcing page code to assemble raw tool
transport.

### B. Event vocabulary over transcript archaeology

The `AgentEvent` stream in `pi-agent-core` is structured enough that UIs can render meaningful
progress without reverse-engineering transcripts.

That matters for HugeCode because Mission Control, AutoDrive, and review surfaces already benefit
from explicit runtime truth. Borrowing a similar event vocabulary at the app/runtime boundary would
make timeline rendering and tool progress surfaces clearer without weakening runtime ownership.

### C. Session tree, fork, and compaction

Current `pi-coding-agent` treats sessions as first-class local artifacts with:

- tree navigation
- branch-style forking
- manual and automatic compaction
- session naming and export

HugeCode should not copy the local session file model as canonical truth, but the interaction model
is useful. The good borrowing target is the operator experience:

- branch a thought process cleanly
- compact older context intentionally
- preserve navigation through prior states

The wrong borrowing target is the persistence authority.

### D. Resource loading for skills, prompts, and extensions

`pi-coding-agent` exposes a clear loader story:

- load skills from directories
- discover extensions
- manage prompt templates
- use a package manager and resource loader to control where capabilities come from

This aligns strongly with HugeCode's `skills`-first direction. The useful idea is disciplined
loading and packaging, not turning HugeCode into a local CLI package ecosystem.

## HugeCode Comparison Points

### 1. Runtime truth ownership

HugeCode and `pi-mono` differ sharply here.

HugeCode:

- runtime owns task, run, review, checkpoint, continuity, and backend-routing truth
- UI is intentionally a control plane and summary layer

`pi-mono`:

- harness owns session state locally
- no equivalent of HugeCode's runtime-owned mission/review/continuity truth
- UI shells are closer to the agent session itself than to a remote source of truth

Conclusion:
`pi-mono` is not a model for replacing HugeCode runtime truth. It is a model for making the
app-facing harness around that truth more coherent.

### 2. Contract-first boundaries

HugeCode is stronger here today.

HugeCode:

- frozen runtime contracts
- explicit capabilities and additive payload evolution
- approved frontend boundary in `apps/code/src/application/runtime/*`

`pi-mono`:

- package APIs and exported types
- reusable SDK surface
- stable code-level abstractions, but not a runtime RPC contract of the same kind

Conclusion:
HugeCode should keep its current contract-first runtime design and borrow only the harness-facing
API clarity from `pi-mono`.

### 3. Shared workspace client vs reusable UI shells

HugeCode:

- `packages/code-workspace-client` is a shell-agnostic runtime-facing client layer

`pi-mono`:

- `pi-tui` and `pi-web-ui` are optional shell technologies
- `pi-web-ui` is a component library, not a runtime truth layer

Conclusion:
HugeCode should not confuse reusable UI shells with a shared runtime client. `pi-mono` proves the
value of shell separation, but HugeCode's shared workspace client remains the higher-value pattern.

### 4. Review and continuation

HugeCode:

- runtime-owned `Review Pack`
- runtime-owned continuation objects such as `checkpoint`, `missionLinkage`,
  `publishHandoff`, `reviewActionability`, and `takeoverBundle`

`pi-mono`:

- session tree, fork, export, compaction, and queueing
- review is closer to operator workflow than to a runtime artifact

Conclusion:
Borrow the operator ergonomics. Do not demote HugeCode review or continuation truth into a local
session concern.

### 5. Skills-first extension strategy

This is the strongest overlap between the two systems.

`pi-mono` has:

- skills
- prompt templates
- extensions
- package loading

HugeCode has:

- skills-first extension direction
- runtime-backed operator workflows

Conclusion:
HugeCode should borrow `pi-mono`'s loading discipline, packaging clarity, and capability discovery
patterns while keeping runtime ownership of what is executable, reviewable, and resumable.

## Borrowing Matrix

### Copy Directly

| Candidate                                          | Why it is worth copying directly                                                | HugeCode boundary                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Agent/tool event taxonomy                          | Makes progress, streaming, and tool work legible without transcript archaeology | App-facing runtime facade and UI summary layers                         |
| `beforeToolCall` / `afterToolCall` lifecycle model | Cleanly separates validation, policy, execution, and final result shaping       | App/runtime boundary proposals only, not page-local hooks               |
| Resource loading discipline for skills/extensions  | Fits HugeCode's current skills-first direction                                  | Shared loading and packaging rules around runtime-approved capabilities |

### Adapt

| Candidate                             | Why adaptation is needed                                                                          | HugeCode constraint                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Session tree / fork / compaction UX   | Operator flow is valuable, but local session files cannot become truth                            | Keep runtime as source of record                                    |
| Model registry ergonomics             | Good package-level design, but HugeCode must keep routing and policy constraints                  | Preserve runtime/provider authority                                 |
| SDK-style reusable surface boundaries | Good composition pattern, but HugeCode needs runtime-aware shells, not a standalone local harness | Keep `apps/code/src/application/runtime/*` as the frontend boundary |

### Defer

| Candidate                         | Why defer                                                                          | Trigger for reconsideration                                          |
| --------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `pi-tui`-style interaction model  | Interesting, but not aligned with current desktop/web product surface              | Only if HugeCode adds a serious terminal-first surface               |
| `pi-web-ui` standalone chat shell | Useful as a reference, but HugeCode already has its own UI stack and shared client | Only if a separate embeddable public chat shell becomes product work |
| `pi-pods` and `pi-mom` surfaces   | Peripheral product lines relative to current HugeCode priorities                   | Only after core runtime/operator workflows stabilize                 |

### Reject

| Candidate                                                     | Why reject                                                 | HugeCode invariant protected                                |
| ------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Tailwind + `mini-lit` + web-components stack from `pi-web-ui` | Conflicts with HugeCode styling and app architecture rules | `vanilla-extract`, design-system, React workspace surfaces  |
| CLI-local session state as canonical execution truth          | Conflicts with runtime-first product model                 | Runtime ownership of run/review/checkpoint/continuity truth |
| Monolithic harness ownership of continuation/review           | Would collapse operator summaries back into local UI logic | Runtime-backed review and continuity artifacts              |

## What Changed Versus The Older Reading

The old document overfit `pi-mono` into a HugeCode-like runtime story.

The current `main` branch supports a different reading:

1. `pi-mono` is strongest as a reusable agent toolkit, not as a remote runtime architecture.
2. `pi-agent-core` is the most valuable current borrowing source for HugeCode.
3. `pi-coding-agent` is the second most valuable source, but mostly for harness composition,
   resource loading, and operator ergonomics.
4. `pi-web-ui`, `pi-tui`, `pi-pods`, and `pi-mom` are secondary references, not first-wave
   borrowing targets.

## First Recommended Post-Research Slice

The first follow-on implementation should be:

> design a HugeCode-specific runtime/app-facing event vocabulary and tool lifecycle hook model,
> informed by `pi-agent-core`, while preserving runtime truth, contract-first evolution, and the
> approved frontend boundary.

That slice is small enough to be real, high-value enough to matter, and narrow enough that it does
not tempt the repo into copying `pi-mono`'s local-harness truth model.
