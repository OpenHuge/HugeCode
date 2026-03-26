# Desktop PR Check Fast Path Design

**Date:** 2026-03-26

## Goal

Reduce desktop pull-request latency for non host-owned changes by replacing the Linux-only fast-path full Tauri build with a cheaper desktop integration proof.

## Context

- `Desktop (Tauri)` already distinguishes host-owned PRs from frontend/runtime-only PRs.
- The remaining Linux-only PR fast path still spent most of its time in `Build Tauri app (fast verify)`.
- Real GitHub evidence from run `23590509800` showed:
  - setup-desktop-build-env: about 65s
  - local frontend prebuild: about 5s
  - Tauri build step: about 5m31s
  - sccache Rust hit rate: 0.00%

## Chosen Approach

For non host-owned PR desktop verification:

1. Keep the local frontend prebuild so desktop-facing frontend surfaces still prove they build.
2. Replace the full Tauri debug build with:
   - `pnpm check:desktop-capabilities`
   - `pnpm --filter @ku0/code-tauri run check`
3. Teach `apps/code-tauri/scripts/check-fast.mjs` to skip `cargo check` entirely when CI base/head refs show that no Rust inputs changed.

## Why This Approach

- It preserves full Tauri build proof for higher-risk paths:
  - host-owned PRs
  - manifest-sensitive PRs
  - `push` to `main`
  - release workflows
- It sharply reduces the slowest remaining optional PR lane for frontend/runtime-only desktop changes.
- It keeps the rule easy to reason about:
  - frontend/runtime desktop impact gets a fast integration gate
  - host/runtime shell changes keep the full latest-base build proof

## Non-Goals

- No change to merge-queue rules, required checks, or mainline release coverage.
- No attempt to solve general Rust compilation speed or sccache miss behavior in this change.
- No change to Windows/macOS host-owned matrix behavior.

## Validation

- Add workflow regression coverage for the new `verification_mode: check` fast path.
- Add `check-fast` script coverage proving CI diff refs skip cargo work when no Rust inputs changed.
- Run targeted workflow tests, workflow governance, and `validate:full` to confirm only the existing unrelated root failures remain.
