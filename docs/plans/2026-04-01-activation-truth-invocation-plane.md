# Activation Truth Invocation Plane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified runtime invocation catalog derived from `extensions.activation` and convert the first WebMCP runtime tool surfaces to use activation truth as the canonical live capability source.

**Architecture:** Add a new `invocations.catalog` workspace runtime capability that derives normalized invocation descriptors from activation snapshots. Then wire runtime agent control and WebMCP runtime tools to consume that catalog for listing, resolution, and live-availability checks while preserving degraded and deactivated explanation metadata.

**Tech Stack:** TypeScript, Vitest, app runtime kernel capabilities, WebMCP bridge services

---

### Task 1: Add Invocation Catalog Capability

**Files:**

- Create: `apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.test.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelCapabilitySchema.ts`
- Modify: `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`
- Modify: `apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- the new capability exists on workspace scope
- the catalog reads activation snapshots
- active and non-active invocable contributions normalize into stable descriptors
- session overlay descriptors appear only when `sessionId` is provided

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.test.ts apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts`

Expected: FAIL because the capability and facade do not exist yet.

**Step 3: Write minimal implementation**

- define invocation descriptor/snapshot types
- create catalog facade derived from `RuntimeExtensionActivationService`
- register `invocations.catalog` in workspace scope

**Step 4: Run test to verify it passes**

Run the same Vitest command and confirm PASS.

### Task 2: Preserve Activation Metadata Needed For Invocation Normalization

**Files:**

- Modify: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts`
- Test: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`

**Step 1: Write the failing test**

Add tests asserting skill and invocation contributions preserve canonical id / alias metadata needed by invocation resolution.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`

Expected: FAIL because the metadata is not currently present.

**Step 3: Write minimal implementation**

Populate contribution metadata for live-skill-backed and behavior-asset-backed skill/invocation contributions with runtime skill identifiers and accepted aliases.

**Step 4: Run test to verify it passes**

Run the same Vitest command and confirm PASS.

### Task 3: Convert WebMCP Runtime Live-Skill Surfaces

**Files:**

- Modify: `packages/code-runtime-webmcp-client/src/webMcpBridgeTypes.ts`
- Modify: `apps/code/src/application/runtime/kernel/createRuntimeAgentControlDependencies.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeAgentControlFacade.ts`
- Modify: `apps/code/src/services/webMcpBridge.ts`
- Modify: `apps/code/src/services/webMcpBridgeRuntimeToolsShared.ts`
- Modify: `apps/code/src/services/webMcpBridgeRuntimeLiveSkillTools.ts`
- Modify: `apps/code/src/services/webMcpBridgeRuntimeWorkspaceTools.ts`
- Test: `apps/code/src/services/webMcpBridge.test.ts`
- Test: `apps/code/src/services/webMcpBridgeRuntimeOrchestration.integration.test.ts`
- Test: `apps/code/src/services/webMcpBridge.liveSkillCacheInvalidation.test.ts`

**Step 1: Write the failing test**

Add tests showing:

- `list-runtime-live-skills` can be sourced from invocation descriptors
- `run-runtime-live-skill` resolves aliases from the invocation catalog
- workspace tool availability prefers invocation catalog truth over direct runtime skill listing
- session-scoped invocation listing includes overlays when `sessionId` is supplied

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/services/webMcpBridge.test.ts apps/code/src/services/webMcpBridgeRuntimeOrchestration.integration.test.ts apps/code/src/services/webMcpBridge.liveSkillCacheInvalidation.test.ts`

Expected: FAIL because the WebMCP services still read `listLiveSkills()` directly.

**Step 3: Write minimal implementation**

- expose invocation-catalog readers through runtime agent control
- update runtime skill catalog helpers to prefer invocation descriptors
- replace the most important `assertRuntimeLiveSkillAvailable(...)` path

**Step 4: Run test to verify it passes**

Run the same Vitest command and confirm PASS.

### Task 4: Validate And Prepare PR

**Files:**

- Modify: `docs/plans/2026-04-01-activation-truth-invocation-plane-design.md`
- Modify: `docs/plans/2026-04-01-activation-truth-invocation-plane.md`

**Step 1: Run targeted validation**

Run:

```bash
pnpm vitest apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.test.ts \
  apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts \
  apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts \
  apps/code/src/services/webMcpBridge.test.ts \
  apps/code/src/services/webMcpBridgeRuntimeOrchestration.integration.test.ts \
  apps/code/src/services/webMcpBridge.liveSkillCacheInvalidation.test.ts
```

Expected: PASS.

**Step 2: Run boundary validation if needed**

Run: `pnpm ui:contract`

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.ts \
  apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.test.ts \
  apps/code/src/application/runtime/kernel/runtimeKernelCapabilitySchema.ts \
  apps/code/src/application/runtime/kernel/createRuntimeKernel.ts \
  apps/code/src/application/runtime/kernel/createRuntimeAgentControlDependencies.ts \
  apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts \
  apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts \
  apps/code/src/application/runtime/facades/runtimeAgentControlFacade.ts \
  apps/code/src/services/webMcpBridge.ts \
  apps/code/src/services/webMcpBridgeRuntimeToolsShared.ts \
  apps/code/src/services/webMcpBridgeRuntimeLiveSkillTools.ts \
  apps/code/src/services/webMcpBridgeRuntimeWorkspaceTools.ts \
  packages/code-runtime-webmcp-client/src/webMcpBridgeTypes.ts \
  docs/plans/2026-04-01-activation-truth-invocation-plane-design.md \
  docs/plans/2026-04-01-activation-truth-invocation-plane.md
git commit -m "feat: derive runtime invocation catalog from activation truth"
```
