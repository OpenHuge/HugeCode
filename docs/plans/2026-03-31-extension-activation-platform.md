# Extension Activation Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a runtime-kernel extension activation lifecycle that turns packages, behavior assets, and session overlays into explicit bindable and activatable runtime truth.

**Architecture:** Add a workspace-scoped activation capability beside the existing plugin catalog, registry, and composition capabilities. The new service owns discovery, verification, binding, activation state transitions, refresh/deactivate flows, session overlays, and publication of active contributions/readiness so downstream invocation surfaces consume a typed activation snapshot instead of UI-local heuristics.

**Tech Stack:** TypeScript, Vitest, React runtime-kernel boundaries in `apps/code`, shared contract types in `packages/code-runtime-host-contract`

---

### Task 1: Freeze activation ontology and truth model

**Files:**

- Create: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts`
- Create: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelCapabilitySchema.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelCapabilities.ts`
- Modify: `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`
- Modify: `apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts`

**Step 1: Write the failing test**

Add tests that expect a workspace runtime scope to expose a new `extensions.activation` capability and expect the activation module to export the canonical lifecycle/state/contribution types.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts`
Expected: FAIL because the activation module/capability does not exist yet.

**Step 3: Write minimal implementation**

Implement the activation type system:

- activation sources and source scope
- contribution kinds and live contribution descriptors
- activation states, diagnostics, refresh modes, failure taxonomy
- workspace capability key and scope registration

**Step 4: Run test to verify it passes**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts`
Expected: PASS

### Task 2: Add behavior asset compilation and contribution binding

**Files:**

- Modify: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeWorkspaceSkillManifests.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelPluginTypes.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelPlugins.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelPlugins.test.ts`

**Step 1: Write the failing test**

Add tests that feed real workspace skill manifests plus live skill/runtime extension inputs and expect:

- compiled behavior assets with provenance and compatibility metadata
- live contribution descriptors for skills/resources/policies/host bindings
- bind diagnostics for manifest-only or incompatible sources

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeKernelPlugins.test.ts apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
Expected: FAIL because behavior assets are not compiled into activation-ready descriptors yet.

**Step 3: Write minimal implementation**

Add a narrow compiler/binder that normalizes:

- runtime extensions
- runtime live skills
- repo-authored `.hugecode/skills/*/manifest.json` entries
- installed-but-unbound registry packages

Emit typed activation candidates with contribution lists, provenance, health/readiness inputs, and bindability metadata.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeKernelPlugins.test.ts apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
Expected: PASS

### Task 3: Implement the activation state machine and refresh/deactivate flows

**Files:**

- Modify: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`

**Step 1: Write the failing test**

Add lifecycle tests that cover:

- `discover -> verify -> install -> bind -> activate`
- degraded activation from warnings/health mismatch
- activation failure and retry
- `refresh` in cache-only and full modes
- `deactivate -> uninstall`

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
Expected: FAIL because transitions and refresh behavior are not implemented.

**Step 3: Write minimal implementation**

Implement:

- deterministic transition rules
- diagnostics capture per phase
- activation snapshot publication
- retry handling from failed/degraded states
- refresh reconciliation without mutating prior truth until a new snapshot is ready

**Step 4: Run test to verify it passes**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
Expected: PASS

### Task 4: Add session overlays and active contribution publication

**Files:**

- Modify: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelCapabilitySchema.ts`
- Modify: `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`

**Step 1: Write the failing test**

Add tests that create/remove session overlays and assert:

- overlays layer separately from workspace/global composition
- overlay refresh is independent
- active contribution snapshots expose source scope and overlay provenance
- removal restores the underlying workspace/global state

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
Expected: FAIL because overlay support and publication are missing.

**Step 3: Write minimal implementation**

Implement session overlay APIs:

- add overlay
- refresh overlay
- remove overlay
- inspect overlay state

Publish active contributions and readiness through the activation facade so Track A can consume one runtime-facing activation snapshot.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
Expected: PASS

### Task 5: Project activation truth into readiness and hand-off docs

**Files:**

- Modify: `apps/code/src/application/runtime/facades/runtimeKernelPluginReadiness.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeKernelPluginReadiness.test.ts`
- Create: `docs/plans/2026-03-31-extension-activation-platform-design-note.md`

**Step 1: Write the failing test**

Add readiness tests that expect activation state, bind/overlay metadata, degraded summaries, and remediation guidance to appear in the plugin readiness projection.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest apps/code/src/application/runtime/facades/runtimeKernelPluginReadiness.test.ts`
Expected: FAIL because readiness does not know about activation truth yet.

**Step 3: Write minimal implementation**

Wire activation metadata into readiness projection and write a short design note covering:

- activatable sources now supported
- behavior asset path
- remaining stub/future work
- clean ingestion boundary for invocation plane work

**Step 4: Run test to verify it passes**

Run: `pnpm vitest apps/code/src/application/runtime/facades/runtimeKernelPluginReadiness.test.ts`
Expected: PASS

### Task 6: Run targeted validation

**Files:**

- No code changes required

**Step 1: Run focused lifecycle tests**

Run:

- `pnpm vitest apps/code/src/application/runtime/kernel/runtimeExtensionActivation.test.ts`
- `pnpm vitest apps/code/src/application/runtime/kernel/runtimeKernelPlugins.test.ts`
- `pnpm vitest apps/code/src/application/runtime/facades/runtimeKernelPluginReadiness.test.ts`
- `pnpm vitest apps/code/src/application/runtime/kernel/createWorkspaceRuntimeScope.test.ts`

Expected: PASS

**Step 2: Run boundary/contract checks for touched surfaces**

Run:

- `pnpm ui:contract`
- `pnpm check:runtime-contract`

Expected: PASS
