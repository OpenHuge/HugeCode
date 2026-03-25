# Mission Launch Canonicalization

This note records the active launch-entrypoint policy after the Track 1
convergence work.

## Canonical Rule

Product-facing mission launch must flow through:

`Mission Control -> code_runtime_run_prepare_v2 -> code_runtime_run_start_v2`

Anything outside that chain is either thread-only or compatibility-only.

## Launch Inventory

| Entry                                                                                 | Call locations                                                                                                                                                                                                                                                                                                                                                | Current purpose                                   | Keep?            | Retirement / boundary strategy                                                                                                                  | Owner                                                 | Blocker                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `code_runtime_run_prepare_v2`                                                         | `apps/code/src/application/runtime/facades/runtimeMissionLaunchPreparation.ts`, `apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts`                                                                                                                                                                                                   | Canonical runtime-owned launch preparation truth  | Yes              | Required part of every product-facing mission launch                                                                                            | `apps/code` runtime + runtime contract                | None                                                     |
| `code_runtime_run_start_v2`                                                           | `apps/code/src/application/runtime/facades/runtimeMissionControlController.ts`, `apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts`, `packages/code-workspace-client/src/workspace/browserBindings.ts`                                                                                                                                | Canonical mission run start                       | Yes              | Required part of every product-facing mission launch                                                                                            | `apps/code` runtime + `code-workspace-client`         | None                                                     |
| `runtimeControl.startTask`                                                            | `apps/code/src/features/app/hooks/useGitHubRuntimeTaskLaunchers.ts`, `apps/code/src/features/app/hooks/gitHubSourceDelegationLauncher.ts`, `apps/code/src/features/autodrive/hooks/useAutoDriveController.ts`, `apps/code/src/application/runtime/facades/runtimeReviewIntelligenceActions.ts`, `apps/code/src/services/webMcpBridgeRuntimeAgentTaskTools.ts` | Product-facing helper for non-page launch callers | Yes              | Kept only because it now resolves through `prepare_v2` + `start_v2` inside `createRuntimeAgentControlDependencies.ts`                           | `apps/code` runtime kernel                            | None                                                     |
| `code_turn_send`                                                                      | thread lifecycle / composer runtime turn flow                                                                                                                                                                                                                                                                                                                 | Thread-only conversational execution              | Yes, thread-only | Must not be treated as a Mission Control launch path or expanded into run launch                                                                | Threads / composer runtime surfaces                   | None                                                     |
| Plan panel distributed retry                                                          | `apps/code/src/features/plan/components/PlanPanel.tsx`                                                                                                                                                                                                                                                                                                        | Page-level direct node relaunch                   | No               | Removed. Plan panel is observe + interrupt only; retry/relaunch must go through Mission Control                                                 | Plan surface                                          | None                                                     |
| `WorkspaceClientRuntime.agentControl.startRuntimeJob`                                 | `packages/code-workspace-client/src/workspace/bindings.ts`, browser/desktop bindings                                                                                                                                                                                                                                                                          | Shared client direct job-start exposure           | No               | Replaced with `prepareRuntimeRun` + `startRuntimeRun` to align shared bindings with canonical v2                                                | `code-workspace-client` + `apps/code` kernel bindings | None                                                     |
| `code_runtime_run_start`                                                              | runtime contract + Rust dispatch compatibility surface                                                                                                                                                                                                                                                                                                        | Legacy run-start compatibility RPC                | Compat only      | No product-side callers. Delete after frozen compat window and downstream client parity cleanup                                                 | runtime contract + runtime service                    | Frozen compat surface / external client parity           |
| `code_runtime_run_resume`, `code_runtime_run_intervene`, `code_runtime_run_subscribe` | runtime contract + Rust dispatch compatibility surface                                                                                                                                                                                                                                                                                                        | Legacy run-control compatibility RPCs             | Compat only      | No new product-side dependencies. Delete after downstream client parity cleanup                                                                 | runtime contract + runtime service                    | Frozen compat surface / external client parity           |
| `code_kernel_job_start_v3`                                                            | runtime contract, low-level client extensions, Rust dispatch                                                                                                                                                                                                                                                                                                  | Kernel-job compatibility start surface            | Compat only      | Removed from product launch flows and shared browser launch bindings. Retain only for low-level compat clients until delete window is scheduled | runtime contract + runtime client + runtime service   | External compat clients, callback/delivery compatibility |

## Product Rules

- Product-facing launch PRs must use the canonical mission launch contract and
  say so explicitly.
- New pages must not add direct relaunch, retry, or kernel job start paths.
- Thread flows may keep using `code_turn_send`, but only for thread-specific
  execution. They must not become a second Mission Control start path.
- Compatibility RPCs may stay in the runtime contract, but product code must
  not depend on them as the implementation base.

## Guardrails

- `tests/scripts/runtime-launch-path-governance.test.ts`
  scans product-facing source roots for retired launch helpers and direct kernel
  job start usage.
- `apps/code/src/features/plan/components/PlanPanel.tsx`
  no longer wires retry actions.
- `apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts`
  now performs `prepare_v2` before `start_v2`.

## PR Expectations

Every launch-related PR must state:

- which canonical contract it uses
- which legacy entry points it removes
- which compat-only entries remain and why
- the owner, exit trigger, and delete window for anything left behind

## Exit Plan

- Legacy runtime-run methods:
  owner = runtime contract + runtime service
  exit trigger = no remaining downstream compat clients or frozen-spec blockers
  delete window = first contract freeze after parity confirmation
- Kernel job start v3 as a launch entry:
  owner = runtime contract + runtime client
  exit trigger = callback/delivery clients migrate to canonical run records or a
  non-product internal control surface
  delete window = first release after downstream compat audit is green

## Regression Checklist

- Mission Control preview still reads `prepare_v2` truth.
- Mission Control launch still succeeds through the canonical helper.
- `runtimeControl.startTask` call sites launch runs without touching
  `code_kernel_job_start_v3`.
- Plan panel distributed actions can interrupt nodes but cannot relaunch them.
- Shared browser/desktop workspace bindings expose canonical launch methods
  instead of direct kernel job start.
