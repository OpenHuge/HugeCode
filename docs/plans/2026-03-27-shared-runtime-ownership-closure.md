# Shared Runtime Ownership Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move runtime client and WebMCP neighboring business logic out of `apps/code/src/services/*` and into the shared runtime packages so `apps/code` becomes composition-only on this seam.

**Architecture:** `packages/code-runtime-client` becomes the canonical runtime RPC client constructor and shared transport helper owner. `packages/code-runtime-webmcp-client` becomes the canonical owner for WebMCP descriptors, tool-name catalogs, and shared agent-control helpers. `apps/code` keeps only host-specific transport adaptation, runtime tool composition, and app-facing facade wiring.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, React/Vite app boundary checks

---

### Task 1: Lock shared runtime client ownership with failing tests

**Files:**

- Test: `packages/code-runtime-client/src/runtimeClientRpcExtensionsFactory.appMethods.test.ts`

**Step 1: Write the failing test**

Verify that `createExtendedRpcRuntimeClient` exposes the app-local RPC helpers that previously only existed in `apps/code`.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ku0/code-runtime-client test -- runtimeClientRpcExtensionsFactory.appMethods.test.ts`
Expected: FAIL because shared client does not expose the app-local helper methods yet.

**Step 3: Write minimal implementation**

Move the app-local helper methods into `packages/code-runtime-client/src/runtimeClientRpcExtensionsFactory.ts`.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ku0/code-runtime-client test -- runtimeClientRpcExtensionsFactory.appMethods.test.ts`
Expected: PASS

### Task 2: Lock shared WebMCP canonical exports with failing tests

**Files:**

- Test: `packages/code-runtime-webmcp-client/src/webMcpBridgeContextDescriptors.test.ts`
- Test: `packages/code-runtime-webmcp-client/src/webMcpBridgeToolNames.test.ts`
- Test: `packages/code-runtime-webmcp-client/src/webMcpAgentControlCatalog.test.ts`

**Step 1: Write the failing tests**

Cover:

- canonical `hugecode://` URIs
- full runtime extension / registry tool-name catalog
- shared write-tool helper behavior for `set-user-intent`

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ku0/code-runtime-webmcp-client test -- webMcpBridgeContextDescriptors.test.ts webMcpBridgeToolNames.test.ts webMcpAgentControlCatalog.test.ts`
Expected: FAIL because package ownership is incomplete.

**Step 3: Write minimal implementation**

Add `webMcpAgentControlCatalog.ts`, fix descriptors/tool names, and export them through the package.

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ku0/code-runtime-webmcp-client test -- webMcpBridgeContextDescriptors.test.ts webMcpBridgeToolNames.test.ts webMcpAgentControlCatalog.test.ts`
Expected: PASS

### Task 3: Remove app-local runtime client construction

**Files:**

- Delete: `apps/code/src/services/runtimeClientRpcClient.ts`
- Modify: `apps/code/src/services/runtimeClientTransport.ts`

**Step 1: Write the failing usage proof**

Use the existing app runtime client tests as the red/green proof.

**Step 2: Run targeted app runtime-client tests**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/runtimeClient.test.ts`
Expected: Existing tests protect behavior while code changes.

**Step 3: Write minimal implementation**

- Replace app-local runtime client construction with `createExtendedRpcRuntimeClient` from the package.
- Delete the app-local constructor file.

**Step 4: Run targeted test to verify behavior stays green**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/runtimeClient.test.ts`
Expected: PASS

### Task 4: Reduce app web runtime HTTP transport to a host wrapper

**Files:**

- Modify: `apps/code/src/services/runtimeClientWebHttpTransport.ts`
- Test: `apps/code/src/services/runtimeClientWebHttpTransport.test.ts`

**Step 1: Use the existing test as the red/green guard**

The app test should continue to prove wrapper behavior.

**Step 2: Run the targeted transport test**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/runtimeClientWebHttpTransport.test.ts`
Expected: PASS before and after refactor.

**Step 3: Write minimal implementation**

Wrap the shared package transport and inject app-owned auth token / header inputs only.

**Step 4: Re-run the targeted transport test**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/runtimeClientWebHttpTransport.test.ts`
Expected: PASS

### Task 5: Delete app WebMCP descriptor/read-tool/tool-name wrappers

**Files:**

- Delete: `apps/code/src/services/webMcpBridgeContextDescriptors.ts`
- Delete: `apps/code/src/services/webMcpBridgeReadTools.ts`
- Delete: `apps/code/src/services/webMcpBridgeToolNames.ts`
- Delete: `apps/code/src/services/webMcpBridgeContextDescriptors.test.ts`

**Step 1: Use package tests as the ownership guard**

Run: `pnpm --filter @ku0/code-runtime-webmcp-client test -- webMcpBridgeContextDescriptors.test.ts webMcpBridgeToolNames.test.ts`

**Step 2: Write minimal implementation**

Delete the app-local wrapper files and update app composition to import the
shared package directly.

**Step 3: Re-run the ownership and app composition tests**

Run:

```bash
pnpm --filter @ku0/code-runtime-webmcp-client test -- webMcpBridgeContextDescriptors.test.ts webMcpBridgeToolNames.test.ts
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/webMcpBridge.test.ts
```

Expected: PASS

### Task 6: Reduce app WebMCP bridge to composition-only logic

**Files:**

- Modify: `apps/code/src/services/webMcpBridge.ts`
- Test: `apps/code/src/services/webMcpBridge.test.ts`

**Step 1: Use the existing bridge test as the red/green guard**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/webMcpBridge.test.ts`

**Step 2: Write minimal implementation**

Move shared helper logic out of the app file and keep only:

- runtime tool composition
- live-skill invalidation wiring
- tool exposure policy wiring
- package function composition

**Step 3: Re-run the targeted bridge test**

Run: `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/webMcpBridge.test.ts`
Expected: PASS

### Task 7: Update docs to declare the canonical ownership

**Files:**

- Modify: `docs/architecture/debt-inventory.md`
- Modify: `docs/plans/2026-03-27-shared-runtime-ownership-closure-design.md`

**Step 1: Record the resolved ownership**

Update debt status so it reflects that runtime client and core WebMCP ownership moved into shared packages.

**Step 2: Verify docs do not claim stale ownership**

Run: `rg -n "runtimeClientRpcClient|hypecode://workspace|packages/code-runtime-webmcp-client exists, but" docs apps/code/src/services packages`
Expected: only intentional references remain.

### Task 8: Run final targeted verification

**Files:**

- Verify only

**Step 1: Run package tests**

Run:

```bash
pnpm --filter @ku0/code-runtime-client test -- runtimeClientRpcExtensionsFactory.appMethods.test.ts
pnpm --filter @ku0/code-runtime-webmcp-client test -- webMcpBridgeContextDescriptors.test.ts webMcpBridgeToolNames.test.ts webMcpAgentControlCatalog.test.ts
```

Expected: PASS

**Step 2: Run app targeted tests**

Run:

```bash
pnpm --filter @ku0/code exec vitest run --config vitest.config.ts src/services/webMcpBridge.test.ts src/services/runtimeClient.test.ts src/services/runtimeClientWebHttpTransport.test.ts
```

Expected: PASS

**Step 3: Run type and boundary verification**

Run:

```bash
pnpm --filter @ku0/code typecheck
pnpm ui:contract
```

Expected: PASS

### Task 9: Prepare branch and PR

**Files:**

- Git / PR metadata only

**Step 1: Create a dedicated branch**

Run:

```bash
git switch -c codex/shared-runtime-ownership-closure
```

**Step 2: Review diff**

Run:

```bash
git status --short
git diff --stat
```

**Step 3: Commit**

```bash
git add apps/code/src/services packages/code-runtime-client packages/code-runtime-webmcp-client docs/architecture/debt-inventory.md docs/plans/2026-03-27-shared-runtime-ownership-closure-design.md docs/plans/2026-03-27-shared-runtime-ownership-closure.md
git commit -m "refactor: close shared runtime client ownership"
```

**Step 4: Push and open PR**

```bash
git push -u origin codex/shared-runtime-ownership-closure
gh pr create --title "refactor: close shared runtime client ownership" --body-file .github/pull_request_template.md
```

Expected: PR open on GitHub with English summary and validation evidence.
