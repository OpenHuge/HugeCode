# Runtime Shared Workspace Migration Matrix

Date: 2026-03-21
Status: active

## Purpose

This matrix defines which capabilities should move into the shared
runtime-backed workspace surface and which must stay in the desktop host.

Use it when migrating code out of `apps/code` and when extending
`WorkspaceClientBindings`.

## Runtime-Eligible Domains

These capabilities belong in shared runtime bindings and should be callable from
both desktop and web shells:

| Domain                    | Binding slice              | Notes                                                      |
| ------------------------- | -------------------------- | ---------------------------------------------------------- |
| App settings              | `runtime.settings`         | Shared app/runtime defaults and gateway profile sync       |
| OAuth and account routing | `runtime.oauth`            | Account, pool, primary-route flows                         |
| Model catalog             | `runtime.models`           | Model list and model metadata reads                        |
| Workspace catalog         | `runtime.workspaceCatalog` | Workspace listing for shared shell selection               |
| Mission Control           | `runtime.missionControl`   | Canonical runtime snapshot reads                           |
| Agent control             | `runtime.agentControl`     | Agent-task lifecycle and approval decisions                |
| Threads                   | `runtime.threads`          | Thread list/create/resume/archive                          |
| Git                       | `runtime.git`              | Contract-backed git reads and write actions                |
| Workspace files           | `runtime.workspaceFiles`   | File list/read for shared previews and review flows        |
| Review                    | `runtime.review`           | Review-pack summaries derived from canonical runtime truth |

## Host-Only Domains

These capabilities stay in desktop host bindings and must not be reintroduced as
runtime-backed UI behavior:

| Domain                  | Binding slice      | Notes                                             |
| ----------------------- | ------------------ | ------------------------------------------------- |
| Dialogs                 | `host.dialogs`     | Native dialogs remain host-owned                  |
| External opener         | `host.opener`      | URL and file-manager handoff stay host-owned      |
| Menu chrome             | `host.menu`        | Desktop context menus and accelerators            |
| Window chrome           | `host.window`      | Desktop window sizing, focus, and positioning     |
| Native file affordances | `host.nativeFiles` | Native picker and file URL conversion             |
| Updater                 | `host.updater`     | Packaging and update lifecycle stays desktop-only |

## Boundary Rules

- Shared workspace code in `packages/code-workspace-client` must not import
  `@tauri-apps/*`.
- Web shell code in `apps/code-web` must not import desktop-only
  `application/runtime/ports/tauri*`.
- Desktop runtime-backed behavior must enter through `RuntimeKernel` or
  narrower runtime ports, not by reassembling raw runtime clients in UI code.
- New shared workspace features must extend `WorkspaceClientBindings` first and
  then wire desktop/web implementations to the same binding shape.
