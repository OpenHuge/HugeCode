# Web Core / Thin Shell Architecture Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Converge the frontend toward a shared Web Core with thin Tauri and Electron shells, starting by freezing new platform leakage and then extracting platform interfaces before any large orchestration move.

**Architecture:** Keep `apps/code-web` and the desktop renderer bootstraps thin, introduce explicit platform-interface boundaries first, then migrate application orchestration behind injected facades. Use compatibility wrappers during the transition so the branch stays releasable after every phase.

**Tech Stack:** TypeScript, React 19, pnpm 10, Turbo, Vite 8, Electron 41, Tauri v2, Vitest

---

## External Guidance Used

- Electron official guidance continues to favor `contextIsolation`, narrow preload APIs, and IPC exposure by explicit whitelist rather than wide renderer access.
  Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation
  Source: https://www.electronjs.org/docs/latest/tutorial/ipc
- VS Code’s architecture still centers on shared application logic with environment-specific service implementations and process boundaries.
  Source: https://github.com/microsoft/vscode/wiki/source-code-organization
  Source: https://code.visualstudio.com/blogs/2022/11/28/vscode-sandbox
- Ports-and-adapters remains the right abstraction for moving host capabilities behind interfaces instead of sprinkling platform branches through UI code.
  Source: https://alistair.cockburn.us/hexagonal-architecture

## Phase Order

### Phase 0: Freeze New Architecture Debt

**Intent:** Add hard guardrails so new code cannot leak platform APIs into shared UI paths while the migration is in progress.

**Files:**

- Create: `scripts/check-platform-boundaries.mjs`
- Modify: `scripts/lib/ui-service-boundary.mjs`
- Modify: `package.json`
- Create: `docs/plans/2026-03-23-web-core-thin-shell-architecture-upgrade.md`

**Steps:**

1. Add a boundary checker that scans `apps/code-web`, `packages/code-workspace-client`, and future `code-domain` / `code-application` / `code-platform-interfaces` packages.
2. Fail on direct `@tauri-apps/*`, `electron`, `ipcRenderer`, or `window.hugeCodeDesktopHost` usage outside allowed adapter surfaces.
3. Wire the new checker into `pnpm ui:contract`.
4. Validate with `pnpm check:platform-boundaries` and `pnpm ui:contract`.
5. Commit and push as the Phase 0 baseline.

### Phase 1: Introduce Shared Platform Interfaces

**Intent:** Create one canonical capability package and move current desktop capability types onto it without changing feature orchestration yet.

**Files:**

- Create: `packages/code-platform-interfaces/**`
- Modify: `apps/code/src/application/runtime/ports/desktopHostBridge.ts`
- Modify: `apps/code/src/application/runtime/ports/tauriEnvironment.ts`
- Modify: `apps/code/src/application/runtime/ports/tauriOpener.ts`
- Modify: `apps/code-electron/src/shared/ipc.ts`
- Modify: `apps/code-electron/src/preload/preload.ts`
- Modify: `apps/code-electron/src/main/desktopShellState.ts`

**Steps:**

1. Define shared desktop capability types and capability-container interfaces in `@ku0/code-platform-interfaces`.
2. Re-export or wrap the old `desktopHostBridge` types from the new package so current imports remain stable.
3. Point Electron shared IPC and preload types at the package instead of local duplicate types.
4. Keep old runtime ports as compatibility shims.
5. Validate with targeted Vitest, typecheck, and `pnpm desktop:electron:verify`.
6. Commit and push as Phase 1.

### Phase 2: Start Pulling Orchestration into Application Facades

**Intent:** Move selected desktop-facing workflow orchestration out of feature hooks and into application-facing controllers/facades.

**First candidates:**

- runtime environment and host detection
- workspace shell boot orchestration
- notification and shell/reveal flows

**Guardrail:** No new facade should import concrete platform APIs directly.

### Phase 3: Converge Shared Workspace Logic into the Web Core

**Intent:** Make `packages/code-workspace-client` the default shared implementation surface for workspace composition and state assembly.

**Guardrail:** Do not let the shared package absorb platform adapters or host shell logic.

### Phase 4: Thin Tauri and Electron Shells Further

**Intent:** Limit desktop shells to lifecycle, bridge exposure, and packaging/security boundaries.

**Guardrail:** No workflow state, screen state, or page decision logic in Tauri commands, Electron main, or preload.

### Phase 5: Remove Compatibility Layers

**Intent:** Delete direct platform imports, legacy bridge wrappers, and obsolete compatibility entrypoints once the new path is fully adopted.

## Definition Of Done Per Phase

- New package and boundary contracts are documented.
- Validation commands for that phase pass locally.
- The branch remains bootable after the phase commit.
- The phase is pushed before the next phase begins.
