# Runtime Session Command Boundary Track 3

## Scope

Track 3 narrows session-command access for thread and composer features without
changing the frozen Track 1 lifecycle boundary.

## Boundary Rules

- `application/runtime/facades/runtimeSessionCommandFacade` is the approved
  workspace-scoped session-command hook surface for UI and feature code.
- `application/runtime/ports/runtimeSessionCommands` remains a compatibility
  shim for existing runtime composition paths. New feature code must not import
  it directly.
- Thread and composer features must consume session commands through the facade
  hook surface, not through `tauriThreads` command ports and not through the
  compatibility shim.
- Track 3 does not widen `application/runtime/ports/runtimeToolLifecycle.ts`
  and does not add page-local lifecycle interpretation.

## Rationale

HugeCode keeps runtime ownership inside `application/runtime/*` while exposing a
small, workspace-scoped hook surface to feature code. This borrows the host-
managed boundary lesson from `pi-mono` without importing its package structure,
runtime model, or naming.

## Current Slice

- Thread hooks now resolve session commands from the facade hook surface.
- Composer had no direct `runtimeSessionCommands` port consumers on this
  baseline; the boundary guard now blocks future additions there too.
