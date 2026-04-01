# UI Control Plane Architecture

## Final shape

- `packages/code-workspace-client` is the shared workspace UI core.
- Shared workspace UI consumes `WorkspaceNavigationAdapter` and never touches browser history directly.
- Web navigation truth is owned by TanStack Router through `apps/code-web/app/webWorkspaceNavigation.ts`.
- Desktop navigation truth is owned by `apps/code/src/features/workspaces/hooks/workspaceRoute.ts`.
- Externally owned route and runtime-mode state is exposed through `useSyncExternalStore` snapshots.
- Web dependency injection flows through TanStack Router context in `apps/code-web/app/routerContext.ts`.
- Shared host access is intent-oriented through `bindings.host.intents`.
- `apps/code/src/MainAppContainerCore.tsx` is now a host wrapper; desktop feature composition lives in `apps/code/src/features/app/composition/useDesktopWorkspaceFeatureComposition.tsx`.
- Desktop workspace/git/terminal/clone orchestration is isolated in `apps/code/src/features/app/composition/useDesktopWorkspaceProjectDomain.ts`.
- Desktop thread/account/draft orchestration is isolated in `apps/code/src/features/app/composition/useDesktopWorkspaceThreadDomain.ts`.
- Desktop conversation/composer/handler orchestration is isolated in `apps/code/src/features/app/composition/useDesktopWorkspaceConversationDomain.ts`.
- Desktop mission/review/GitHub launch orchestration is isolated in `apps/code/src/features/app/composition/useDesktopWorkspaceMissionDomain.ts`.
- Desktop chrome/layout/settings/modals composition is isolated in `apps/code/src/features/app/composition/useDesktopWorkspaceChromeDomain.ts`.
- Desktop layout-node composition now flows through nested `shell`, `conversation`, `gitReview`, and `runtime` contracts instead of one flattened mega-options object.
- Desktop layout bridge builders now consume those same domain contracts directly rather than rehydrating a single resolved mega-param object.

## Control-plane boundaries

### Runtime composition boundary

- Shared UI and shell adapters consume runtime-backed activation, invocation, and composition outputs.
- Shared UI must not assemble capability truth directly from raw extension lists, live-skill listings, or host publication side effects.
- Desktop, web, and WebMCP host adapters may expose transport state, but transport state is not composition truth.
- Publication and bridge registration are adapter concerns; discoverability and executability remain invocation-plane concerns.

### Shared client

- Reads route selection from `WorkspaceNavigationAdapter`.
- Derives active workspace from catalog data plus route snapshot.
- Reads runtime mode from runtime gateway external-store bindings.
- Consumes stable platform UI component references from bindings.

### Web

- Router context is the DI container for workspace bindings.
- Workspace selection is serialized in TanStack Router-owned `/app` search state.
- Route-facing code reads bindings from router context instead of assembling local singletons.

### Desktop

- Desktop host wiring remains adapter-only.
- Browser history parsing and persisted restore selection are unified behind a single desktop navigation adapter.
- Name-based workspace routes are canonicalized back to workspace ids to keep one authoritative route shape.
- `useDesktopWorkspaceFeatureComposition` is now a thin orchestrator over project, thread, conversation, mission, and chrome domain hooks.
- Desktop app-frame props are assembled at the chrome domain boundary instead of being built directly in the host wrapper.
- `useMainAppLayoutNodesState` accepts nested desktop layout contracts and hands each bridge builder its own domain contract.
- `useLayoutNodes` orchestrates split node builders (`buildSidebarNode`, `buildMessagesNode`, `buildComposerNode`, `buildPrimaryChromeNodes`, `buildGitNodes`, `buildSecondaryNodes`) instead of one primary layout hotspot.

## Intent-first host surface

- Shared UI depends on explicit intents such as OAuth launch and popup binding flows.
- Broad capability bags and `available` toggles are not the shared UI contract anymore.
- Desktop keeps the least-privilege desktop host mapping inside host/runtime adapters rather than exposing raw host bridges to shared code.
