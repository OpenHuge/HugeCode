# Electron Updates

This document describes the supported HugeCode Electron update modes and the release contract that keeps runtime behavior aligned with packaged artifacts.

## Package-Time Security Contract

HugeCode packages Electron with Forge fuse hardening enabled. The release contract currently requires:

- `RunAsNode=false`
- `EnableNodeOptionsEnvironmentVariable=false`
- `EnableNodeCliInspectArguments=false`
- `EnableEmbeddedAsarIntegrityValidation=true`
- `OnlyLoadAppFromAsar=true`
- `LoadBrowserProcessSpecificV8Snapshot=true`
- `EnableCookieEncryption=true`
- `GrantFileProtocolExtraPrivileges=false`

HugeCode now serves packaged renderer content from `hugecode-app://app/...`. `hugecode://` remains reserved for external launch intents and deep links.

## Launch Intent Rules

- `hugecode://...` stays reserved for external deep links.
- Workspace launches are a separate desktop contract:
  - `hugecode://workspace/open?path=...` is the actionable workspace deep-link form and should normalize to a workspace launch before the renderer sees it
  - command-line folder paths open or focus the matching workspace session
  - command-line file paths normalize to the containing workspace directory while preserving the original file launch target in the desktop launch intent
  - macOS `open-file` events are normalized to the same workspace-launch behavior
  - macOS `open-url` workspace deep links should also normalize to that same behavior
- File-driven launches should be safe to surface in OS recent-documents integrations. Do not collapse them into a generic workspace launch before the main process records the original path.
- Runtime/UI code should treat these as distinct intent kinds instead of parsing raw argv or conflating deep links with workspace opening.
- Cold-start windows consume the pending launch intent through bootstrap. Already-running matching windows should receive the normalized launch intent over the live desktop bridge instead of relying on a reload.
- Cold-start launch intents are queued and drained in order; repeated file or deep-link opens during startup must not overwrite earlier intents.

## Desktop Chrome Rules

- The Electron shell owns both tray and application-menu state.
- `Recent Sessions` in tray, the application menu, the macOS Dock menu, and the Windows Jump List must derive from the same persisted desktop session model.
- Native `Open File...` and `Open Folder...` actions should feed the same launch-intent normalization path as CLI and OS file-open events.
- Native launcher-only commands such as `--new-window` are internal desktop-shell affordances. They must stay in the main-process launch pipeline and must not leak into product UI routing.
- Do not bolt new desktop actions directly into `main.ts`; add them through the menu/tray controller layer so session-driven desktop chrome stays in sync.

## Channel Rules

| Channel                                      | Default behavior | Automatic provider                                | Notes                                                                                        |
| -------------------------------------------- | ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `stable`                                     | automatic        | `update.electronjs.org` via `update-electron-app` | Requires a public GitHub repository, signed macOS builds, and non-prerelease GitHub Releases |
| `beta`                                       | manual           | none by default                                   | Beta stays manual unless `HUGECODE_ELECTRON_UPDATE_BASE_URL` is configured                   |
| `beta` + `HUGECODE_ELECTRON_UPDATE_BASE_URL` | automatic        | static storage feed                               | The feed root must be an absolute HTTP(S) URL and must publish platform/arch update metadata |
| unpackaged/dev                               | disabled         | none                                              | Local development builds never advertise real auto-update support                            |

## Runtime Modes

The Electron main process publishes one update mode as the source of truth:

- `enabled_stable_public_service`
- `enabled_beta_static_feed`
- `disabled_beta_manual`
- `disabled_unpacked`
- `disabled_first_run_lock`
- `unsupported_platform`
- `misconfigured`

UI and release scripts must consume these modes instead of inferring support indirectly.

The Electron renderer must also consume pushed updater state from the main process instead of assuming every update check starts inside the renderer. Native menu actions and future dock/tray update affordances should drive the same updater state stream.

## Environment Surface

- `HUGECODE_ELECTRON_RELEASE_CHANNEL=beta|stable`
- `HUGECODE_ELECTRON_UPDATE_BASE_URL=https://downloads.example.com/hugecode`

`HUGECODE_ELECTRON_UPDATE_BASE_URL` is used only for beta static-feed updates. Stable builds ignore it.

## Artifact Requirements

### Stable

- macOS: packaged app, `.dmg`, and ZIP update artifact
- Windows: packaged app, Squirrel `.exe`, `.nupkg`, and `RELEASES`
- Linux: manual updates only; build artifacts stay release assets, not auto-update feeds

Stable GitHub publishing must be non-prerelease, because the public Electron update service ignores prereleases.

### Beta Static Feed

The feed root must expose per-platform update paths:

```text
<root>/darwin/<arch>/...
<root>/win32/<arch>/...
```

Required metadata:

- macOS: ZIP update metadata generated by the Forge ZIP maker
- Windows: `RELEASES` plus the generated `.nupkg` and setup `.exe`

### Beta Manual

If no static feed root is configured, beta builds remain manual and point users to GitHub Releases. This is intentional, not a partial auto-update state.

## Verification Commands

- `pnpm desktop:electron:verify`
  Verifies package-time updater wiring, packaged runtime contents, and configured fuse hardening.
- `pnpm desktop:electron:make:smoke`
  Verifies current-platform release artifacts and update metadata shape.
- `pnpm desktop:electron:publish:dry-run`
  Reports the effective channel/update mode and fails on artifact or config mismatches.

## macOS Arm64 Signing Rule

- Forge fuse hardening must not rely on a blanket `codesign --deep` fallback for unsigned Apple Silicon packages.
- HugeCode does not run a CI-only post-package ad-hoc re-sign repair for unsigned `darwin/arm64` smoke builds.
- Smoke verification stays focused on packaging and release-contract truth; real macOS signing remains an explicit `packagerConfig.osxSign` release concern backed by proper Apple credentials.
- If a future maintainer adds real `packagerConfig.osxSign`, that explicit Forge signing config becomes the only source of truth for signed macOS artifacts.

## Windows Release-Contract Rule

- Release verification must treat Windows `app.asar` entry paths as platform-variant archive paths, not as POSIX-only strings.
- The verifier must never collapse a path-resolution mismatch into a fake "missing @electron/asar dependency" error.
- If Windows package layout changes, update the release-contract extraction candidates and tests before relaxing the verification step.

## Native Menu Behavior

- Electron exposes `Check for Updates...` through the native application menu.
- Electron also exposes `Copy Support Snapshot`, `Open Incident Log`, `Open Logs Folder`, `Open Crash Dumps Folder`, and `Report Issue...` through the native Help surface.
- That action is intentionally channel-aware:
  - automatic modes trigger the real main-process updater and push state changes to every live renderer window
  - manual beta mode opens GitHub Releases instead of advertising fake auto-update support
  - unsupported or misconfigured modes must never claim automatic update availability
- Support actions must be driven from the same diagnostics truth as the renderer:
  - `Copy Support Snapshot` must copy a canonical support summary built from the same updater state and incident summary used by the issue reporter; pages must not rebuild their own clipboard text
  - `Open Incident Log` opens the bounded desktop incident log when one exists and only falls back to file reveal if direct path opening fails
  - otherwise it falls back to the logs directory instead of assuming a file is present
  - `Open Logs Folder` must open the canonical logs directory via the host path-opening primitive rather than using file-reveal APIs on a directory target
  - `Open Crash Dumps Folder` must open the canonical local crash-dumps directory when Electron exposes one; if no crash-dumps directory is available, the shell should fail soft with a clear user-visible message instead of opening an unrelated path
  - `Report Issue...` opens a prefilled GitHub issue with version, channel, platform, update mode, incident summary metadata, and crash-dump location

## Resilience Contract

- Electron desktop resilience belongs in the main process, not in renderer heuristics.
- HugeCode treats these Electron signals as canonical desktop incidents:
  - `render-process-gone` for renderer crashes and abnormal exits
  - `child-process-gone` for GPU / utility / helper process exits
  - `unresponsive` and `responsive` for BrowserWindow responsiveness transitions
- Renderer crashes should recreate the affected session window instead of leaving a dead shell behind.
- Recovery notifications must be native desktop notifications emitted from the main process.
- Unresponsive-window notifications should be edge-triggered, not spammed repeatedly while the same window remains hung.
- Structured incident logging should distinguish at least renderer crash recovery, child process exits, and temporary window unresponsiveness.
- Desktop incident persistence must remain bounded and supportable:
  - store incidents as local NDJSON under Electron's canonical logs directory
  - cap retained incident history so repeated failures do not create unbounded log growth
  - write logs from the main process with explicit local-file permissions instead of relying on console output alone
- Local crash support should exist even before remote crash infrastructure:
  - start Electron's crash reporter with `uploadToServer: false`
  - keep crash dumps local and include the crash-dumps directory in desktop diagnostics surfaces

## Intentionally Unsupported

- automatic Linux updates
- automatic beta updates without a static feed root
- pretending unpackaged development builds support real auto-updates
- treating stable GitHub prereleases as updateable by the public Electron update service
