# HugeCode Workspace Map

This document defines the intended directory roles for the HugeCode monorepo.

## Active Application Surfaces

| Path           | Role                                | Stack                   | Status |
| -------------- | ----------------------------------- | ----------------------- | ------ |
| `apps/code-t3` | Primary t3-derived coding workspace | React 19 + Vite + t3 UI | Active |

Interpret this carefully:

- `apps/code-t3` is the only active app workspace under `apps/`.
- `apps/code`, `apps/code-web`, and `apps/code-electron` have been removed from
  the active workspace and must stay absent unless a new ADR explicitly restores
  them with a tracked manifest and documented ownership.
- `packages/code-workspace-client` remains a supporting shared workspace-client
  layer for runtime-backed shell code.
- `packages/code-application` is the shared application-layer package for
  orchestration, shared workspace host rendering, host binding composition,
  and host-agnostic desktop/web use cases. Keep it free of direct Electron bridge
  implementation imports.
- `packages/code-platform-interfaces` is the shared capability-contract layer
  for desktop and web host adapters. Keep it free of concrete Electron runtime
  imports and legacy shell compatibility details.
- Agent/product extension work is `skills`-first.
- Do not restore an `apps/connectors` product surface under `apps/code-t3`; that
  direction is retired even though lower-level compatibility types may still
  exist.
- Do not rebuild a local project-management shell inside `apps/code-t3` around the
  Agent Command Center. The active surface there is intent capture,
  runtime-backed orchestration, and WebMCP control, not a local execution
  board or governance dashboard.

## Core Package Layers

| Layer                  | Representative paths                                                           | Responsibility                                                             |
| ---------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Runtime protocol       | `packages/code-runtime-host-contract`, `packages/native-runtime-host-contract` | Shared runtime transport types, method sets, spec generation               |
| Runtime implementation | `packages/code-runtime-service-rs`                                             | Rust Axum service, orchestration, event stream, health/readiness           |
| Application layer      | `packages/code-application`                                                    | Shared orchestration, workspace host rendering, facades, and host bindings |
| Shared workspace app   | `packages/code-workspace-client`                                               | Shared workspace boot, bindings contract, and shell adapters               |
| Platform contracts     | `packages/code-platform-interfaces`                                            | Shared capability types and host bridge contracts                          |
| Shared UI foundation   | `packages/design-system`                                                       | Tokens and active code-workspace UI foundations                            |
| Shared utilities       | `packages/shared`                                                              | Reusable utilities and UI helpers shared across active packages            |
| Native accelerators    | `packages/*-rs`                                                                | Accelerators, runtime support, and text processing                         |

## Core Product vs Supporting Packages

Treat these as the product-defining core:

- `apps/code-t3`
- `packages/code-runtime-service-rs`
- `packages/code-runtime-host-contract`
- `packages/native-runtime-host-contract`

Treat these as supporting layers for the core product, not separate app narratives:

- `packages/code-workspace-client`
- `packages/code-application`
- `packages/code-platform-interfaces`
- `packages/design-system`
- `packages/shared`
- `packages/native-bindings`

## Runtime Boundary Inside `apps/code-t3`

Treat the `apps/code-t3` runtime boundary as a layered API, not a grab-bag of direct service imports:

- `src/runtime/*`
  Active t3 app-facing runtime API and bridge code.

Inside this boundary, keep runtime capability composition explicit:

- t3 UI state and labels remain in `src/components/*`
- runtime transport, launch, profile, and purchase-assistant adapters remain in `src/runtime/*`
- shared runtime contracts continue to flow through `packages/code-runtime-host-contract`

Feature code must not infer these layers from transport-local live lists, host-specific publication state, or page-local settings merges.

Feature and UI code should use the t3 runtime wrapper surface instead of rebuilding runtime transport behavior in components.

## Style-System Governance

The repo intentionally standardizes on one styling stack:

1. `apps/code-t3` may use its t3-derived CSS and styling stack.
2. Shared packages continue to use `vanilla-extract` and semantic tokens from `packages/design-system`.
3. No inline styles.
4. No new utility CSS or repo-owned plain `.css` outside the explicit t3 app and vendor allowlists.

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
Start app work from `apps/code-t3`.

## Navigation Rules

- Use [`README.md`](../README.md) for the repo overview.
- Use [`docs/development/README.md`](./development/README.md) for commands and environment setup.
- Use [`docs/runtime/README.md`](./runtime/README.md) for runtime protocol and contract docs.
- Use [`AGENTS.md`](../AGENTS.md) for automated-agent rules.
