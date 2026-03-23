# HugeCode

HugeCode is a runtime-first mission control for coding agents with **AutoDrive** and **multi-remote server control** as core product capabilities.

The product helps engineers move from the current repo state to a desired engineering outcome through supervised autonomous execution. Users define the destination, guardrails, and budget; AutoDrive plans a route, executes waypoints, reroutes when needed, and stops safely with a reviewable evidence trail. The client can also manage multiple remote execution servers and route each run through an explicit backend preference or a shared default backend. The active product surface is the coding workspace built around `apps/code`, `apps/code-tauri`, and the shared Rust runtime.

Official product context is **HugeCode**. Older documents may still mention **Keep-Up** or **Reader**; treat those names as historical unless a file is explicitly archived.

## Product Shape

The current product model is intentionally compact:

- Primary objects: `Workspace`, `Task`, `Run`, `Execution Profile`, `Review Pack`
- Supporting operational objects: `Backend Profile`, `Ledger`
- Modes: `Ask`, `Pair`, `Delegate`, `Review`
- Main surfaces: `Home`, `Workspaces`, `Missions`, `Review`, `Settings`
- Core runtime capabilities:
  - `AutoDrive` for navigation-style autonomous execution from start state to destination
- `Multi-Remote Server Control` for routing work across local and remote execution backends
- `Multi-Agent Execution` for supervised sub-agent and parallel-agent delegation
- `Launch Readiness` for compact operator preflight over runtime health, route viability, approval pressure, and execution reliability before a run starts
- `Continuity Readiness` for compact runtime-backed recovery and handoff guidance after a run already exists
- `Skills-First Extension` instead of productized apps/connectors surfaces

Use the primary objects as the default product mental model. Treat `Backend Profile` as supporting runtime placement and `Ledger` as supporting reviewability rather than as separate user-facing product centers.

AutoDrive is not a background prompt loop. It is the supervised execution layer that turns a task into:

- a structured destination with done criteria and forbidden routes
- a start-state snapshot of repo, budget, and risk
- a route with waypoints, progress, and reroute triggers
- hard stop controls for tokens, duration, iterations, confidence, and safety
- a ledger and review pack that explain what happened

Multi-remote server control is not a generic fleet console. It is the runtime control layer that lets one HugeCode client:

- manage multiple remote backend profiles with health, auth, and capability metadata
- set workspace defaults and per-run backend preferences
- keep backend routing inside application/runtime facades rather than UI components
- record which backend ran a route and why that backend was chosen

Launch readiness is not a second placement engine. It is a small operator-facing summary over existing runtime truth that helps answer:

- can this control surface talk to the runtime now
- is the selected route viable now
- is there approval or degraded-state pressure that should be resolved before launch
- is the runtime tool execution channel healthy enough to launch more work now

The current shipped surface is the Mission Control launch area inside `apps/code`.
Execution reliability in this context is still launch-scoped advisory truth derived from existing
runtime diagnostics such as `runtimeToolMetricsRead` and `runtimeToolGuardrailRead`.
The current shipped gate is moderately conservative: unavailable diagnostics channels, open runtime
tool circuit breakers, or a success gate falling below `0.95` block new launches; degraded
channels and recoverable failure pressure stay at attention.
This release does not add a separate runtime contract or a parallel diagnostics product surface.

Continuity readiness is the separate post-launch operator summary. It helps answer:

- can this interrupted or recovered run continue from canonical runtime truth
- does runtime already publish a safe handoff path to another control device
- is Review Pack follow-up still actionable according to runtime
- has checkpoint durability degraded enough that the operator should stop and inspect continuity truth

Continuity readiness must consume runtime-published `checkpoint`, `missionLinkage`,
`publishHandoff`, and `reviewActionability` directly.
It should not be folded back into launch readiness or rebuilt from page-local state.

The product is not positioned as a generic AI workspace, plugin bazaar, or multi-product automation platform. The goal is not maximum open-ended autonomy; the goal is trustworthy supervised autonomy for real engineering work.

Interpret the extension boundary carefully:

- `multi-agent`, `sub-agent`, and `parallel-agent` execution remain core product capabilities
- `skills` are the active extension model for reusable operator and agent behavior
- the local Agent Command Center no longer owns a project-task board, governance
  automation panel, or audit-log workflow; `apps/code` now keeps that surface to
  intent capture, launch readiness, runtime orchestration, and WebMCP controls
- ChatGPT apps/connectors and the `/apps` user surface are no longer part of the active product surface
- low-level runtime apps discovery tools and compatibility RPCs have been removed from the app layer
- do not reintroduce an apps/connectors product narrative when reading older docs or compatibility code

The canonical product-definition sources are:

- [PRD](./docs/prd.md)
- [Code Product Shape Specification](./docs/specs/apps/code-product-shape-2026.md)
- [Code Runtime Specification](./docs/specs/code-runtime-spec-2026.md)
- [Docs Index](./docs/README.md)

## Repository Layout

The active engineering center of this repo is:

- `apps/code`: primary React 19 + Vite coding workspace UI
- `apps/code-web`: Cloudflare platform web implementation for public routes, SSR, and deploy wiring
- `apps/code-tauri`: desktop container and host bridge
- `packages/code-workspace-client`: shared workspace client boot and compatibility adapters for web and desktop shells
- `packages/code-runtime-service-rs`: Rust-first runtime orchestrator
- `packages/code-runtime-host-contract`: canonical TypeScript runtime contract
- `packages/native-runtime-host-contract`: native host contract parity layer

Packages such as `packages/design-system`, `packages/shared`, and `packages/native-bindings` support the active product surface. They are supporting layers, not separate products.

Internal helper crates such as `internal/runtime-policy-rs` remain in-repo for parity fixtures and tooling, but do not define the active product surface.

## Web Platform

- `apps/code-web`: current Cloudflare platform web implementation. It owns the web route shell, public routes, SSR, and Wrangler deployment wiring, while reusing `packages/code-workspace-client` for the client-only workspace shell.
- Root build/lint/typecheck quality gates now include `apps/code-web`; use `pnpm web:*` for explicit Cloudflare web runs.

## Toolchain

- **Node**: `24.11.1`
- **pnpm**: `10.28.0`
- **Rust**: `1.93.1`

Windows Rust builds use MSVC and require Visual Studio C++ tools plus a Windows SDK. If builds fail with `kernel32.lib` or related linker errors, install component `Microsoft.VisualStudio.Component.Windows11SDK.22621`.

## Getting Started

```bash
pnpm install
pnpm dev
```

Useful entrypoints:

- `pnpm dev`: default code workspace and runtime flow
- `pnpm dev:code:ui`: Vite UI only
- `pnpm dev:code:service`: runtime service only
- `pnpm desktop:prepare:fast && pnpm dev:desktop`: Tauri desktop flow

## Validation

Use the narrowest gate that matches the blast radius:

- `pnpm validate:fast`: isolated UI or TypeScript changes
- `pnpm validate`: standard multi-file behavior changes
- `pnpm validate:full`: shared contracts, CI, or release-sensitive changes
- `pnpm test:component`: browser-backed component and interaction checks for `apps/code`
- `pnpm check:runtime-contract`: runtime contract freeze and source-of-truth checks
- `pnpm ui:contract`: UI/runtime boundary checks for `apps/code`
- `pnpm preflight:codex`: canonical repo preflight

Docs, CI, and automation should prefer the canonical command families `repo:*`, `desktop:*`, `validate:*`, `preflight:codex`, and `ui:contract`.

## Documentation

If you need the fastest correct orientation:

1. [README.md](./README.md)
2. [AGENTS.md](./AGENTS.md)
3. [Docs Index](./docs/README.md)
4. [Agent Guide](./docs/guide/agents.md)
5. [Development Guide](./docs/development/README.md)
6. [Workspace Map](./docs/workspace-map.md)

Then branch into the active authority docs that match the task:

- Product direction: [PRD](./docs/prd.md)
- Architecture and boundaries: [Architecture Overview](./docs/arch.md)
- Runtime design rules: [Runtime Agent System Design](./docs/agents-system-design.md)
- Runtime docs and frozen specs: [Runtime Docs](./docs/runtime/README.md)
- Product/app specs: [App Specs](./docs/specs/apps/README.md)
- Testing and validation selection: [Testing Guide](./docs/testing.md)

Contributor-facing entrypoints:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [AGENTS.md](./AGENTS.md)
- [CLAUDE.md](./CLAUDE.md)
- [GEMINI.md](./GEMINI.md)

Agent entrypoint policy:

- `AGENTS.md` is the canonical repo-wide instruction file.
- `CLAUDE.md` and `GEMINI.md` are compatibility entrypoints and should stay aligned with `AGENTS.md`.
- [`docs/guide/agents.md`](./docs/guide/agents.md) is the concise repo-orientation guide for agents after loading the root entrypoints.
- `docs/plans/` is for active in-flight working docs only.
- `docs/archive/` contains completed, superseded, or historical material and should not drive new implementation unless a task explicitly asks for historical comparison or migration work.

For historical context, prefer archived docs instead of restoring retired product surfaces into active documentation.
