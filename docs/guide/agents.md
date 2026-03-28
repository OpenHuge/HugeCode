# HugeCode Agent Guide

This page is the concise repo-orientation guide for agents and operators.
If it conflicts with `AGENTS.md`, follow `AGENTS.md`.

## 30-Second Product Read

HugeCode is a desktop-first mission control for coding agents.
The current product center is supervised delegated engineering work, with two defining capabilities:

- `AutoDrive` for bounded autonomous execution
- multi-backend runtime control for explicit execution placement

The runtime owns execution truth.
The UI is the control plane and review surface.
The trust artifact is the `Review Pack`, backed by the runtime `Ledger`.

## Recent Direction Signals

Recent commits show a consistent direction rather than a broad platform sprawl. The strongest current signals are:

- runtime-owned task truth, checkpoint truth, and review handoff are being closed and frozen
- backend pool operability, diagnostics, and settings grammar are active product work
- `apps/code` is being aligned with runtime truth instead of preserving UI-side reconstruction
- docs and agent entrypoints are being tightened to reduce stale guidance and historical drift

Treat that as the working north star unless a newer active spec explicitly changes it.

## Preferred Discovery Order

Use this order when starting repo-wide work:

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/development/README.md`
5. `docs/workspace-map.md`
6. surface-specific docs such as `.agent/*`, `docs/runtime/*`, or product specs only after the active surface is clear

## Current Repo Shape

- Official product context is `HugeCode`.
- Active app surfaces are `apps/code`, `apps/code-web`, and `apps/code-electron`.
- Core runtime layers are `packages/code-runtime-service-rs`, `packages/code-runtime-host-contract`, and `packages/native-runtime-host-contract`.
- `apps/code-web` is the current Cloudflare-platform web implementation for
  public routes, SSR, and deploy wiring; it is not a second independent
  workspace app.
- `apps/code` is still the main workspace client implementation and does not
  fully replace `apps/code-web` for web deployment tasks.
- `multi-agent`, `sub-agent`, and `parallel-agent` execution are core product
  capabilities, not deprecated experiments.
- The local `Agent Command Center` in `apps/code` is intentionally slim:
  treat it as intent capture + launch readiness + runtime orchestration +
  WebMCP controls, not as
  a local task board, governance dashboard, or audit-log manager.
- `launch readiness` is an advisory summary over runtime truth before launch,
  not a second placement engine or a page-local routing heuristic.
- `continuity readiness` is the separate runtime-backed summary for post-launch
  recovery, handoff, and review continuation. Do not merge it into launch
  readiness or recompute it from page-local thread guesses.
- `takeover bundle` is the canonical runtime-owned per-run continuation object
  for approval, resume, handoff, review follow-up, and sub-agent takeover.
  Treat it as the first continuation truth when present; `continuity readiness`
  is the aggregate summary over those bundles, not a replacement contract.
- `execution reliability` is part of launch readiness when present. Treat it as
  a compact launch-scoped summary over existing diagnostics truth, not as a new
  diagnostics dashboard or runtime contract.
- when runtime publishes `missionLinkage`, `publishHandoff`, or
  `reviewActionability`, Mission Control and Review Pack must consume that truth
  directly instead of rebuilding resume or follow-up rules in UI code.
- when runtime publishes `takeoverBundle`, prefer it over reconstructing
  continuation meaning from `checkpointState`, `missionLinkage`,
  `publishHandoff`, `approvalState`, or `reviewActionability` fragments.
- in Review Pack specifically, prefer `missionLinkage.navigationTarget` for the
  canonical continue path and prefer `reviewActionability.summary` for operator
  follow-up guidance when runtime publishes them.
- the current shipped gate is moderately conservative:
  unavailable diagnostics, open circuit breakers, or a success gate below
  `0.95` block launch; degraded-but-recoverable reliability remains attention.
- the current shipped `launch readiness` surface lives in Mission Control next to
  run-start controls; do not mistake it for a separate runtime contract or a new
  dashboard product area.
- treat post-launch continuity separately:
  checkpoint recovery, cross-device handoff, and review follow-up should be
  explained from runtime-published continuity truth, not by launch gating.
- Extension work is `skills`-first. Do not treat ChatGPT apps/connectors or the
  `/apps` command as part of the active product surface.
- Do not expect a runtime `list-runtime-apps` tool or `appsListV1` app-layer
  compatibility RPC; that discovery path has been removed.
- Runtime/UI work in `apps/code` must stay behind `src/application/runtime/*`.
- Treat the Track 1 runtime lifecycle boundary as frozen:
  - approved product-facing reads flow through
    `features/shared/hooks/useWorkspaceRuntimeToolLifecycle.ts`
  - direct workspace lifecycle snapshot reads are only allowed in the explicit
    debug diagnostics hooks
  - page components must consume derived hook state or the approved
    `application/runtime/ports/runtimeToolLifecycle` presentation helpers
  - do not widen `application/runtime/ports/runtimeToolLifecycle`

## Source Of Truth Ladder

When documents overlap, use this order:

1. `AGENTS.md`
2. `docs/prd.md`
3. `docs/specs/apps/code-product-shape-2026.md`
4. `docs/arch.md`
5. `docs/agents-system-design.md`
6. `docs/specs/code-runtime-spec-2026.md`
7. tracked source, manifests, scripts, and contract packages

Use deeper docs to refine a higher-level source, not to replace it.

## Common Agent Failure Modes

- Reading `docs/archive/**` and treating archived product language or structure as current.
- Treating `docs/plans/**` working notes as more authoritative than active specs or current source.
- Restoring deleted `Keep-Up` or `Reader` names into active code or docs.
- Starting shared workspace-client feature work from `apps/code-web` instead of
  `apps/code`, or starting Cloudflare route/deploy work from `apps/code`
  instead of `apps/code-web`.
- Assuming `apps/code-web` is redundant and moving Cloudflare/Start concerns
  into `apps/code` without an explicit consolidation plan.
- Reintroducing `apps/connectors` as if they were still an active extension
  strategy, instead of using `skills` as the extension model.
- Bypassing `apps/code/src/application/runtime/*` and wiring runtime behavior directly in UI code.
- Citing commands that are not present in the current root `package.json`.
- Running overly broad validation when a narrower gate exists, or skipping contract/boundary checks when a change crosses those surfaces.

## Read By Task

- Repo-wide orientation:
  `docs/README.md`, `docs/workspace-map.md`
- Product and UX framing:
  `docs/prd.md`, `docs/specs/apps/code-product-shape-2026.md`
- Runtime, contracts, backend routing, or review-pack behavior:
  `docs/arch.md`, `docs/agents-system-design.md`, `docs/runtime/README.md`
- Cloudflare web publishing, public routes, or Start/SSR shell work:
  `apps/code-web/README.md`, `apps/code/README.md`, `docs/workspace-map.md`
- Commands and validation:
  `docs/development/README.md`, `docs/testing.md`
- Historical comparison only:
  `docs/archive/README.md`

## Cross-Agent Compatibility

- `AGENTS.md` is the canonical repo-wide instruction file.
- `CLAUDE.md` is the Claude Code compatibility entrypoint.
- `GEMINI.md` is the Gemini CLI compatibility entrypoint.
- Keep these entrypoints aligned so different agents do not receive divergent repository guidance.
- When agents use `gh` for PR handling, reviews, comments, or Actions triage, keep all agent-authored GitHub-facing output in English.

## Validation Defaults

- Isolated changes: `pnpm validate:fast`
- Multi-file or behavior changes: `pnpm validate`
- Shared contracts, CI, or release-risk work: `pnpm validate:full`
- UI/runtime boundary changes: add `pnpm ui:contract`
- Runtime contract changes: add `pnpm check:runtime-contract`
- Desktop/Electron changes: add `pnpm desktop:verify:fast`
- Docs-only changes: skip runtime validation and state `docs-only, no runtime impact`

## Authoring Guidance

- Keep instructions specific, brief, and tied to tracked commands or paths.
- Prefer current source, manifests, and scripts over narrative docs when they disagree.
- Treat `docs/plans/` as temporary working state and `docs/archive/` as historical state.
- Do not let archived naming, frozen experiments, or compatibility leftovers leak back into active docs.
