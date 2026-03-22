# HugeCode Docs

This directory is organized around the active HugeCode product direction:

> runtime-first, supervised async engineering mission control

The goal of this index is to help humans and agents reach the right source quickly and avoid treating working notes or archive material as active authority.

## Fastest Correct Start

Use this path for repo-wide orientation:

1. [../README.md](../README.md)
2. [../AGENTS.md](../AGENTS.md)
3. [guide/agents.md](./guide/agents.md)
4. [development/README.md](./development/README.md)
5. [workspace-map.md](./workspace-map.md)

Then move into the core authority set:

1. [prd.md](./prd.md)
2. [specs/apps/code-product-shape-2026.md](./specs/apps/code-product-shape-2026.md)
3. [arch.md](./arch.md)
4. [agents-system-design.md](./agents-system-design.md)
5. [specs/code-runtime-spec-2026.md](./specs/code-runtime-spec-2026.md)
6. [testing.md](./testing.md)

## Choose By Task

- Repo-wide understanding or agent onboarding:
  [guide/agents.md](./guide/agents.md), [workspace-map.md](./workspace-map.md)
- Product direction and scope:
  [prd.md](./prd.md), [specs/apps/code-product-shape-2026.md](./specs/apps/code-product-shape-2026.md)
- Runtime behavior, contracts, and backend routing:
  [arch.md](./arch.md), [agents-system-design.md](./agents-system-design.md), [runtime/README.md](./runtime/README.md)
- Local setup, commands, and validation selection:
  [development/README.md](./development/README.md), [testing.md](./testing.md)
- Prompt-design workflow using ChatGPT web before Codex execution:
  [development/chatgpt-web-prompt-lab-workflow.md](./development/chatgpt-web-prompt-lab-workflow.md)
- Design-system work:
  [design-system/README.md](./design-system/README.md)
- Historical comparison or migration archaeology only:
  [archive/README.md](./archive/README.md)

## Authority Order

Use this order when two narrative docs overlap:

1. `docs/prd.md`
   Product direction, scope, and non-goals.
2. `docs/specs/apps/code-product-shape-2026.md`
   Stable product model, modes, and primary surfaces.
3. `docs/arch.md`
   Ownership boundaries, invariants, and layer responsibilities.
4. `docs/agents-system-design.md`
   Runtime-agent design rules for lifecycle, governance, and placement.
5. `docs/specs/code-runtime-spec-2026.md`
   Runtime contract, transport, and validation boundary.

If a lower document drifts from a higher one, update the lower document instead of creating a parallel interpretation.

## Canonical Mental Model

Use this compact product model by default:

- Primary objects: `Workspace`, `Task`, `Run`, `Execution Profile`, `Review Pack`
- Supporting operational objects: `Backend Profile`, `Ledger`
- Modes: `Ask`, `Pair`, `Delegate`, `Review`
- Core loop: `Define -> Delegate -> Observe -> Review -> Decide`

Interpretation rules:

- `Backend Profile` supports placement and routing. It is not a separate product center.
- `Ledger` supports reviewability and audit. It is not a separate destination from the `Review Pack`.
- `AutoDrive` is the bounded autonomy layer inside the product, not a separate product.
- Runtime and contract docs should map their narrower terms back to this model instead of inventing parallel taxonomies.

## Directory Guide

- [`guide/`](./guide/)
  Short orientation docs for agents and repo operators.
- [`specs/`](./specs/)
  Active product, runtime, and agentic specifications.
- [`runtime/`](./runtime/)
  Runtime transport, contract, compatibility, and service-governance docs.
- [`design-system/`](./design-system/)
  Active design-system usage and implementation guidance.
- [`development/`](./development/)
  Local setup, core commands, and validation entrypoints.
- [`plans/`](./plans/)
  Active in-flight working docs only.
- [`archive/`](./archive/)
  Completed, superseded, or historical documents retained for reference only.

## Documentation Rules

- Active guidance lives in the root docs listed above plus `docs/specs/`, `docs/runtime/`, and `docs/design-system/`.
- `docs/plans/` is temporary working space. When a plan is closed, superseded, or no longer guiding active implementation, move it to `docs/archive/plans/`.
- Historical research, one-off proposals, audit snapshots, and completed execution plans belong in `docs/archive/`.
- Runtime contract truth comes from tracked contract packages and frozen specs, not older narrative docs.
- Retired product-branded or placeholder surfaces must stay out of active documentation unless explicitly restored by a new ADR.
