# Pi-Mono Source Deep Dive Tracks

Date: 2026-03-28
Status: active working doc
Branch: `feature-browser`
HugeCode workspace: `/Volumes/Dev/HugeCode/.worktrees/feature-browser`
Pi-mono reference checkout: `/Users/han/Documents/Code/github/pi-mono`
Pi-mono baseline: `badlogic/pi-mono` `576e5e1a2fbe1abbbad96b696f4058cffd8391ca` (2026-03-27)

## Intent

This document updates the existing borrowing analysis with a narrower goal:

- re-check `pi-mono` claims against current source, not only README philosophy
- separate confirmed architecture facts from attractive but overstated summaries
- turn the findings into four tracks that can progress in parallel in HugeCode

This is still a docs-only artifact. It does not change HugeCode runtime contracts, frontend surfaces, or Rust code in this branch.

## Scope

In:

- `packages/agent`
- `packages/coding-agent/src/core/*`
- `packages/ai`
- `packages/coding-agent/examples/extensions/*`
- top-level package boundaries and mode entrypoints

Out:

- line-by-line review of TUI rendering internals
- `pi-web-ui` UI stack adoption
- `pi-pods` product architecture
- external product-trend revalidation on the public web

## Source-Rechecked Findings

### 1. The strongest reusable boundary is still a small agent runtime core

Confirmed in current source:

- `packages/agent` owns the reusable loop, event vocabulary, tool orchestration, streaming, steering, follow-up polling, and cooperative abort flow.
- The LLM boundary is narrow: `transformContext` then `convertToLlm` then provider stream execution.
- `Agent` is a stateful wrapper around the loop, not a full session or persistence system.

Why it matters for HugeCode:

- this validates a Rust split where the core crate is a loop plus event model, not a shell, not a planner, and not a session database
- it also validates that pre/post tool hooks belong at the loop boundary, not inside each surface

Source anchors:

- `packages/agent/src/agent-loop.ts`
- `packages/agent/src/agent.ts`
- `packages/agent/src/types.ts`

### 2. `AgentSession` is where product-grade complexity actually lives

Confirmed in current source:

- `AgentSession` adds event serialization, session persistence, compaction, retry, bash execution, extension integration, session switch/fork/tree behavior, and prompt/resource assembly.
- This is a real separation between loop/runtime and long-lived product/session policy.

Important correction:

- retries, compaction, and persistence are not core runtime responsibilities in `pi-mono`; they are wrapper responsibilities above `packages/agent`

Why it matters for HugeCode:

- HugeCode should avoid collapsing runtime loop and product orchestration into one crate or one service
- the Rust design should treat session policy as a distinct layer with explicit contracts

Source anchors:

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/kernel/session-kernel.ts`

### 3. Sessions are tree-shaped append-only logs, but not full event sourcing

Confirmed in current source:

- sessions are JSONL files with `id` and `parentId`
- one file can contain in-place branches
- `buildSessionContext()` replays only the active root-to-leaf path
- compaction and branch summaries are persisted as special entries in the same log

Important corrections:

- this is not pure event sourcing because the log mixes domain events, UI metadata, and derived summary artifacts
- cross-file fork is copy-based ancestry, not a shared DAG
- entry identifiers are not globally unique after branch extraction into new files

Why it matters for HugeCode:

- the tree UX is worth borrowing
- the storage model should be upgraded when ported to Rust: immutable event stream plus structured checkpoint/snapshot store

Source anchors:

- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/src/core/compaction/*`

### 4. The extension system is first-class, but trust and isolation are intentionally weak

Confirmed in current source:

- extensions can register tools, commands, UI, model providers, custom messages, session metadata, and compaction hooks
- example extensions cover permission gates, custom providers, plan mode, subagents, dynamic resources, remote execution, and UI replacement
- CLI, print, RPC, and SDK do share one `AgentSession` session stack through `createAgentSession()` and `DefaultSessionKernel`
- modes provide different UI contexts, but the extension API is one shared capability plane inside `coding-agent`

Important correction:

- `pi-mono` does not keep subagents or plan mode in core; those are examples/extensions layered on top
- `pi-mono` surface reuse is asymmetric: `mom` reuses `AgentSession` and related internals but hand-assembles its own context; `web-ui` does not reuse the `coding-agent` session and extension stack at all, and instead binds directly to `pi-agent-core` and `pi-ai`
- this confirms the philosophy, but it also means untrusted extension code can run with broad authority

Why it matters for HugeCode:

- HugeCode should preserve the open boundary idea
- HugeCode should not copy the trust model; plugin isolation, manifests, and permission boundaries should be stronger

Source anchors:

- `packages/coding-agent/src/core/extensions/types.ts`
- `packages/coding-agent/src/core/extensions/loader.ts`
- `packages/coding-agent/examples/extensions/README.md`

### 5. Provider abstraction is broader than a simple `generate()` trait

Confirmed in current source:

- `pi-ai` models carry provider, API, base URL, cost, reasoning flag, input modes, context window, max tokens, and compat details
- `ModelRegistry` merges built-in models with `models.json` overrides and provider-level compatibility adjustments
- provider adapters include compatibility shims for reasoning effort, strict mode, tool result naming, assistant-after-tool-result insertion, usage-in-streaming, and max-token field differences
- transcript normalization is its own stage before adapter request shaping, so cross-provider continuation can repair tool ids, thinking blocks, and incomplete tool flows

Important correction:

- the real dispatch key is closer to `(provider, api_family, model_id)` than provider name alone
- the capability story is real, but it is split across `pi-ai` providers and `coding-agent` registry/resolver code rather than presented as one formal capability matrix API

Why it matters for HugeCode:

- a Rust provider crate should expose capability-aware traits and structured compatibility flags
- the abstraction should not flatten everything into a lowest-common-denominator completion interface

Source anchors:

- `packages/ai/src/models.ts`
- `packages/ai/src/providers/openai-completions.ts`
- `packages/ai/src/providers/openai-responses.ts`
- `packages/coding-agent/src/core/model-registry.ts`
- `packages/coding-agent/src/core/model-resolver.ts`

## What To Borrow vs What To Correct

### Borrow Directly

- small loop core with explicit event vocabulary
- `transformContext` then `convertToLlm` boundary
- pre/post tool hooks
- queue-based steering and follow-up semantics
- session tree UX
- multi-surface session bootstrap through one composition entrypoint

### Borrow With Upgrades

- append-only session storage
- compaction and overflow recovery
- provider/model catalog
- extension loading and resource discovery

### Do Not Copy As-Is

- JSONL durability model for long-lived production state
- broad trust in arbitrary extension code
- cross-file fork model with copied entry ids
- web stack choices in `pi-web-ui`

## HugeCode Parallel Track Plan

The tracks below are designed to move in parallel with minimal write overlap. They are intentionally aligned to different architectural seams, not different UI pages.

### Track 1: Runtime Core and Event Vocabulary

Goal:

- define the Rust single-agent kernel as a strict loop/state-machine primitive, independent of UI and persistence

In scope:

- runtime event envelope
- assistant stream lifecycle
- tool call lifecycle
- steering queue
- follow-up queue
- cooperative cancellation
- sequential vs parallel tool execution policy

Out of scope:

- persistence
- checkpointing
- MCP
- plugin sandboxing

Deliverables:

- Rust crate boundary proposal for `agent-core`
- canonical event enum and state transition table
- hook contract for before/after tool execution
- one compatibility note mapping HugeCode runtime truth to loop-local event truth

Acceptance criteria:

- every step of one run can be represented as structured events
- loop semantics do not require UI or host-specific types
- steering is explicitly checkpointed, not modeled as preemptive interruption

Primary source basis:

- `packages/agent/src/agent-loop.ts`
- `packages/agent/src/agent.ts`
- `packages/agent/src/types.ts`

### Track 2: Session Store, Tree Navigation, and Checkpoints

Goal:

- design a HugeCode session subsystem that keeps pi-style tree ergonomics while upgrading storage and replay semantics

In scope:

- append-only session event schema
- branch/tree navigation model
- structured checkpoint format
- compaction boundary rules
- retry and overflow recovery interaction
- audit and replay requirements

Out of scope:

- UI tree selector design
- provider auth
- plugin host

Deliverables:

- event-store schema draft for `agent-session`
- checkpoint format proposal: structured state plus narrative summary
- branch/fork semantics for single stream, branch copy, and durable replay
- storage recommendation with failure model comparison: JSONL vs SQLite WAL vs RocksDB-style log

Acceptance criteria:

- replay source is unambiguous after compaction
- checkpoint state is machine-readable first
- branch identity and event identity remain globally coherent

Primary source basis:

- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/compaction/*`

### Track 3: Surface Reuse and Plugin Boundary

Goal:

- keep one runtime/session kernel across CLI, desktop, RPC, and future chat surfaces while moving extensibility out of core

In scope:

- shared bootstrap entrypoint
- mode/surface adaptation boundary
- extension API categorization
- plugin host contracts
- custom tool and custom provider registration path
- trust boundary design for plugins

Out of scope:

- specific Electron or web UI implementation
- new product-specific workflows

Deliverables:

- HugeCode crate/module split for `agent-surfaces` and `agent-plugins`
- plugin trust model comparison: in-process TS-like model vs RPC plugin host vs WASI
- surface matrix showing what is shared and what remains adapter-specific
- recommendation on whether subagents/planner stay outside core as tools/handoffs

Acceptance criteria:

- no surface owns its own agent semantics
- extension capabilities are grouped by stable contracts
- untrusted plugins do not require full host trust by default
- the design explicitly distinguishes full session-stack reuse from core-only reuse

Primary source basis:

- `packages/coding-agent/src/main.ts`
- `packages/coding-agent/src/core/sdk.ts`
- `packages/coding-agent/src/core/extensions/*`
- `packages/coding-agent/examples/extensions/*`

### Track 4: Provider Catalog, Capability Matrix, and Compatibility Shims

Goal:

- design a provider layer that handles real-world model differences without leaking provider-specific conditionals into the runtime loop

In scope:

- model catalog schema
- capability matrix
- request auth and header resolution
- reasoning-effort clamp rules
- tool and tool-result compatibility flags
- retryable vs non-retryable error classification
- transport preference and streaming compatibility

Out of scope:

- pricing UX
- model selector UI

Deliverables:

- `agent-model` crate proposal
- structured capability matrix API
- compatibility shim table for OpenAI-style, Responses-style, Anthropic-style, and proxy providers
- retry policy split between provider adapter and session layer
- dispatch-key guidance for `(provider, api_family, model_id)`

Acceptance criteria:

- runtime loop can ask explicit capability questions instead of guessing from provider names
- provider-specific quirks are isolated in adapter or compat data
- session layer can make retry and overflow decisions from structured error classes
- transcript normalization is a first-class boundary ahead of provider adapters

Primary source basis:

- `packages/ai/src/providers/*`
- `packages/ai/src/models.ts`
- `packages/coding-agent/src/core/model-registry.ts`
- `packages/coding-agent/src/core/model-resolver.ts`

## Track Dependencies

Parallel start order:

- Track 1 can start immediately
- Track 2 can start immediately
- Track 3 can start immediately
- Track 4 can start immediately

Synchronization points:

- Track 2 depends on Track 1 event vocabulary before freezing replay schema
- Track 3 depends on Track 1 hook semantics before freezing plugin/tool contracts
- Track 4 depends on Track 1 runtime questions before freezing capability APIs

Recommended merge order:

1. Track 1
2. Track 4
3. Track 2
4. Track 3

Reason:

- Track 1 defines the primitive language
- Track 4 constrains model/runtime capability queries
- Track 2 then freezes durable event and checkpoint shape
- Track 3 can bind surfaces and plugin APIs to the stabilized kernel/session contracts

## Proposed Rust Crate Mapping

- `agent-model`
  provider adapters, auth resolution, model catalog, capability matrix, error taxonomy
- `agent-core`
  loop, event stream, tool orchestration, steering/follow-up, cancellation
- `agent-session`
  event store, checkpoints, compaction, retry, branch tree, replay
- `agent-tools`
  tool schema, validation, execution runtime, sandbox adapters
- `agent-mcp`
  optional MCP bridge layer
- `agent-plugins`
  plugin manifest, RPC/WASI host, permission model
- `agent-surfaces`
  CLI, TUI, RPC, SDK, chat adapters
- `agent-observe`
  tracing, metrics, cost, replay tooling

Suggested dependency direction:

- `agent-model -> agent-core -> agent-session`
- `agent-tools` depends on `agent-core` and selected platform adapters
- `agent-surfaces` depends on `agent-session`, `agent-tools`, and `agent-model`
- `agent-plugins` and `agent-mcp` are sidecars that do not back-pollute `agent-core`
- `agent-observe` consumes events from `agent-core` and `agent-session`

## Immediate Next Actions

- use Track 1 to freeze the runtime event envelope HugeCode wants to own
- use Track 4 to prevent provider-specific branches from leaking upward
- use Track 2 to draft the first structured checkpoint format
- use Track 3 to decide whether HugeCode wants RPC plugins, WASI plugins, or both

## Risks and Open Corrections

- the earlier high-level summary that `pi-mono` is already an event-sourced session system is directionally useful but technically too strong
- the earlier summary that steering is an interrupt is also too strong; it is queued guidance at turn boundaries
- the earlier package dependency line `tui -> ai -> agent -> coding-agent -> mom -> web-ui -> pods` does not match actual package dependencies and build composition exactly; HugeCode should rely on actual package manifests and imports instead of narrative order
- any statement that `web-ui` shares the full `coding-agent` session, skills, and extension stack is incorrect for the current source tree
- the current document is source-backed for `runtime core`, `session tree`, `extension openness`, and `provider compatibility`, but it intentionally does not claim that `pi-mono` has already solved durable execution in the LangGraph sense

## Validation Scope

Docs-only, no runtime impact.

Commands used:

```bash
git -C /Users/han/Documents/Code/github/pi-mono rev-parse HEAD
git -C /Users/han/Documents/Code/github/pi-mono log -1 --date=short --pretty=format:'%H %cd %s'
find /Users/han/Documents/Code/github/pi-mono/packages -maxdepth 2 -type f \\( -name package.json -o -name README.md \\)
sed -n '1,260p' /Users/han/Documents/Code/github/pi-mono/packages/agent/src/agent-loop.ts
sed -n '1,320p' /Users/han/Documents/Code/github/pi-mono/packages/agent/src/agent.ts
sed -n '1,340p' /Users/han/Documents/Code/github/pi-mono/packages/agent/src/types.ts
sed -n '1,320p' /Users/han/Documents/Code/github/pi-mono/packages/coding-agent/src/core/agent-session.ts
sed -n '1,260p' /Users/han/Documents/Code/github/pi-mono/packages/coding-agent/src/core/session-manager.ts
sed -n '1,260p' /Users/han/Documents/Code/github/pi-mono/packages/coding-agent/examples/extensions/README.md
sed -n '1,260p' /Users/han/Documents/Code/github/pi-mono/packages/coding-agent/src/core/extensions/types.ts
sed -n '1,260p' /Users/han/Documents/Code/github/pi-mono/packages/ai/README.md
rg -n "reasoning|contextWindow|maxTokens|supports|json|schema|tool|vision|compat|retry" /Users/han/Documents/Code/github/pi-mono/packages/ai/src /Users/han/Documents/Code/github/pi-mono/packages/coding-agent/src/core/model-*.ts
```
