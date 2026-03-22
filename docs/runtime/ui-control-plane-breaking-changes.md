# UI Control Plane Breaking Changes

## Shared workspace client

- `workspaceShellRoute.ts` was removed. Callers must use `workspace-shell/workspaceNavigation.ts`.
- `WorkspaceClientBindings` now requires `navigation: WorkspaceNavigationAdapter`.
- Shared workspace UI no longer reads or mutates `window.history` directly.
- `runtimeGateway` bindings now expose external-store semantics through `readRuntimeMode` and `subscribeRuntimeMode`.
- `platformUi.workspaceRuntimeShell` and ad hoc lazy factories were replaced by stable component references:
  - `platformUi.WorkspaceRuntimeShell`
  - `platformUi.WorkspaceApp`

## Host bindings

- `host.oauth` was replaced by `host.intents`.
- Broad host capability bags are no longer the shared UI contract.
- Shared callers should request a user intent, not inspect desktop/web availability flags.

## Web shell

- Route-facing bindings are no longer assembled inside route components.
- Web callers that need shared workspace bindings must obtain them from TanStack Router context.

## Desktop

- Desktop workspace selection is route-adapter owned.
- Persisted active-workspace restore no longer competes with route state through effect-driven sync loops.
- Workspace-name routes may normalize to canonical workspace-id routes after resolution.
