# HugeCode - AGENTS.md

> Machine-readable project guide for AI coding agents.
> Official product context: **HugeCode**.
> Legacy docs may reference **Keep-Up** or **Reader**. Default active app context: `apps/code`.
> A retired product-branded alias has been fully removed from tracked repo paths and file content. Do not reintroduce deleted placeholder surfaces, product-branded policy package names, or pre-`project-context:*` generator sentinels.

## Agent Entry Points

- `AGENTS.md` is the canonical shared instruction file for repo-root coding work.
- `CLAUDE.md` is a Claude Code compatibility entrypoint and should stay aligned with this file instead of becoming a second source of truth.
- `GEMINI.md` is a Gemini CLI compatibility entrypoint and should stay aligned with this file instead of becoming a second source of truth.
- If agent-facing docs ever disagree, follow `AGENTS.md`, then tracked manifests/scripts, then current source.
- For repo-wide work, start discovery from `README.md`, `AGENTS.md`, `docs/README.md`, `docs/guide/agents.md`, `docs/development/README.md`, and `docs/workspace-map.md` before opening deeper or archived docs.

## GitHub PR Language

- When using `gh` to inspect, review, comment on, update, or otherwise handle pull requests and related GitHub Actions state, agents must use English in all agent-authored PR-facing output.
- This includes review bodies, issue or PR comments, merge or triage notes, and workflow-status summaries posted or drafted for GitHub surfaces.

## Engineering Quality Bar

Apply this quality bar to every task, not only large features:

- Make it correct: solve the actual user or product problem completely, and preserve existing contracts unless the task explicitly changes them.
- Make it reliable: prefer deterministic behavior, handle edge cases and failure paths, and avoid fragile fixes that only work in the happy path.
- Make it elegant: choose the simplest design that fits the architecture, remove accidental complexity, and avoid patching over structural issues with ad hoc exceptions.
- Make it maintainable: keep boundaries explicit, names precise, and touched code easier to understand and change than before.
- Do not leave avoidable technical debt: do not ship known workaround-on-workaround fixes, unnecessary duplication, dead branches, placeholder abstractions, or silent regressions as the default tradeoff.

### Done Means More Than "It Works Once"

A task is not done until the agent has, within the task scope:

- verified the behavior under normal and relevant edge conditions
- updated tests, types, docs, and contracts when the change requires it
- removed or isolated temporary code paths instead of normalizing them into permanent debt
- recorded any unavoidable compromise explicitly in the delivery notes, including why it remains and what follow-up is needed

## Project Overview

| Item      | Detail                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| Stack     | TypeScript, React 19, pnpm 10 monorepo, Turbo, Vite, Rust (native accelerators)                                |
| Namespace | `@ku0/*` (TS) and `ku0-*` (Rust crates)                                                                        |
| Core App  | `apps/code` (UI) + `apps/code-electron` (Electron desktop shell) + `apps/code-web` (Cloudflare web shell)      |
| CRDT      | Loro only; never add Yjs                                                                                       |
| Styling   | `vanilla-extract` (`.css.ts`) + CSS custom properties across active UI surfaces; no Tailwind, no inline styles |
| Linter    | Oxlint (TS/JS/JSX) and Clippy (Rust)                                                                           |
| Formatter | `pnpm format` (Oxfmt) and `cargo fmt` (Rust)                                                                   |

## Architecture

- The local Agent Command Center in `apps/code` is intentionally slim. Treat it
  as intent capture, runtime orchestration, and WebMCP control only; do not
  rebuild a local task board, governance dashboard, or audit-log workflow there.

```text
apps/
  code/                       # Core coding app (Vite + React 19)
  code-electron/              # Electron desktop shell around apps/code

packages/
  code-application/          # Shared application orchestration, workspace host rendering, and host-agnostic use-case logic
  code-workspace-client/      # Shared workspace boot/bindings layer for web + desktop shells
  code-platform-interfaces/   # Shared platform capability types and host bridge contracts
  code-runtime-service-rs/    # Rust-first coding runtime service
  code-runtime-host-contract/ # RPC contract between UI and runtime
  native-runtime-host-contract/ # Native host alias contract
  design-system/              # Shared tokens and UI foundations
  ui/                         # Shared UI primitives and compositions
  shared/                     # Shared utilities and UI helpers
  runtime-policy-rs/          # Runtime policy engine support

docs/                         # Product specs and engineering docs
.agent/                       # Agent specs, quality gates, workflows
```

### Runtime Boundary Rules

- `apps/code/src/application/runtime/*` is the only approved frontend boundary for runtime and remote execution behavior.
- UI components and feature hooks must not orchestrate multiple runtime, desktop-host, or transport ports directly.
- `ports/*` exist only for host, IPC, or transport adaptation. They must not become page-shaped service layers.
- New remote execution or server features must enter through a domain facade or application service first.
- `launch readiness` is an advisory preflight summary over existing runtime truth.
  It may combine transport health, route viability, approval pressure, and execution reliability
  from existing diagnostics surfaces such as `runtimeToolMetricsRead` and
  `runtimeToolGuardrailRead`, but it is not a new canonical runtime state.
  Keep it inside app runtime facades and do not let pages invent their own route,
  approval, or health heuristics.
- `continuity readiness` is the separate runtime-backed summary for checkpoint
  recovery, control-device handoff, and review continuation after launch.
  It should consume runtime-published `checkpoint`, `missionLinkage`,
  `publishHandoff`, and `reviewActionability` directly rather than rebuilding
  recovery or handoff paths in page-local logic.

### Multi-Remote Backend Rules

- Treat the client as capable of connecting to multiple remote backends at once.
- Remote backend configuration belongs to application/runtime profile and execution facades, not page-local state machines.
- Task start flows must support an explicit backend preference and a shared default-backend fallback path.
- If no backend is specified by the caller, resolve the default backend through application/runtime logic, never inside a UI component.
- Once resolved, backend preference must flow through the host-native task-start contract (`preferredBackendIds`), not through implicit UI-side state.
- Do not introduce new wide aggregation ports like `tauriSettings` or `tauriWorkspaces` for fresh feature work.
- Legacy wide ports may remain as compatibility layers, but new code should use narrower domain ports and facades.
- App settings persistence is still a legacy desktop adapter until a dedicated `code_app_settings_*` contract exists; keep that legacy boundary explicit in ports and comments.
- `pnpm check:ui-service-boundary` is the enforcement gate for UI/runtime import boundaries; new UI code must pass it without adding new legacy exceptions.

### Key Documents (Read Before Editing)

- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - Full lint rules and Rust guidelines
- [CLAUDE.md](./CLAUDE.md) - Claude Code compatibility entrypoint
- [GEMINI.md](./GEMINI.md) - Gemini CLI compatibility entrypoint
- [docs/README.md](./docs/README.md) - Active docs index and authority map
- [docs/guide/agents.md](./docs/guide/agents.md) - Concise repo-orientation guide for agents
- [docs/development/README.md](./docs/development/README.md) - Canonical local development entrypoints
- [docs/workspace-map.md](./docs/workspace-map.md) - Monorepo directory roles and active surfaces
- [.agent/agent-specs.md](./.agent/agent-specs.md) - Detailed agent behavior spec
- [.agent/quality-gates.md](./.agent/quality-gates.md) - Quality gate definitions
- [.agent/design-standards.md](./.agent/design-standards.md) - UI/UX design standards
- [.agent/workflows/](./.agent/workflows/) - Reusable workflow templates

### Non-Normative Inputs

- Treat `docs/archive/**` as historical context only. Do not use archived docs to justify new architecture, naming, or package restoration unless the task explicitly asks for historical comparison or migration work.
- Treat `apps/code-web` as the Cloudflare-platform web implementation for
  public routes, SSR, and deploy wiring.
- Treat `packages/code-workspace-client` as the canonical shared workspace
  client layer for web and desktop shells.
- Treat `apps/code` as the desktop host and runtime bootstrap around that
  shared client; do not assume `apps/code` fully replaces `apps/code-web` for
  web publishing.
- If a task asks about consolidating `apps/code` and `apps/code-web`, prefer a
  design that extracts a shared workspace client layer rather than folding
  Cloudflare Start concerns directly into the Tauri-facing app.
- Treat `docs/specs/agentic/*` as frozen support contracts, not the main product definition, unless the task explicitly targets those contracts.

## Setup And Build Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm preflight:codex
```

Workflow-facing docs, CI, and automation must use canonical entrypoints: `repo:*`, `desktop:*`, `validate:*`, `preflight:codex`, and `ui:contract`.
Use `runtime-policy` for policy-domain package/module examples and `project-context:*` for generated AGENTS section markers.

## Validation Gates

Choose the gate matching your change risk. Prefer the narrowest scope that covers your change.

Use the current `validate:*` scripts directly. Legacy `validate:*:no-lfcc` aliases have been removed and should not appear in new docs, plans, or automation.

| Risk     | When to use                               | Command              |
| -------- | ----------------------------------------- | -------------------- |
| Fast     | Isolated files, no contract changes       | `pnpm validate:fast` |
| Standard | Multi-file/package, behavior/UI change    | `pnpm validate`      |
| Full     | Shared contracts, CI/config, release risk | `pnpm validate:full` |

### Validation Matrix

| Change surface           | Required checks                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| UI components/styles     | `validate:fast` + `test:component` when browser interaction risk matters + relevant `test:e2e:*`         |
| API/server behavior      | `validate`                                                                                               |
| Shared package contracts | `validate`                                                                                               |
| Tauri/Rust integration   | `validate` + `desktop:verify:fast` (add `desktop:verify` when packaging/full desktop build risk applies) |
| Repo config/CI/workflows | `validate:full`                                                                                          |
| Docs only                | Skip validation; state "docs-only, no runtime impact"                                                    |

### E2E Tests (Targeted - Never Full Suite)

```bash
pnpm test:e2e:core
pnpm test:e2e:blocks
pnpm test:e2e:collab
pnpm test:e2e:annotations
pnpm test:e2e:features
pnpm test:e2e:smoke
pnpm test:e2e:a11y
```

E2E auto-selection rules: `.codex/e2e-map.json`

### Frontend Testing Split

- Use `js_repl + Playwright` for local exploratory browser validation.
- Use `pnpm test:component` for browser-backed component and interaction regressions.
- Use targeted `pnpm test:e2e:*` runs for formal end-to-end coverage.

## Coding Standards

Use [CODING_STANDARDS.md](./CODING_STANDARDS.md) as the source of truth for language, accessibility, styling, runtime-boundary, validation, and Rust rules.

Non-negotiable reminders:

- Do not use `any`, `var`, array-index React keys, clickable non-semantic elements, Tailwind, or inline styles on repo-owned UI surfaces.
- Keep `apps/code` runtime access behind approved application/runtime boundaries and run the matching contract or boundary checks when those surfaces change.
- Do not grow oversized legacy files when touching them.

## Execution Protocol

### Intake Triage (Before Any Edit)

1. Restate user outcome in one sentence
2. Classify: `feature` | `bug` | `review` | `security` | `infra` | `docs` | `release`
3. Assess risk: `low` | `medium` | `high`
4. Select validation gate and skills before coding
5. Ask one focused question only if ambiguity blocks safe execution

### Default Loop

```text
Triage -> Implement -> Validate -> Deliver
```

## Delivery Contract

Every completion message includes:

1. What changed and why
2. Validation commands run and outcomes
3. Risks, skipped checks, or residual uncertainty

## Artifact Notes

`task.md`, `implementation_plan.md`, and `walkthrough.md` are local working artifacts.
They may be stale; code is source of truth. Do not block delivery for artifact perfection.

`docs/plans/` is active working space only. Closed or superseded plans belong under `docs/archive/plans/` and should not be treated as active implementation authority.
