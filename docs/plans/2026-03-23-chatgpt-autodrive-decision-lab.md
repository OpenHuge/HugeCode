# ChatGPT AutoDrive Decision Lab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Chrome DevTools MCP-backed ChatGPT decision-lab capability that AutoDrive can call automatically by default when route confidence is low or competing directions need a stronger recommendation.

**Architecture:** Extend the existing runtime browser-debug boundary instead of building page-local browser control. Add a new browser debug mode for Chrome DevTools MCP plus a structured decision-lab operation, expose a WebMCP tool for explicit use, and wire AutoDrive policy/context to auto-call the decision lab behind a risk-policy switch and trigger thresholds.

**Tech Stack:** TypeScript, React runtime facades, WebMCP bridge, Rust runtime service, Chrome DevTools MCP, Vitest

---

### Task 1: Lock the contract with failing tests

**Files:**

- Modify: `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`
- Modify: `apps/code/src/services/webMcpBridgeRuntimeBrowserTools.test.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeAutoDrivePolicy.test.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeAutoDriveController.test.ts`

**Step 1: Write failing host-contract expectations**

- Add a new browser debug mode for Chrome DevTools MCP.
- Add a new browser debug operation for the ChatGPT decision lab.
- Add structured decision-lab result payload fields to the browser debug response contract.

**Step 2: Write failing WebMCP browser-tool test**

- Expect a new tool name such as `run-chatgpt-decision-lab`.
- Expect it to require approval and forward the new structured request to runtime browser debug.

**Step 3: Write failing AutoDrive policy/controller tests**

- Expect AutoDrive not to auto-call the decision lab when the feature switch is disabled.
- Expect AutoDrive to auto-call the decision lab when the switch is enabled and confidence/ambiguity thresholds are hit.
- Expect AutoDrive to continue safely when the decision lab fails or browser debug is unavailable.

**Step 4: Run focused tests to verify failure**

Run:

```bash
pnpm vitest run \
  apps/code/src/services/webMcpBridgeRuntimeBrowserTools.test.ts \
  apps/code/src/application/runtime/facades/runtimeAutoDrivePolicy.test.ts \
  apps/code/src/application/runtime/facades/runtimeAutoDriveController.test.ts
```

Expected: failures for missing contract fields, missing tool registration, and missing AutoDrive decision-lab behavior.

### Task 2: Implement runtime/browser contract and Chrome DevTools MCP support

**Files:**

- Modify: `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`
- Modify: `apps/code/src/services/webMcpBridgeTypes.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeDiscoveryControl.ts`
- Modify: `apps/code/src/services/tauriDesktopRpc.ts`
- Modify: `packages/code-runtime-service-rs/src/rpc_dispatch_browser_debug.rs`

**Step 1: Extend shared browser-debug contract**

- Add `mcp-chrome-devtools` to the browser debug mode union.
- Add a `chatgpt_decision_lab` browser debug operation.
- Add a structured decision-lab request/response shape carried through `RuntimeBrowserDebugRunRequest/Response`.

**Step 2: Implement runtime Chrome DevTools MCP adapter selection**

- Reuse the existing browser debug RPC path.
- Detect and report Chrome DevTools MCP availability/status distinctly from Playwright MCP.
- Route the new operation through the Chrome DevTools MCP path only.

**Step 3: Implement structured runtime result aggregation**

- Normalize the ChatGPT decision-lab result into stable fields:
  `recommendedOption`, `alternatives`, `decisionMemo`, `confidence`, `assumptions`, `followUpQuestions`.
- Preserve warnings and failure reasons without crashing AutoDrive.

**Step 4: Run focused tests to verify pass**

Run the same Vitest command as Task 1 and the narrow Rust/browser-debug tests that cover the new RPC path.

### Task 3: Expose the explicit WebMCP tool

**Files:**

- Modify: `apps/code/src/services/webMcpBridgeRuntimeBrowserTools.ts`
- Modify: `apps/code/src/services/webMcpBridgeToolNames.ts`
- Modify: `packages/code-runtime-webmcp-client/src/webMcpBridgeToolNames.ts`

**Step 1: Add the new tool descriptor**

- Register `run-chatgpt-decision-lab`.
- Require explicit approval because it opens an authenticated external session and can consume quota.
- Validate structured input for decision prompt, options, constraints, and network allowance.

**Step 2: Forward to runtime browser debug**

- Map the tool input to the new runtime browser debug operation.
- Return the structured decision result in the standard WebMCP response envelope.

**Step 3: Run focused tool tests**

- Re-run the WebMCP browser tools test file.

### Task 4: Wire AutoDrive automatic triggering

**Files:**

- Modify: `apps/code/src/application/runtime/types/autoDrive.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeAutoDrivePolicy.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeAutoDriveController.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeMissionDraftFacade.ts`
- Modify: `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`

**Step 1: Add AutoDrive decision-lab policy fields**

- Add a switch enabled by default.
- Add trigger thresholds for low confidence and ambiguous opportunity spread.
- Add optional `chatgptWorkspaceId` / network policy passthrough only if required by current runtime auth model.

**Step 2: Evaluate trigger conditions inside AutoDrive**

- Trigger when candidate ambiguity and/or confidence thresholds say the route is hard to choose.
- Do not trigger repeatedly once the current iteration already has a decision-lab outcome.
- Treat the decision-lab output as advisory input that can refine confidence, blockers, and selected direction, not as a blind command.

**Step 3: Fail safe**

- If Chrome DevTools MCP, ChatGPT auth, or extraction fails, record the warning and continue with existing AutoDrive heuristics.
- Never make the decision lab a required dependency for ordinary AutoDrive execution.

**Step 4: Run focused AutoDrive tests**

- Re-run the AutoDrive policy/controller tests.

### Task 5: Verify and document actual runtime prerequisites

**Files:**

- Modify: `docs/development/chatgpt-web-prompt-lab-workflow.md`

**Step 1: Update docs**

- Document that AutoDrive decision lab now exists.
- Clarify that automatic use depends on Chrome DevTools MCP availability and an authenticated ChatGPT web session.

**Step 2: Run final verification**

Run:

```bash
pnpm vitest run \
  apps/code/src/services/webMcpBridgeRuntimeBrowserTools.test.ts \
  apps/code/src/application/runtime/facades/runtimeAutoDrivePolicy.test.ts \
  apps/code/src/application/runtime/facades/runtimeAutoDriveController.test.ts
pnpm validate:fast
```

Expected: targeted tests pass; fast validation passes or surfaces exact residual blockers.
