# HugeCode Workspace Map

This document defines the intended directory roles for the HugeCode monorepo.

## Active Application Surfaces

| Path                 | Role                        | Stack                             | Status       |
| -------------------- | --------------------------- | --------------------------------- | ------------ |
| `apps/code`          | Primary coding workspace UI | React 19 + Vite + vanilla-extract | Active       |
| `apps/code-web`      | Cloudflare platform web app | TanStack Start + React 19         | Active       |
| `apps/code-tauri`    | Desktop runtime container   | Tauri v2                          | Active       |
| `apps/code-electron` | Experimental desktop shell  | Electron 41 + preload bridge      | Experimental |

Interpret this carefully:

- `apps/code-web` is still the current Cloudflare-first web route/deployment
  shell in this repo.
- `packages/code-workspace-client` is the canonical shared workspace-client
  layer consumed by both the web and desktop shells.
- `apps/code` remains the desktop-first host shell and runtime bootstrap layer
  around that shared workspace client.
- `apps/code-electron` is an additive desktop shell around the same `apps/code`
  renderer. Do not fork product logic into Electron-only React surfaces.
- `apps/code-web` is active product infrastructure and now participates in the
  default root build/lint/typecheck quality gates.
- Do not start default product feature work from `apps/code-web`, but also do
  not assume `apps/code` fully replaces it for SSR, public routes, or Wrangler
  deployment work.
- If these surfaces are ever consolidated, prefer extracting a shared workspace
  client layer rather than folding Cloudflare Start concerns directly into the
  Tauri-facing app.
- Agent/product extension work is `skills`-first.
- Do not restore an `apps/connectors` product surface under `apps/code`; that
  direction is retired even though lower-level compatibility types may still
  exist.
- Do not rebuild a local project-management shell inside `apps/code` around the
  Agent Command Center. The active surface there is intent capture,
  runtime-backed orchestration, and WebMCP control, not a local execution
  board or governance dashboard.

## Core Package Layers

| Layer                  | Representative paths                                                           | Responsibility                                                   |
| ---------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Runtime protocol       | `packages/code-runtime-host-contract`, `packages/native-runtime-host-contract` | Shared runtime transport types, method sets, spec generation     |
| Runtime implementation | `packages/code-runtime-service-rs`                                             | Rust Axum service, orchestration, event stream, health/readiness |
| Shared workspace app   | `packages/code-workspace-client`                                               | Shared workspace boot, bindings contract, and shell adapters     |
| Shared UI foundation   | `packages/design-system`                                                       | Tokens and active code-workspace UI foundations                  |
| Shared utilities       | `packages/shared`                                                              | Reusable utilities and UI helpers shared across active packages  |
| Native accelerators    | `packages/*-rs`                                                                | Accelerators, runtime support, and text processing               |

## Core Product vs Supporting Packages

Treat these as the product-defining core:

- `apps/code`
- `apps/code-tauri`
- `apps/code-electron`
- `packages/code-runtime-service-rs`
- `packages/code-runtime-host-contract`
- `packages/native-runtime-host-contract`

Treat these as supporting layers for the core product, not separate app narratives:

- `packages/code-workspace-client`
- `packages/design-system`
- `packages/shared`
- `packages/native-bindings`

## Runtime Boundary Inside `apps/code`

Treat the `apps/code` runtime boundary as a layered API, not a grab-bag of direct service imports:

- `src/application/runtime/*`
  Stable app-facing runtime API for feature and UI code.
- `src/application/runtime/ports/*`
  Narrow convenience imports used by current feature code and runtime port composition.
- `src/services/*`
  Internal transport, bridge, fallback, and protocol implementation details.

Feature and UI code should not import runtime internals from `src/services/*` directly. Use the application runtime surface instead.

## Style-System Governance

The repo intentionally standardizes on one styling stack:

1. `vanilla-extract` for repo-owned styles in active app and package surfaces.
2. Shared semantic tokens and theme vocabulary from `packages/design-system`.
3. No inline styles.
4. No new utility CSS or repo-owned plain `.css` outside the explicit vendor allowlist.

## Tests

| Path            | Role                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `tests/e2e`     | Targeted Playwright suites grouped by `core`, `blocks`, `collab`, `annotations`, `features`, `smoke`, `a11y` |
| `tests/scripts` | Test helpers and utilities                                                                                   |

## Legacy And Non-Workspace Directories

Directories without a tracked `package.json` are not workspace packages and should not be treated as active app/package entrypoints.

Removed historical placeholder app surfaces must stay absent unless a new ADR explicitly restores them with a tracked manifest and documented ownership.

Examples observed in the tracked repository shape:

- placeholder app directories such as `apps/web`, `apps/core`, and `apps/edge` must stay untracked unless an ADR explicitly restores them
- `packages/code-runtime-host`
- retired package families such as `packages/agent-*-rs` and `packages/lfcc-*`
- legacy runtime placeholder packages under `packages/`
- `packages/gateway*`
- `internal/runtime-policy-rs`

Use neutral technical names such as `runtime-policy` for internal modules rather than restoring retired product-branded package families.

Treat these as one of the following until promoted with a real manifest and documented ownership:

- archived historical residue
- local build output
- incubating module shell
- bundled asset directory

If you are starting new work, begin from an active app/package listed above instead.
Start Cloudflare route, SSR, or deployment work from `apps/code-web`.
Start shared workspace-client work from `apps/code`.

## Navigation Rules

- Use [`README.md`](../README.md) for the repo overview.
- Use [`docs/development/README.md`](./development/README.md) for commands and environment setup.
- Use [`docs/runtime/README.md`](./runtime/README.md) for runtime protocol and contract docs.
- Use [`AGENTS.md`](../AGENTS.md) for automated-agent rules.
