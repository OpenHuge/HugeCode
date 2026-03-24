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
- Native launcher surfaces are first-class:
  - macOS Dock menu exposes `New Window` plus recent workspaces from the persisted session model
  - Windows Jump List exposes a `New Window` task plus recent workspaces from the same session model
- Actionable workspace deep links are first-class:
  - `hugecode://workspace/open?path=...` is normalized to the same workspace launch flow as CLI and Finder opens
  - directory targets open or focus the matching workspace window
  - file targets preserve the original file path and normalize the workspace session to the containing directory
- Command-line workspace launches follow modern desktop-editor behavior:
  - launching HugeCode with a folder path opens or focuses that workspace window
  - launching HugeCode with a file path opens the containing workspace directory while preserving the original file target in the launch intent
  - `--new-window` is the reserved internal launcher flag for opening a duplicate window from native platform launchers such as the Windows Jump List
  - macOS `open-file` events are normalized to the same workspace-launch flow
  - macOS `open-url` workspace deep links are also normalized to that flow
  - file-driven launches are added to the OS recent-documents surface when Electron exposes it
- Already-running windows receive live launch intents over the desktop bridge; cold-start windows consume the same intent through the bootstrap path.
- Cold-start launch intents are queued and drained in order so repeated file or deep-link opens are not overwritten during startup.

## Desktop Chrome

- HugeCode now maintains both a tray menu and a state-driven application menu.
- The application menu exposes:
  - `New Window`
  - `Open File...`
  - `Open Folder...`
  - `About HugeCode`
  - `Open Recent Session`
  - `Open Recent File` on macOS via the native recent-documents role
  - `Check for Updates...`
- The menu is rebuilt from the persisted desktop session state instead of hard-coded one-off actions in `main.ts`.
- Native file and folder pickers normalize into the same launch-intent flow as CLI, Finder, and deep-link workspace opens.
- `Check for Updates...` follows the same updater source of truth as the in-app update UI:
  - automatic channels trigger a real Electron update check in the main process
  - manual beta builds open GitHub Releases instead of pretending automatic update support
- Electron pushes updater state changes to live renderer windows, so native menu-triggered checks and in-app checks stay in sync.

## Resilience

- HugeCode treats renderer crashes and unresponsive windows as first-class desktop incidents.
- The shell listens for Electron `render-process-gone`, `child-process-gone`, `unresponsive`, and `responsive` signals in the main process instead of trying to infer failures from renderer state.
- When a renderer process exits unexpectedly, HugeCode recreates the affected session window and surfaces a native recovery notification.
- Unresponsive windows raise a single native notification until the window becomes responsive again; repeat notifications are intentionally suppressed while the same incident is active.
- Child-process failures are logged as structured desktop incidents so future diagnostics can distinguish renderer recovery from background-process churn.

## macOS Arm64 Packaging

- HugeCode disables Forge's fallback `codesign --deep` fuse re-sign path for unsigned Apple Silicon builds.
- Forge still flips package-time fuses, but post-package arm64 bundles are re-signed with explicit ad-hoc signing through `@electron/osx-sign`.
- This matches Electron's normal deep-first signing model more closely and avoids the ambiguous-bundle failure that can surface on GitHub macOS arm64 runners.
