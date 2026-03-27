# Testing Guide

This document outlines the active testing strategy for the HugeCode coding-agent product. Legacy docs may still reference historical product names; treat those as archival context only.

## Testing System

Treat frontend testing as a promotion pipeline instead of a flat menu of tools:

1. Explore and reproduce in a live browser.
2. Lock the behavior into the narrowest stable automated layer.
3. Escalate to higher-cost layers only when the risk crosses real boundaries.

The goal is not "more tests". The goal is fast bug discovery, stable regressions, and clear ownership of what each layer proves.

## Testing Layers

Use three layers together instead of trying to force one tool to cover every frontend testing job.

### Exploratory Browser Validation

- Primary tool: `js_repl + Playwright`
- Secondary tool: Chrome DevTools MCP when you need to reuse the current Chrome session, login state, selected workspace, or DevTools context
- Default use: live page exploration, bug reproduction, DOM inspection, visual QA, and ad hoc flow checks while developing
- Canonical entrypoint: start the app with `pnpm dev` or the narrowest relevant `dev:*` command, then drive the page from `js_repl` with `await import("playwright")`

Use this layer when you want the fastest possible feedback while touching a page locally. It is the preferred default for interactive exploration, but it is not the formal regression layer.

Use Chrome DevTools MCP only for exploration and diagnosis:

- reuse an already-authenticated Chrome session
- inspect console, network, and DOM state without rebuilding a scripted test first
- confirm whether a bug is truly user-visible before deciding where to lock regression coverage

Do not treat Chrome DevTools MCP as the formal regression layer or CI path.

### Component Browser Tests

- Primary tool: Vitest Browser Mode with the Playwright provider
- Default command: `pnpm test:component`
- Watch mode: `pnpm test:component:watch`
- Active config: `apps/code/vitest.browser.config.ts`
- Test file pattern: `apps/code/src/**/*.browser.test.ts(x)`

Primary focus:

- interactive components that should run against a real browser event model
- browser-dependent hooks and behaviors
- focused UI regressions that are too small for full E2E but weaker in `jsdom`

This is the default regression home for most `apps/code` interaction bugs.

### Unit

- Primary tool: Vitest
- Default command: `pnpm test:unit`
- Root `test:unit` now runs root script tests first, then delegates package/app unit suites to Turbo so workspace `test` tasks can run and cache in parallel instead of serializing the whole monorepo through one root Vitest worker pool
- Use targeted `vitest run <path>` when a change is isolated to a specific package or service area

Primary focus:

- runtime-client behavior
- UI state and interaction logic
- contract adapters
- shared utilities and package-local behavior

### Contract And Cross-Runtime Parity

- `pnpm check:runtime-contract`
  Frozen spec and runtime source-of-truth guard.
- `pnpm check:runtime-contract:parity`
  Shared-contract parity across TS host contract, native alias contract, Rust runtime, Tauri payloads, and the web runtime client.

Use the parity gate when the change touches method names, payload fields, runtime events, frozen specs, or adapter compatibility.

### Integration

- Primary tool: Vitest integration files under `apps/code/src/services` and related feature areas
- Use focused `vitest run <path>` or `vitest related` for adapter orchestration and cross-module behavior

### Targeted E2E

- Primary tool: Playwright Test
- Default mode: targeted category runs, not the broad full suite

Available targeted categories:

- `pnpm test:e2e:core`
- `pnpm test:e2e:blocks`
- `pnpm test:e2e:collab`
- `pnpm test:e2e:annotations`
- `pnpm test:e2e:features`
- `pnpm test:e2e:smoke`
- `pnpm test:e2e:a11y`

Use `.codex/e2e-map.json` and `.agent/workflows/e2e-test.md` to choose the narrowest relevant category.

This is the formal automation layer for end-to-end regression, not the default place to validate every component interaction.

Reserve E2E for behavior that crosses at least one real system boundary:

- route or shell transitions
- workspace startup and restoration
- runtime transport wiring
- persistence and reload behavior
- startup or recovery flows
- multi-surface user journeys that a component harness cannot prove

Live runtime E2E is a narrower sub-class of targeted E2E:

- Treat `tests/e2e/src/code/live-*.spec.ts` as isolated harnesses, not general-suite coverage.
- They share one local runtime plus one upstream account/quota boundary, so the stable execution mode is `--workers=1`.
- When the runtime service is unavailable or the upstream provider reports a quota block such as `The usage limit has been reached`, these specs should skip explicitly instead of timing out and masquerading as product regressions.
- Do not use live runtime specs as fast-gate evidence for ordinary UI changes when a Browser or non-live E2E test can prove the behavior.

### Desktop Smoke

- `pnpm test:desktop:smoke`
  Narrow Rust desktop smoke coverage for `apps/code-tauri` backend tests, with runtime-service prewarm enabled by default.
- `pnpm desktop:verify:fast`
  Fast Tauri verification layer for CI and desktop-runtime-sensitive changes, with runtime-service prewarm enabled by default.
- `pnpm desktop:verify`
  Tauri debug build without bundling for local desktop integration verification.
- `.github/workflows/desktop.yml`
  PR and main desktop build matrix for compile-and-link coverage across supported targets.

### Release Verify

- `pnpm validate:release`
- `pnpm perf:gate`
- `core_release_gate` in CI for package pack validation

## Validation Ladder

Use the smallest gate that matches risk:

- `pnpm validate:fast`
  Small or isolated TS/UI changes.
- `pnpm validate`
  Default gate for multi-file behavior work. Repo-wide style language/source-of-truth checks stay
  change-aware here so accepted debt does not block normal iteration. Workflow-governance-only
  edits and self-covered validation guard scripts should also remain on this targeted path.
- `pnpm validate:full`
  Shared contracts, workflows, CI, or release-sensitive changes. This is where
  repo-wide style language/source-of-truth scanning should run.
- `pnpm check:runtime-contract`
  Contract freeze and runtime source-of-truth checks.
- `pnpm check:runtime-contract:parity`
  High-risk cross-language runtime contract compatibility checks.
- `pnpm ui:contract`
  UI/runtime boundary guard for `apps/code`.
- `pnpm test:desktop:smoke`
  Narrow desktop backend smoke for Tauri-local changes.
- `pnpm desktop:verify:fast`
  Faster desktop verification before escalating to a full Tauri debug build.
- `pnpm desktop:verify`
  Desktop/Tauri verification when desktop integration changes.

## Fast Gate Scheduling

`pnpm validate:fast` is optimized for local feedback first. It should stay narrow, deterministic, and explain why it widened when widening is unavoidable.

- `apps/code` related-tests use adaptive shard splitting before any package-wide fallback.
- A timed-out or hard-failed shard is retried in smaller stable halves until a single target remains.
- Package-wide fallback is reserved for single-target shards that still time out or fail.
- Fast gate logs must distinguish shard timeout, shard failure, shard retry, and final fallback. Ambiguous "timed out" output is not sufficient.

The active `apps/code` worker controls are:

- `VALIDATE_APPS_CODE_RELATED_MAX_WORKERS`
  Highest-priority override for all `apps/code` related-test shards.
- `VALIDATE_APPS_CODE_RELATED_BROWSER_MAX_WORKERS`
  Browser/component shard override when the related target set includes `.browser.test.*` coverage.
- `VALIDATE_APPS_CODE_RELATED_JSDOM_MAX_WORKERS`
  Default override for non-browser `apps/code` related-test shards.

Use the narrowest explicit override needed for the local machine or debugging session. Do not broaden to package-wide testing just to mask flaky shard scheduling.

## Layer Ownership Matrix

Use the matrix below to decide where a regression belongs by default.

| Risk surface                                   | First formal layer                       | Escalate when                                              | Typical examples                                                               |
| ---------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pure state / parsing / command routing         | Vitest `jsdom`                           | browser event semantics matter                             | slash command parsing, review target resolution, queueing rules                |
| Browser interaction inside one feature surface | Vitest Browser Mode                      | route, shell, runtime, or persistence boundary is involved | composer key handling, review prompt focus, resolver priority, draft retention |
| Cross-route or cross-workspace UI behavior     | Playwright E2E                           | desktop packaging or native host behavior matters          | home-to-workspace routing, workspace recovery, startup shell transitions       |
| Runtime transport / backend wiring             | Playwright E2E plus targeted integration | contract or cross-language payload risk exists             | turn/start, request-failed recovery, replay correctness                        |
| Desktop-only host behavior                     | targeted integration plus desktop verify | native packaging or OS behavior matters                    | Tauri review start, IPC payloads, desktop smoke                                |

## Promotion Rules

When a bug is discovered through live testing, promote it into the narrowest durable regression:

1. If the bug is visible within one mounted page or component tree, add a `.browser.test.tsx` first.
2. If the bug depends on runtime transport, route transitions, reload, persistence, or shell startup, add targeted E2E.
3. If the bug is actually a state machine defect that only happened to be discovered in the browser, add or extend a focused Vitest unit/integration test as the base layer.
4. When a higher-layer test is required, still add the lower-layer regression if it isolates the real logic fault cheaply.

Bug discovery tools are not exempt from promotion:

- `js_repl + Playwright` findings should become Browser or E2E tests.
- Chrome DevTools MCP findings should become Browser or E2E tests.
- Manual reproduction notes alone are not considered durable coverage.

For fast gate hygiene, prefer promotion in this order:

1. focused Vitest unit/integration
2. Vitest Browser Mode
3. targeted Playwright E2E

Do not skip directly to E2E when the behavior can be proven at a lower layer.

## What Good Coverage Looks Like

Prefer tests that prove the real risk introduced by the change:

- boundary inputs and malformed payloads
- transport fallback and runtime-unavailable paths
- contract compatibility and frozen-spec enforcement
- accessibility behavior for interactive UI
- regression coverage for changed selectors, reducers, or adapters
- browser-real component behavior when `jsdom` fidelity is not enough
- user-visible failure handling, especially when runtime, auth, or host capability checks block an action

Do not default to broad suites when a narrower targeted check proves the change.

## Choosing The Layer

Use the narrowest tool that matches the risk:

- Reach for `js_repl + Playwright` when you need to explore, inspect, or manually verify a page in-flight.
- Reach for Chrome DevTools MCP when you need to continue from the exact Chrome session already holding the right login state, workspace, or DevTools context.
- Reach for `pnpm test:component` when the risk is centered in a component, interaction primitive, or browser API behavior.
- Reach for `pnpm test:e2e:*` when the risk crosses routes, shells, startup flow, backend wiring, or user-critical end-to-end behavior.

## Current High-Value Coverage Areas

The current product shape means these surfaces should receive regression coverage first:

- `Home` composer routing and workspace-selection behavior
- thread composer send, queue, and blocked-send behavior
- `/review` command parsing, gating, prompt opening, and detached review flows
- request-failed recovery and runtime replay behavior
- workspace restore, pending submit restore, and draft persistence
- resolver priority interactions: pending input, approval, tool call, and plan follow-up

Recommended default split for these areas:

| Surface                                            | Default regression layer | Higher layer when needed                                    |
| -------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| Composer key handling and prompt lifecycle         | `test:component`         | E2E if route or runtime state is required                   |
| Slash commands and queue behavior                  | Vitest                   | Browser when key handling or focus matters                  |
| Home/workspace routing and default-target behavior | `test:component`         | E2E when full shell startup or persistence is involved      |
| Runtime request/recovery chains                    | targeted integration     | E2E for full transport proof                                |
| Detached review restore and parent-child linkage   | integration              | E2E when the full shell and persistence path must be proven |

## Anti-Patterns

Avoid these patterns because they create expensive or brittle suites:

- using E2E to cover every component interaction
- relying on manual Chrome MCP or DevTools steps as the only proof of a fix
- asserting private DOM structure or implementation details when accessible roles or text would prove the behavior
- adding timeout-based waits when web-first assertions or state-driven synchronization are available
- running quota-sensitive live runtime specs under multi-worker concurrency and treating upstream throttling as app failures
- broadening validation gates when a focused suite already proves the change
- fixing a bug found in exploration without adding durable automated coverage

## Local Test Prerequisites

- Runtime-facing `apps/code` tests commonly expect the code runtime service at `127.0.0.1:8788`.
- `pnpm dev` is the canonical local entrypoint when the UI and runtime need to run together.
- Desktop verification requires the Tauri toolchain plus the platform-native prerequisites documented in `docs/development/README.md`.

## Recommended Commands

```bash
# Fastest local exploration
pnpm dev
# then use js_repl + await import("playwright")

# Reuse an already-open Chrome session for diagnosis
# via Chrome DevTools MCP

# Component/browser-focused regression
pnpm test:component
pnpm test:component:watch

# Default unit/integration gate
pnpm test:unit

# Focused runtime boundary checks
pnpm ui:contract
pnpm check:runtime-contract
pnpm check:runtime-contract:parity

# Desktop smoke and fast verify
pnpm test:desktop:smoke
pnpm desktop:verify:fast

# Targeted E2E example
pnpm test:e2e:smoke

# Risk-based validation gates
pnpm validate:fast
pnpm validate
pnpm validate:full
```

## Notes

- Docs-only changes can usually skip runtime validation; state that the change is docs-only with no runtime impact.
- Historical testing narratives in archived docs should not override the active validation commands in `package.json`.
- `js_repl + Playwright` is the preferred local exploration path, but Playwright Test remains the formal E2E regression tool and Vitest Browser Mode remains the component/browser test layer.
- When Chrome DevTools MCP is used for diagnosis, capture the bug there if it is faster, then promote the fix into Browser or E2E coverage before calling the work done.

## External References

This guide follows the direction of the current official tool documentation:

- Playwright best practices: <https://playwright.dev/docs/best-practices>
- Playwright locators: <https://playwright.dev/docs/locators>
- Playwright authentication: <https://playwright.dev/docs/auth>
- Vitest Browser Mode: <https://vitest.dev/guide/browser/>
- Why Browser Mode: <https://vitest.dev/guide/browser/why>
- Vitest parallelism: <https://vitest.dev/guide/parallelism>
- pnpm filtering: <https://pnpm.io/filtering>
- Turborepo task running: <https://turborepo.com/repo/docs/crafting-your-repository/running-tasks>
- Testing Library guiding principles: <https://testing-library.com/docs/guiding-principles/>
- Chrome DevTools MCP live-session debugging: <https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session>
