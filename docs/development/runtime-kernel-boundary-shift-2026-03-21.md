# Runtime Kernel Boundary Shift

Date: 2026-03-21
Status: accepted

## Decision

Client-side runtime composition now starts from `RuntimeKernel` instead of letting
desktop workspace bindings and runtime facades assemble runtime ports directly.

This change establishes four hard rules:

1. `RuntimeGateway` is a pure injected gateway, not a fallback wrapper over
   `getRuntimeClient()`.
2. `createDesktopWorkspaceClientBindings.tsx` consumes kernel-provided runtime
   bindings instead of composing app settings, oauth, model, and workspace
   catalog ports itself.
3. `application/runtime/facades/*` and `application/runtime/kernel/*` must not
   import `getRuntimeClient()` directly. Runtime reads must flow through
   `RuntimeKernel` or a narrower runtime port.
4. runtime-specific ports such as `tauriRuntimeRuns`, `tauriRuntimeSubAgents`,
   `tauriRuntimeDiagnostics`, and `tauriRuntimePolicy` must not route through
   the raw `ports/tauri.ts` aggregation barrel. They must import a dedicated
   service bridge instead.

## What Changed

- `RuntimeKernel` now exposes:
  - `runtimeGateway`
  - `workspaceClientRuntimeGateway`
  - `workspaceClientRuntime`
  - workspace-scoped `runtimeAgentControl`
- the former mixed `runtimeOperationsFacade.ts` orchestration surface has been
  replaced by three explicit domain-local facades:
  - `runtimeBackendPoolFacade.ts`
  - `runtimeOverlayConnectivityFacade.ts`
  - `runtimeAutomationSchedulesFacade.ts`
- retired wide bridge ports `tauriSettings.ts` and `tauriWorkspaces.ts` have
  been deleted; boundary and runtime-port guards now treat them as forbidden
  reintroductions instead of tolerated migration barrels
- runtime backend profiles now carry an explicit `policy` object through
  canonical runtime contracts and runtime-native persistence. The policy shape
  includes:
  - `trustTier`
  - `dataSensitivity`
  - `approvalPolicy`
  - `allowedToolClasses`
    missing policy is normalized inside runtime to a conservative default profile
    instead of being reconstructed in page-local UI state
- `runtimeAgentControlFacade` is now a thin adapter over injected dependencies.
  The launch/request normalization moved into
  `kernel/createRuntimeAgentControlDependencies.ts`.
- mission-control reads now go through `RuntimeGateway.readMissionControlSnapshot`.
- repository execution contract reads and review-intelligence skill catalog reads
  now use narrower workspace/runtime ports instead of raw runtime client access.
- `workspaceClientRuntime` is now assembled by
  `kernel/createWorkspaceClientRuntimeBindings.ts` instead of letting
  `createRuntimeKernel.ts` inline raw runtime RPC calls for agent control,
  thread, git, and workspace-file bindings.
- runtime-specific service bridges were split out of the legacy
  `tauriRuntimeAgentBridge.ts` surface so ports can target focused adapters for:
  - runs
  - sub-agents
  - mission control
  - app settings
  - runtime policy
  - live skills
  - prompt library
  - raw runtime terminal sessions
- UI boundary checks now fail if:
  - a runtime facade reintroduces `getRuntimeClient()`
  - runtime kernel code reintroduces `getRuntimeClient()`
  - desktop workspace bindings start assembling broad runtime ports again
  - runtime ports route back through raw `ports/tauri.ts` on the main runtime path
  - product code imports the retired `runtimeOperationsFacade`

## Breaking Changes

- `createRuntimeAgentControlFacade(workspaceId)` was replaced with
  `createRuntimeAgentControlFacade(workspaceId, deps)`.
- `resolveMissionControlSnapshot(...)` now requires
  `runtimeGateway: Pick<RuntimeGateway, "readMissionControlSnapshot">`.
- `createDesktopWorkspaceClientBindings()` now optionally accepts a prebuilt
  `RuntimeKernel`.
- native backend add/edit flows now emit a policy-bearing upsert payload.

## Migration Notes

- Tests or fixtures calling `useMainAppHomeState` must render under
  `RuntimeKernelProvider`.
- SettingsView test harnesses must render under
  `WorkspaceClientBindingsProvider`.
- Code that previously relied on facade-local `getRuntimeClient()` access must
  move to:
  - `RuntimeKernel.runtimeGateway`
  - a narrow runtime port such as `tauriMissionControl` or
    `tauriWorkspaceFiles`
- Code that previously imported `useRuntimeOperationsFacade` must choose one of:
  - `useRuntimeBackendPoolFacade`
  - `useRuntimeOverlayConnectivityFacade`
  - `useRuntimeAutomationSchedulesFacade`
- New runtime-facing desktop bindings should be added to `RuntimeKernel`, then
  consumed by `createDesktopWorkspaceClientBindings.tsx`. Do not wire new
  runtime ports straight into the web entry.
- If a runtime port only exists to expose one runtime domain, create or reuse a
  dedicated bridge in `apps/code/src/services/tauriRuntime*Bridge.ts` instead of
  adding another re-export to `ports/tauri.ts`.
- Code that reads backend pool state should treat `policy` as runtime truth.
  Do not synthesize trust or approval heuristics in UI components.

## Deferred Debt Register

- Durable run lifecycle (`startRun/resumeRun/subscribeRun/cancelRun/...`) has
  not been introduced at the contract boundary yet.
- Rust runtime hotspot decomposition (`router_builder.rs`, backend dispatch,
  mission control dispatch) is still pending.
- Backend policy exists as explicit runtime metadata, but routing/placement
  enforcement still needs a later slice. This phase establishes the canonical
  profile and persistence path, not final policy execution.
