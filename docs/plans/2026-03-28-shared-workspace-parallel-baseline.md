# Shared Workspace Parallel Baseline

Date: 2026-03-28
Status: active working doc
Branch: `codex/runtime-review-triage-alignment`
Baseline commit: `1f49e81c`
Baseline PR: `#132` <https://github.com/OpenHuge/HugeCode/pull/132>

## Intent

This doc freezes the next shared baseline for HugeCode's composable architecture work.

The goal is not to finish the full architecture in one branch. The goal is to move the current
branch to a state where four lines can progress in parallel without repeatedly editing the same
composition points.

## Shared Baseline

The branch now has three explicit composition seams:

1. Mission control summary source vs composer
   - `packages/code-workspace-client/src/workspace-shell/missionControlSummaryContracts.ts`
   - `packages/code-workspace-client/src/workspace-shell/missionControlSummaryLoader.ts`

2. Snapshot-backed mission control surface bindings
   - `packages/code-workspace-client/src/workspace/missionControlBindings.ts`

3. Shared workspace shell contracts vs hook implementation
   - `packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellContracts.ts`
   - `packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellComposition.ts`

These seams are the approved parallel boundary for the next phase.

## Parallel Tracks

### Track 1: Shared Workspace Shell Composition Root

Status: in progress on the current branch

Goal:

- Keep `workspace-shell` consumers bound to explicit shell contracts instead of hook return-type
  inference.
- Continue moving route/frame/background/data assembly into explicit composition helpers.

Write scope:

- `packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellContracts.ts`
- `packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellComposition.ts`
- `packages/code-workspace-client/src/workspace-shell/useSharedWorkspaceShellState.ts`
- `packages/code-workspace-client/src/workspace-shell/SharedWorkspaceShell.tsx`
- `packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellSections.tsx`

Do not do:

- No runtime RPC changes
- No mission control summary policy rewrite
- No browser/desktop transport changes unless strictly required for wiring

### Track 2: Runtime Mission Control Source Adapters

Goal:

- Normalize mission-control surface sourcing across browser, desktop, and later remote adapters.
- Keep projection bootstrap, snapshot fallback, and review-pack reading behind shared source
  adapter helpers instead of repeating that logic per host.

Primary write scope:

- `packages/code-workspace-client/src/workspace/browserBindings.ts`
- `packages/code-workspace-client/src/workspace/missionControlBindings.ts`
- future desktop/shared host binding entrypoints if needed

Do not do:

- No UI component edits
- No shared shell presentation changes
- No triage label/tone redefinition

### Track 3: Summary And Triage Policy Modules

Goal:

- Move mission/review ranking, readiness, and shared summary policy toward explicit policy modules.
- Keep runtime and shared-shell summary grammar aligned while preserving runtime-owned truth.

Primary write scope:

- `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts`
- `packages/code-workspace-client/src/workspace-shell/missionControlSummaryContracts.ts`
- `packages/code-workspace-client/src/workspace-shell/missionControlSummaryLoader.ts`
- `apps/code/src/application/runtime/facades/runtimeMissionReviewTriage.ts`
- `apps/code/src/application/runtime/facades/runtimeMissionControlFormatting.ts`

Do not do:

- No browser transport edits
- No workspace shell routing or activation policy edits
- No top-level shell component decomposition

### Track 4: Shared Shell UI Consumers And Section Decomposition

Goal:

- Decompose `SharedWorkspaceShell.tsx` into stable, smaller consumers that depend only on
  `SharedWorkspaceShellState`.
- Keep UI work separate from runtime sourcing and policy composition.

Primary write scope:

- `packages/code-workspace-client/src/workspace-shell/SharedWorkspaceShell.tsx`
- `packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellSections.tsx`
- additional section-local components under `packages/code-workspace-client/src/workspace-shell/`

Do not do:

- No runtime binding changes
- No mission control source adapter work
- No summary/triage policy changes except consuming already-exported state

## Dependency Rules

- Track 1 defines the shell-state contracts and composition root.
- Track 2 can depend on mission-control surface binding contracts, but should not edit shell UI.
- Track 3 can depend on summary contracts and runtime triage helpers, but should not edit transport
  adapters.
- Track 4 can depend on exported shell-state contracts, but should not edit runtime or summary
  composers.

## Copyable Task Prompts

### Track 2 Prompt

```text
You are implementing HugeCode Track 2.

Baseline:
- Branch: codex/runtime-review-triage-alignment
- Commit: 1f49e81c
- PR: #132 https://github.com/OpenHuge/HugeCode/pull/132

Start from this exact baseline unless a newer commit on the same PR is explicitly announced as
the new shared head. Do not rebase onto another feature branch.

Goal:
Normalize runtime mission-control source adapters so browser/desktop/remote bindings can reuse the
same mission-control surface composition without duplicating projection bootstrap, snapshot
fallback, or review-pack sourcing logic.

Constraints:
- Preserve existing behavior.
- Do not edit UI components in workspace-shell.
- Do not redefine summary or triage wording.
- Keep runtime-owned truth. Do not move canonical mission/review state into the client.

Required files to inspect first:
- packages/code-workspace-client/src/workspace/missionControlBindings.ts
- packages/code-workspace-client/src/workspace/browserBindings.ts
- packages/code-workspace-client/src/workspace/bindings.ts
- packages/code-workspace-client/src/workspace-shell/missionControlSummaryContracts.ts

Deliverables:
1. Introduce any missing source-adapter contracts/helpers needed to support multiple hosts.
2. Reduce repeated mission-control sourcing logic in browser bindings.
3. Add focused tests for the new source-adapter seam.
4. Keep pnpm validate:fast passing.

Validation:
- pnpm exec vitest --run packages/code-workspace-client/src/workspace/missionControlBindings.test.ts packages/code-workspace-client/src/workspace/browserBindings.test.ts
- pnpm validate:fast
```

### Track 3 Prompt

```text
You are implementing HugeCode Track 3.

Baseline:
- Branch: codex/runtime-review-triage-alignment
- Commit: 1f49e81c
- PR: #132 https://github.com/OpenHuge/HugeCode/pull/132

Start from this exact baseline unless a newer commit on the same PR is explicitly announced as
the new shared head. Do not rebase onto another feature branch.

Goal:
Push mission-control summary and review-triage logic into more explicit policy modules while
keeping runtime and shared-shell semantics aligned.

Constraints:
- Preserve runtime-owned truth.
- Do not edit browser/desktop transport bindings except for wiring already-exported contracts.
- Do not refactor top-level shell UI structure unless required to consume a new exported policy.

Required files to inspect first:
- packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts
- packages/code-workspace-client/src/workspace-shell/missionControlSummaryContracts.ts
- packages/code-workspace-client/src/workspace-shell/missionControlSummaryLoader.ts
- apps/code/src/application/runtime/facades/runtimeMissionReviewTriage.ts
- apps/code/src/application/runtime/facades/runtimeMissionControlFormatting.ts

Deliverables:
1. Identify and extract one more explicit policy seam.
2. Keep shared-shell summary grammar aligned with runtime triage semantics.
3. Add focused tests proving policy ordering/tone/labels remain stable.
4. Keep pnpm validate:fast passing.

Validation:
- pnpm exec vitest --run packages/code-workspace-client/src/workspace-shell/missionControlSummaryLoader.test.ts packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.test.ts apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.test.ts
- pnpm validate:fast
```

### Track 4 Prompt

```text
You are implementing HugeCode Track 4.

Baseline:
- Branch: codex/runtime-review-triage-alignment
- Commit: 1f49e81c
- PR: #132 https://github.com/OpenHuge/HugeCode/pull/132

Start from this exact baseline unless a newer commit on the same PR is explicitly announced as
the new shared head. Do not rebase onto another feature branch.

Goal:
Decompose SharedWorkspaceShell UI consumers so sections depend on the exported
SharedWorkspaceShellState contract instead of hook implementation details, and reduce the size and
coupling of SharedWorkspaceShell.tsx.

Constraints:
- Do not edit browser/runtime transport bindings.
- Do not redefine mission-control summary or triage policy.
- Only consume exported shell-state contracts and composition helpers.

Required files to inspect first:
- packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellContracts.ts
- packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellComposition.ts
- packages/code-workspace-client/src/workspace-shell/SharedWorkspaceShell.tsx
- packages/code-workspace-client/src/workspace-shell/sharedWorkspaceShellSections.tsx

Deliverables:
1. Extract section-local consumers/components behind the shared shell state contract.
2. Reduce direct coupling to useSharedWorkspaceShellState implementation details.
3. Add focused tests for any extracted UI behavior.
4. Keep pnpm validate:fast passing.

Validation:
- pnpm exec vitest --run packages/code-workspace-client/src/workspace-shell/SharedWorkspaceShell.test.tsx
- pnpm validate:fast
```
