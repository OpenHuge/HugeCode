# Composable Runtime Composition Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move HugeCode from app-local activation and invocation experiments to a shared runtime composition platform that is composable, configurable, and pluggable without weakening runtime-owned truth.

**Architecture:** Keep execution, approval, checkpoint, and review truth in `packages/code-runtime-service-rs` and `packages/code-runtime-host-contract`. Extract source loading, activation, invocation composition, and host/shell adaptation into shared TypeScript layers so desktop, web, and later remote control surfaces consume one runtime-backed composition model instead of re-implementing it in `apps/code`.

**Tech Stack:** TypeScript, React 19, pnpm monorepo, Rust runtime service, Electron, Cloudflare web shell, vanilla-extract, WebMCP.

---

## Why This Plan Exists

This plan is driven by three active HugeCode PR lines and two external reference codebases:

- HugeCode PR `#188`
  - activation truth becomes canonical for invocation discovery and WebMCP runtime tools
  - key surfaces: `apps/code/src/application/runtime/facades/runtimeExecutableSkillFacade.ts`
  - key surfaces: `apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacade.ts`
  - key surfaces: `apps/code/src/application/runtime/kernel/runtimeExtensionActivation.ts`
- HugeCode PR `#189`
  - invocation discovery and execute dispatch are split into one stable plane
  - key surfaces: `apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.ts`
  - key surfaces: `apps/code/src/application/runtime/kernel/runtimeInvocationExecute.ts`
  - key surfaces: `packages/code-runtime-host-contract/src/runtimeInvocationPlane.ts`
- HugeCode PR `#190`
  - Electron bridge cutover removes wide desktop compatibility barrels and narrows host ownership
  - key surfaces: `apps/code/src/application/runtime/ports/desktopHostCore.ts`
  - key surfaces: `apps/code/src/application/runtime/ports/desktopHostEvent.ts`
  - key surfaces: `packages/code-application/src/workspaceClientBindings.ts`

External reference signals:

- Claude Code source reconstruction
  - plugin/package loading discipline in `/Volumes/Dev/Git/claude-code-sourcemap/restored-src/src/utils/plugins/pluginLoader.ts`
  - commands and skill namespacing in `/Volumes/Dev/Git/claude-code-sourcemap/restored-src/src/utils/plugins/loadPluginCommands.ts`
  - agent packaging in `/Volumes/Dev/Git/claude-code-sourcemap/restored-src/src/utils/plugins/loadPluginAgents.ts`
  - sensitive vs non-sensitive plugin config storage in `/Volumes/Dev/Git/claude-code-sourcemap/restored-src/src/utils/plugins/pluginOptionsStorage.ts`
  - MCP bundle bridging in `/Volumes/Dev/Git/claude-code-sourcemap/restored-src/src/utils/plugins/mcpPluginIntegration.ts`
  - remote control transport split in `/Volumes/Dev/Git/claude-code-sourcemap/restored-src/src/remote/RemoteSessionManager.ts`
- pi-mono
  - package/resource loading in `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/core/package-manager.ts`
  - extension, skill, prompt, theme aggregation in `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/core/resource-loader.ts`
  - extension runtime surface in `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/core/extensions/index.ts`
  - packaging and mode split in `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/index.ts`
  - install/config detection in `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/config.ts`

## Non-Negotiable Constraints

- Do not reintroduce `/apps`, connectors, or a generic marketplace product narrative.
- Do not move canonical execution, review, checkpoint, or continuity truth into the client.
- Do not let `apps/code` become the only composition root for extension and invocation behavior.
- Do not bypass `apps/code/src/application/runtime/*` from feature code.
- Do not widen Electron/web compatibility through new catch-all service barrels.

## Target End State

HugeCode should converge on four explicit planes:

1. **Source Plane**
   - runtime extensions
   - workspace skills
   - prompt overlays
   - session commands
   - future RPC/WASI hosts
2. **Activation Plane**
   - one canonical readiness, provenance, shadowing, and diagnostics model
3. **Invocation Plane**
   - one stable descriptor catalog and one stable execute pipeline keyed by invocation ID
4. **Configuration Plane**
   - layered settings and launch profiles across user, workspace, session, and run scopes

The shell layer should only compose and present those planes.

### Task 1: Freeze The Shared Composition Vocabulary

**Files:**

- Modify: `packages/code-runtime-host-contract/src/index.ts`
- Modify: `packages/code-runtime-host-contract/src/code-runtime-rpc/runtimeKernelAndExtensions.ts`
- Create: `packages/code-runtime-host-contract/src/runtimeCompositionPlane.ts`
- Create: `packages/code-runtime-host-contract/src/runtimeCompositionProfiles.ts`
- Test: `packages/code-runtime-host-contract/src/index.test.ts`
- Test: `packages/code-runtime-host-contract/src/codeRuntimeRpc.test.ts`

**Step 1: Write the failing contract tests**

Add tests that prove the shared host contract exports:

- source descriptor types
- activation record types
- invocation descriptor types
- invocation execute request and response types
- layered composition profile types

**Step 2: Run contract tests to verify they fail**

Run: `pnpm --filter @ku0/code-runtime-host-contract test`

Expected: failures for missing composition-plane exports and missing RPC typing coverage.

**Step 3: Write the minimal shared contract layer**

Create `runtimeCompositionPlane.ts` with:

- `RuntimeCompositionSourceDescriptor`
- `RuntimeActivationRecord`
- `RuntimeInvocationDescriptor`
- `RuntimeInvocationShadow`
- `RuntimeInvocationVisibilityReason`

Create `runtimeCompositionProfiles.ts` with:

- `RuntimeCompositionProfile`
- `RuntimeCompositionScope`
- `RuntimeCompositionSourcePolicy`
- `RuntimeInvocationExecutionPolicy`

Keep this contract transport-neutral and additive.

**Step 4: Wire the new contract types through the existing host-contract exports**

Update:

- `packages/code-runtime-host-contract/src/index.ts`
- `packages/code-runtime-host-contract/src/code-runtime-rpc/runtimeKernelAndExtensions.ts`

So the future runtime/app layers stop defining these shapes ad hoc in `apps/code`.

**Step 5: Run tests and contract checks**

Run:

- `pnpm --filter @ku0/code-runtime-host-contract test`
- `pnpm check:runtime-contract`

Expected: PASS

### Task 2: Extract App-Local Invocation Logic Into Shared Composition Modules

**Files:**

- Create: `packages/code-application/src/runtime-composition/runtimeSourceRegistry.ts`
- Create: `packages/code-application/src/runtime-composition/runtimeActivationCatalog.ts`
- Create: `packages/code-application/src/runtime-composition/runtimeInvocationCatalog.ts`
- Create: `packages/code-application/src/runtime-composition/runtimeInvocationExecute.ts`
- Modify: `packages/code-application/src/index.ts`
- Modify: `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`
- Modify: `apps/code/src/application/runtime/kernel/runtimeKernelPlugins.ts`
- Test: `packages/code-application/src/runtime-composition/runtimeInvocationCatalog.test.ts`
- Test: `packages/code-application/src/runtime-composition/runtimeInvocationExecute.test.ts`
- Test: `apps/code/src/application/runtime/kernel/createRuntimeKernel.test.ts`

**Step 1: Write the failing extraction tests**

Add tests that prove `packages/code-application` can build:

- a registry of composition sources
- an activation catalog from source state
- a publishable invocation catalog
- an execute resolver keyed by stable invocation ID

**Step 2: Run focused tests to verify they fail**

Run:

- `pnpm -C packages/code-application exec vitest run src/runtime-composition/runtimeInvocationCatalog.test.ts src/runtime-composition/runtimeInvocationExecute.test.ts`

Expected: FAIL because the shared modules do not exist yet.

**Step 3: Move the pure composition logic out of `apps/code`**

Extract the app-local logic that is currently growing in the `#188` and `#189` branches into `packages/code-application`.

Keep in `apps/code` only:

- host wiring
- feature hooks
- page-facing adapters

Do not keep source normalization, shadowing, or execute dispatch policy app-local.

**Step 4: Rewire `apps/code` to consume the shared composition modules**

Update:

- `apps/code/src/application/runtime/kernel/createRuntimeKernel.ts`
- `apps/code/src/application/runtime/kernel/runtimeKernelPlugins.ts`

So `apps/code` becomes a consumer of shared composition code, not the owner.

**Step 5: Run focused tests**

Run:

- `pnpm -C packages/code-application exec vitest run src/runtime-composition/runtimeInvocationCatalog.test.ts src/runtime-composition/runtimeInvocationExecute.test.ts`
- `pnpm -C apps/code exec vitest run src/application/runtime/kernel/createRuntimeKernel.test.ts --config vitest.config.ts`
- `pnpm validate:fast`

Expected: PASS

### Task 3: Add Layered Configuration And Source Policy Resolution

**Files:**

- Create: `packages/code-workspace-client/src/settings-state/useSharedCompositionProfilesState.ts`
- Create: `packages/code-workspace-client/src/settings-shell/CompositionProfilesSection.tsx`
- Create: `packages/code-platform-interfaces/src/runtimeCompositionSettings.ts`
- Modify: `packages/code-workspace-client/src/settings-state/index.ts`
- Modify: `packages/code-workspace-client/src/settings-shell/index.ts`
- Modify: `packages/code-workspace-client/src/workspace/bindings.ts`
- Modify: `packages/code-application/src/workspaceClientBindings.ts`
- Test: `packages/code-workspace-client/src/settings-state/useSharedCompositionProfilesState.test.tsx`
- Test: `packages/code-workspace-client/src/settings-shell/SettingsViewShell.test.tsx`

**Step 1: Write the failing settings-state tests**

Add tests that prove HugeCode can resolve composition policy across:

- user scope
- workspace scope
- session scope
- run-launch override scope

And that the effective policy includes:

- enabled source kinds
- source precedence
- visibility policy
- execution policy
- future host binding allowlists

**Step 2: Run focused tests to verify they fail**

Run:

- `pnpm -C packages/code-workspace-client exec vitest run src/settings-state/useSharedCompositionProfilesState.test.tsx src/settings-shell/SettingsViewShell.test.tsx`

Expected: FAIL because there is no shared composition-profile state yet.

**Step 3: Implement shared composition-profile state and settings-shell framing**

Use `packages/code-workspace-client` and `packages/code-application` as the only shared client owners.

Do not add new page-local settings logic in `apps/code`.

**Step 4: Wire host/platform bindings to consume shared composition settings**

Update:

- `packages/code-workspace-client/src/workspace/bindings.ts`
- `packages/code-application/src/workspaceClientBindings.ts`
- `packages/code-platform-interfaces/src/runtimeCompositionSettings.ts`

So desktop and web can share the same effective-profile read path.

**Step 5: Run focused tests**

Run:

- `pnpm -C packages/code-workspace-client exec vitest run src/settings-state/useSharedCompositionProfilesState.test.tsx src/settings-shell/SettingsViewShell.test.tsx`
- `pnpm validate:fast`

Expected: PASS

### Task 4: Introduce Runtime-Owned Pluggable Host Binders

**Files:**

- Create: `packages/code-runtime-service-rs/src/composition_host_registry.rs`
- Create: `packages/code-runtime-service-rs/src/rpc_dispatch_invocation_plane.rs`
- Modify: `packages/code-runtime-service-rs/src/extensions_runtime.rs`
- Modify: `packages/code-runtime-service-rs/src/rpc_dispatch_extensions.rs`
- Modify: `packages/code-runtime-service-rs/src/rpc/dispatch/mod.rs`
- Modify: `packages/code-runtime-host-contract/src/code-runtime-rpc/requestPayloadMap.ts`
- Modify: `packages/code-runtime-host-contract/src/code-runtime-rpc/responsePayloadMap.ts`
- Test: `packages/code-runtime-service-rs/src/rpc_dispatch_extensions_tests.rs`
- Test: `packages/code-runtime-service-rs/src/runtime_events.rs`

**Step 1: Write the failing runtime-service tests**

Add tests that prove the runtime can:

- list bound invocation hosts
- expose readiness and reason codes for each host
- dispatch execution by invocation ID
- report source provenance in the result

Do not implement UI-side placeholders for this.

**Step 2: Run focused Rust tests to verify they fail**

Run:

- `cargo test invocation_plane --manifest-path packages/code-runtime-service-rs/Cargo.toml -- --nocapture`

Expected: FAIL because the invocation-plane dispatch and host registry do not exist yet.

**Step 3: Implement a runtime-owned host registry**

Support these categories explicitly:

- built-in runtime tool
- runtime extension tool
- workspace skill
- prompt overlay resolve-only action
- reserved RPC host
- reserved WASI host

The last two can be non-executable placeholders initially, but they must exist in the model now so HugeCode stops baking host assumptions into UI code.

**Step 4: Wire the new RPC methods and event payloads**

Update the request and response maps so runtime-owned invocation execution becomes a first-class contract instead of app-local convention.

**Step 5: Run focused runtime verification**

Run:

- `cargo test invocation_plane --manifest-path packages/code-runtime-service-rs/Cargo.toml -- --nocapture`
- `pnpm --filter @ku0/code-runtime-host-contract test`
- `pnpm check:runtime-contract`

Expected: PASS

### Task 5: Add Preflight Hooks, Post-Execution Shaping, And Review Evidence

**Files:**

- Create: `packages/code-runtime-host-contract/src/runtimeInvocationHooks.ts`
- Create: `apps/code/src/application/runtime/facades/runtimeInvocationEvidenceFacade.ts`
- Modify: `packages/code-runtime-service-rs/src/runtime_events.rs`
- Modify: `packages/code-runtime-service-rs/src/rpc_dispatch_runtime_kernel_v2.rs`
- Modify: `apps/code/src/application/runtime/facades/runtimeMissionControlFormatting.ts`
- Modify: `apps/code/src/application/runtime/facades/runtimeMissionReviewTriage.ts`
- Test: `apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.test.ts`
- Test: `packages/code-runtime-service-rs/src/runtime_tool_metrics_tests.rs`

**Step 1: Write the failing evidence tests**

Add tests that prove HugeCode surfaces:

- preflight block reason
- readiness reason
- execution provenance
- post-execution shaping metadata
- shadowed/hidden invocation explanation

**Step 2: Run focused tests to verify they fail**

Run:

- `pnpm -C apps/code exec vitest run src/application/runtime/facades/runtimeMissionControlSurfaceModel.test.ts --config vitest.config.ts`
- `cargo test runtime_tool_metrics --manifest-path packages/code-runtime-service-rs/Cargo.toml -- --nocapture`

Expected: FAIL because invocation evidence is not yet a first-class facade.

**Step 3: Implement runtime-owned before/after execution hooks**

Borrow the lifecycle shape from `pi-agent-core`, but keep the ownership HugeCode-native:

- runtime preflight hook
- runtime post-execution shaping hook
- runtime evidence event stream

Do not expose page-local hooks that can bypass policy.

**Step 4: Rewire Mission Control and Review Pack summary formatters**

Mission Control should explain:

- why an invocation is unavailable
- why one source shadows another
- why a host is degraded
- what evidence exists after execution

**Step 5: Run focused verification**

Run:

- `pnpm -C apps/code exec vitest run src/application/runtime/facades/runtimeMissionControlSurfaceModel.test.ts --config vitest.config.ts`
- `cargo test runtime_tool_metrics --manifest-path packages/code-runtime-service-rs/Cargo.toml -- --nocapture`
- `pnpm validate`

Expected: PASS

### Task 6: Delete Remaining App-Local Compatibility Seams After Cutover

**Files:**

- Modify: `apps/code/src/application/runtime/ports/*`
- Modify: `apps/code/src/services/runtimeClient*`
- Modify: `packages/code-application/src/workspaceClientBindings.ts`
- Modify: `packages/code-workspace-client/src/workspace/browserBindings.ts`
- Modify: `packages/code-workspace-client/src/workspace/missionControlBindings.ts`
- Test: `apps/code/src/services/runtimeClient.test.ts`
- Test: `packages/code-workspace-client/src/workspace/browserBindings.test.ts`

**Step 1: Write the failing anti-bypass tests**

Add tests that prove:

- UI code no longer reconstructs source readiness from multiple legacy inputs
- desktop/web bindings consume shared composition outputs
- runtime client compatibility helpers are no longer the truth owner

**Step 2: Run focused tests to verify they fail**

Run:

- `pnpm -C apps/code exec vitest run src/services/runtimeClient.test.ts --config vitest.config.ts`
- `pnpm -C packages/code-workspace-client exec vitest run src/workspace/browserBindings.test.ts src/workspace/missionControlBindings.test.ts`

Expected: FAIL because compatibility seams still leak into the app layer.

**Step 3: Remove the bypasses**

Delete or narrow any remaining app-local logic that:

- infers activation without the activation plane
- dispatches execution without the invocation plane
- reconstructs host or profile state outside the shared bindings

**Step 4: Run the narrowest full verification that covers the migration**

Run:

- `pnpm validate`
- `pnpm ui:contract`
- `pnpm check:runtime-contract`
- `pnpm desktop:verify:fast`

Expected: PASS

## Recommended Execution Order

1. Merge or restack `#188`, `#189`, and `#190` into one known baseline.
2. Finish Task 1 before any new UI feature work.
3. Finish Task 2 before adding more invocation consumers.
4. Finish Task 3 before introducing new settings or launch-surface toggles.
5. Finish Task 4 before any serious RPC/WASI plugin-host work.
6. Finish Task 5 before broadening Mission Control or Review Pack copy.
7. Finish Task 6 before claiming the architecture is fully composable.

## Explicit Borrow / Avoid Decisions

Borrow:

- Claude Code style package loading, namespacing, and config separation
- Claude Code style sensitive vs non-sensitive option storage split
- pi-mono style package/resource loader discipline
- pi-agent-core style before/after tool lifecycle model
- pi-mono style mode separation between CLI shell and reusable SDK/core

Avoid:

- Claude Code style in-process trust expansion without stronger runtime-owned approval boundaries
- pi-mono local session truth replacing runtime truth
- any generic plugin-marketplace product framing inside HugeCode UI
- any new wide desktop or runtime compatibility barrels in `apps/code`

## Done Criteria

The architecture upgrade is only done when:

- source, activation, invocation, and profile truth each have one canonical owner
- desktop and web consume shared composition bindings instead of ad hoc shell logic
- invocation execution is keyed by stable IDs, not page-local tool-name branching
- future RPC/WASI host categories exist in the model without forcing a second rewrite
- Mission Control and Review Pack can explain readiness, shadowing, provenance, and execution outcome from runtime-backed evidence
- the remaining compatibility helpers are adapters, not alternate truth owners

## Validation Summary For This Plan Document

Docs-only, no runtime impact.
