# `@ku0/code-electron`

Experimental Electron desktop shell for HugeCode.

## Goals

- Reuse the existing `apps/code` renderer instead of forking a second React app.
- Keep the renderer sandboxed and route native access through `preload` + `contextBridge`.
- Let Electron coexist with `apps/code-tauri` while the desktop host abstraction is widened.

## Update Channels

- `stable`: automatic updates use `update.electronjs.org` against signed public GitHub Releases. Stable publishes must not be prereleases.
- `beta`: manual by default. Automatic beta updates are enabled only when `HUGECODE_ELECTRON_UPDATE_BASE_URL` points at an HTTP(S) static feed root containing per-platform update metadata.
- unpackaged development builds never pretend to support real auto-updates.

## Package-Time Hardening

- Electron Forge flips package-time fuses for the distributed app.
- Enabled hardening:
  - `RunAsNode=false`
  - `EnableNodeOptionsEnvironmentVariable=false`
  - `EnableNodeCliInspectArguments=false`
  - `EnableEmbeddedAsarIntegrityValidation=true`
  - `OnlyLoadAppFromAsar=true`
  - `LoadBrowserProcessSpecificV8Snapshot=true`
  - `EnableCookieEncryption=true`
  - `GrantFileProtocolExtraPrivileges=false`
- Packaged HugeCode serves renderer content from `hugecode-app://app/...`, not `file://`.
- `hugecode://` remains the external deep-link scheme. Do not reuse it for internal renderer asset loading.

## Release Environment

- `HUGECODE_ELECTRON_RELEASE_CHANNEL=beta|stable`
- `HUGECODE_ELECTRON_UPDATE_BASE_URL=https://downloads.example.com/hugecode`

When beta auto-update is enabled, the static feed must publish assets under:

- `darwin/<arch>/...` including the ZIP update metadata
- `win32/<arch>/...` including `.exe`, `.nupkg`, and `RELEASES`

Linux desktop builds remain manual-update only.

## Entry Points

- `pnpm desktop:electron:dev`
- `pnpm desktop:electron:package`
- `pnpm desktop:electron:make`
- `pnpm desktop:electron:make:smoke`
- `pnpm desktop:electron:publish:dry-run`
- `pnpm desktop:electron:verify`

## Launch Behavior

- `hugecode://...` remains the external deep-link scheme.
- Packaged renderer content loads only from `hugecode-app://app/...`.
- Actionable workspace deep links are first-class:
  - `hugecode://workspace/open?path=...` is normalized to the same workspace launch flow as CLI and Finder opens
  - directory targets open or focus the matching workspace window
  - file targets preserve the original file path and normalize the workspace session to the containing directory
- Command-line workspace launches follow modern desktop-editor behavior:
  - launching HugeCode with a folder path opens or focuses that workspace window
  - launching HugeCode with a file path opens the containing workspace directory while preserving the original file target in the launch intent
  - macOS `open-file` events are normalized to the same workspace-launch flow
  - macOS `open-url` workspace deep links are also normalized to that flow
  - file-driven launches are added to the OS recent-documents surface when Electron exposes it
- Already-running windows receive live launch intents over the desktop bridge; cold-start windows consume the same intent through the bootstrap path.
- Cold-start launch intents are queued and drained in order so repeated file or deep-link opens are not overwritten during startup.

## Desktop Chrome

- HugeCode now maintains both a tray menu and a state-driven application menu.
- The application menu exposes:
  - `New Window`
  - `About HugeCode`
  - `Open Recent Session`
- The menu is rebuilt from the persisted desktop session state instead of hard-coded one-off actions in `main.ts`.
