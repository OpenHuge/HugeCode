# Code Product Shape Specification v2026.1

**Status**: Active  
**Date**: 2026-03-23

## 1. Purpose

This specification defines the active HugeCode product shape for the coding workspace.
It describes the user-facing model, the primary surfaces, the core operating modes, and the product objects that should stay stable as implementation details evolve.

Use this document together with:

- [`docs/prd.md`](../../prd.md) for product direction and non-goals
- [`docs/arch.md`](../../arch.md) for architectural invariants and ownership boundaries
- [`docs/specs/code-runtime-spec-2026.md`](../code-runtime-spec-2026.md) for runtime contracts and transport expectations

## 2. Product Center

HugeCode is a runtime-first mission control for coding agents.
Its core loop is:

`Define -> Delegate -> Observe -> Review -> Decide`

The product should help a developer or lead hand off real engineering work, keep execution governable, and approve outcomes from a compact evidence-backed review surface.

HugeCode is not:

- a generic chat-first AI workspace
- a tracker-only issue bot
- a thin issue-to-PR relay without durable runtime truth
- a restoration of legacy Keep-Up or Reader product surfaces

## 3. Primary Surfaces

The active product surfaces are:

- `apps/code`
  Main coding workspace and desktop-facing control-plane UI
- `apps/code-web`
  Web-facing publishing, SSR, and Cloudflare-platform shell
- `apps/code-tauri`
  Desktop container and host bridge for the coding workspace

These surfaces form one product. They should not drift into separate app identities.

## 4. Primary Product Objects

The default HugeCode mental model is:

- `Workspace`
  Repository-bound context, instructions, integrations, defaults, and validation policy
- `Task`
  Canonical delegated engineering objective
- `Run`
  Durable execution lifecycle for a task
- `Execution Profile`
  Backend, identity, tool, file-system, and timeout policy for a run
- `Review Pack`
  Default trust artifact used to review and decide on delegated work

Supporting operational objects:

- `Backend Profile`
  Placement and routing context for execution backends
- `Ledger`
  Structured execution and evidence history attached to reviewability
- `Launch Readiness`
  Advisory preflight summary over runtime truth before launch
- `Continuity Readiness`
  Runtime-backed recovery and handoff summary after launch
- `Takeover Bundle`
  Canonical per-run continuation object for approval, resume, and handoff

## 5. Operating Modes

The active top-level modes are:

- `Ask`
  Quick question, explanation, or lightweight help
- `Pair`
  Interactive collaborative execution with tighter operator involvement
- `Delegate`
  Governed async execution with runtime-backed ownership and monitoring
- `Review`
  Evidence-first decision making over completed or interrupted work

Mode boundaries should stay product-level and user-comprehensible. Do not replace them with backend-specific or page-local taxonomies.

## 6. Product Invariants

The following rules define the stable product shape:

1. The runtime owns execution truth for task, run, approval, checkpoint, and placement state.
2. The UI is the control plane and review surface, not a second orchestration engine.
3. `Review Pack` plus `Ledger` is the trust artifact, not chat transcript length.
4. Backend choice must be explicit, inspectable, and routed through runtime contracts.
5. `AutoDrive` is a bounded autonomy subsystem inside HugeCode, not a separate product.
6. `skills` are the extension model; retired `/apps` or connector-style product surfaces must not return as the default interpretation.

## 7. Implementation Mapping

When code or docs introduce a new concept, map it back to one of these product objects before expanding the taxonomy.
If a proposed feature does not strengthen delegated execution, review speed, supervision compression, or governance clarity, it is probably not central to the active HugeCode product shape.
