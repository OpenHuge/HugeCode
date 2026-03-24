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
