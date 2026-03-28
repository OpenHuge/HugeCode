# Electron-Only Desktop Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Retire the Tauri desktop host and make Electron the only supported HugeCode desktop shell.

**Architecture:** Flip the repository-wide desktop entrypoints and validation lanes to Electron first, then remove renderer-side direct Tauri dependencies by routing desktop-only capabilities through the existing Electron bridge and web/runtime-gateway fallbacks. After the renderer compiles and tests in Electron-only mode, delete `apps/code-tauri` and all remaining Tauri-owned CI, docs, and package references.

**Tech Stack:** pnpm workspace, Turbo, React 19, Vite, Electron 41, Vitest, GitHub Actions

---

### Task 1: Establish the Electron-only branch contract

**Files:**

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `README.md`
- Modify: `docs/development/README.md`
- Modify: `docs/workspace-map.md`

**Step 1: Flip root desktop commands**

- Make `dev:desktop`, `desktop:verify*`, and `desktop:build*` point at `@ku0/code-electron`.
- Remove `desktop:electron:*` duplication once Electron becomes the default desktop host path.

**Step 2: Remove Tauri from workspace metadata**

- Delete `apps/code-tauri` from root workspaces.
- Update repo narrative from `apps/code` + `apps/code-tauri` to `apps/code` + `apps/code-electron`.

**Step 3: Update top-level docs**

- Rewrite desktop setup, validation, and workspace-role language so Electron is canonical and Tauri is retired.

### Task 2: Remove renderer hard dependencies on `@tauri-apps/*`

**Files:**

- Modify: `apps/code/package.json`
- Modify: `apps/code/vite.config.ts`
- Modify: `packages/code-platform-interfaces/src/index.ts`
- Modify: `packages/shared/src/runtimeGatewayBrowser.ts`
- Modify: `packages/code-application/src/desktopHostFacade.ts`
- Modify: `apps/code/src/bootstrap/runtimeBootstrap.tsx`
- Modify: `apps/code/src/application/runtime/ports/desktopHostEnvironment.ts`
- Modify: `apps/code/src/application/runtime/ports/tauriOpener.ts`
- Modify: `apps/code/src/application/runtime/ports/tauriNotifications.ts`
- Modify: `apps/code/src/application/runtime/ports/tauriUpdater.ts`
- Modify: `apps/code/src/application/runtime/ports/tauriFiles.ts`
- Modify: `apps/code/src/application/runtime/ports/desktopHostWindow.ts`
- Modify: relevant tests under `apps/code/src/**` and `packages/**`

**Step 1: Remove the `tauri` runtime host value**

- `DesktopRuntimeHost` and browser runtime detection must become Electron-or-browser only.
- Stop writing `data-tauri-runtime="true"` anywhere in bootstrap paths.

**Step 2: Replace direct Tauri imports with bridge-backed or browser fallbacks**

- Desktop shell operations (`openExternalUrl`, notifications, updater, window label/version, file reveal/open) should prefer `window.hugeCodeDesktopHost`.
- Browser-safe fallbacks should remain intact for web/runtime-gateway usage.

**Step 3: Keep compatibility ports compiling**

- Where port file names still contain `tauri`, preserve stable import paths for now but remove Tauri package imports from their implementation.
- Update unit tests to assert Electron or browser behavior instead of Tauri detection.

### Task 3: Retire Tauri-owned validation, CI, and docs

**Files:**

- Modify: `scripts/check-desktop-capabilities.mjs`
- Modify: `scripts/validate.mjs`
- Modify: `.github/workflows/desktop.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/codeql.yml`
- Modify: `.github/workflows/_reusable-ci-pr-affected-build.yml`
- Modify: `.github/workflows/_reusable-ci-pr-affected-tests.yml`
- Modify: `.github/workflows/_reusable-ci-quality-baseline.yml`
- Modify: `.github/workflows/_reusable-ci-runtime-contract-parity.yml`
- Modify: `.github/dependabot.yml`
- Modify: electron-focused docs under `docs/development/**`, `docs/runtime/**`, `docs/specs/**`, `docs/arch.md`, `docs/agents-system-design.md`

**Step 1: Drop Tauri-specific gates**

- Remove capability checks that inspect `apps/code-tauri/src-tauri/capabilities`.
- Remove Tauri-specific build/test branches from `validate.mjs`.

**Step 2: Promote Electron workflows**

- Make desktop CI point at Electron verify/package lanes.
- Remove Tauri-owned path filters, caches, and artifact paths.

**Step 3: Rewrite normative docs**

- Update architecture and runtime docs so the active desktop host is Electron.

### Task 4: Delete the retired Tauri app surface

**Files:**

- Delete: `apps/code-tauri/**`
- Modify: any remaining source, tests, or docs that still reference `apps/code-tauri`

**Step 1: Remove the package and build surface**

- Delete the entire `apps/code-tauri` directory once no scripts, workflows, or source imports depend on it.

**Step 2: Sweep residual references**

- Remove the last `apps/code-tauri` mentions from docs, scripts, and workflow filters.

**Step 3: Reinstall and re-lock if needed**

- Run `pnpm install` if workspace manifests changed enough to require lockfile or module graph updates.

### Task 5: Validate the Electron-only desktop path

**Files:**

- Modify tests only if validation reveals missing coverage

**Step 1: Run focused package checks**

- `pnpm --filter @ku0/code typecheck`
- `pnpm --filter @ku0/code test`
- `pnpm --filter @ku0/code-electron typecheck`
- `pnpm --filter @ku0/code-electron test`

**Step 2: Run repo-level gates for this migration**

- `pnpm validate`
- `pnpm desktop:verify`

**Step 3: Record residual risk**

- If any remaining `tauri*` file names survive as compatibility aliases, document that as naming debt with follow-up scope.
