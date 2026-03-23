# `@ku0/code-electron`

Experimental Electron desktop shell for HugeCode.

## Goals

- Reuse the existing `apps/code` renderer instead of forking a second React app.
- Keep the renderer sandboxed and route native access through `preload` + `contextBridge`.
- Let Electron coexist with `apps/code-tauri` while the desktop host abstraction is widened.

## Entry Points

- `pnpm desktop:electron:dev`
- `pnpm desktop:electron:package`
- `pnpm desktop:electron:make`
- `pnpm desktop:electron:verify`
