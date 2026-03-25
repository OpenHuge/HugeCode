# GitHub Source Launch Beta MVP

Date: 2026-03-25

This document records the Phase 1 GitHub source ingress MVP that now feeds the same governed runtime path as manual launch, plus the beta-containment work required to keep desktop validation reliable without creating a second desktop roadmap.

## Supported GitHub Source Scenarios

- GitHub issue launch from the desktop Git surface
- GitHub PR follow-up launch from the desktop Git surface
- Repo-scoped execution defaults inherited from `.hugecode/repository-execution-contract.json`

This MVP is intentionally manual-entry only. It does not introduce backlog polling, unattended scheduling, or a GitHub-specific run state machine.

## Unified Launch Path

Both GitHub issue launch and GitHub PR follow-up launch now use the same governed lifecycle as manual runtime launch:

1. UI entry points collect the GitHub source payload plus active workspace context.
2. `githubSourceLaunchNormalization` builds a canonical `taskSource` with source lineage, workspace linkage, repo context, and source-specific instruction text.
3. `runtimeRepositoryExecutionContract` resolves repo defaults for execution profile, backend preference, review profile, validation preset, and access mode.
4. `githubSourceGovernedLaunch` assembles the runtime request and calls `code_runtime_run_prepare_v2`.
5. The same request is then started through `code_runtime_run_start_v2`.
6. Review pack, continuation, takeover, and follow-up continue through the existing runtime-owned review surfaces.

This removes the previous thin `startTask(...)` special case for GitHub launches. GitHub ingress is now an intake variant, not a second execution path.

## Repo Defaults And Execution Context

GitHub launch requests now carry the same routing inputs that manual launch uses, with GitHub-specific source detail added on top:

- `taskSource.kind`
  Uses canonical source kinds such as `github_issue` and `github_pr_followup`.
- `taskSource.repo`
  Derived from the active Git remote when available so repo defaults and downstream review surfaces can explain source lineage consistently.
- `taskSource.workspaceId` and `taskSource.workspaceRoot`
  Bound to the active workspace so continuation and review stay anchored to the same runtime workspace truth.
- `preferredBackendIds`
  Explicit user/backend selection still wins. Otherwise repo source mappings supply defaults.
- `executionProfileId`, `reviewProfileId`, `validationPresetId`, `accessMode`
  Resolved through repository execution contract defaults and source mappings instead of page-local branching.

## Source-Specific Context Policy

GitHub source launch currently applies a conservative beta policy through `autonomyRequest`:

- `autonomyProfile: supervised`
- `wakePolicy.mode: hold`
- `allowAutomaticContinuation: false`
- `sourceScope: workspace_graph`
- `researchPolicy.mode: repository_only`
- `allowNetworkAnalysis: false`
- `requireCitations: true`
- `allowPrivateContextStage: false`

The intent is containment. GitHub source runs must stay reviewable, repo-first, and operator-supervised during beta validation instead of expanding into broad external-context automation.

## Review And Continuation Unification

GitHub source runs now terminate in the same review and continuation model as manual runs:

- review-pack selection continues to read runtime-owned run and review truth
- takeover bundle consumption stays shared
- actionability and intervention availability are still derived from runtime review state
- repo defaults are reused when review follow-up or continuation needs execution, validation, or review inheritance

Operators do not need to remember a GitHub-only follow-up path. Once launched, the run is just another governed runtime run with source lineage attached.

## Beta Containment Hardening

The desktop-side changes in this slice are limited to support the Phase 1 loop:

- GitHub source launches now fail earlier during `prepare_v2`, before execution begins, instead of relying on a thin start-only path.
- Electron restored session state now de-duplicates repeated sessions by session id and workspace fingerprint during startup hydration.
- No new desktop-only product surface, platform-specific workflow, or independent shell roadmap was added in this slice.

## Validation And Smoke Results

Validation for this slice was run on 2026-03-25. Update this section if later runs supersede these results.

- `pnpm exec vitest run apps/code/src/application/runtime/facades/githubSourceLaunchNormalization.test.ts apps/code/src/application/runtime/facades/githubSourceGovernedLaunch.test.ts apps/code/src/application/runtime/facades/runtimeRepositoryExecutionContract.test.ts apps/code/src/application/runtime/facades/runtimeReviewContinuationFacade.test.ts apps/code-electron/src/main/desktopShellState.test.ts apps/code/src/features/app/composition/useDesktopWorkspaceMissionDomain.test.tsx`
  Passed, 6 files and 26 tests.
- `pnpm exec tsc -p apps/code/tsconfig.json --noEmit`
  Passed.
- `pnpm ui:contract`
  Passed.
- `pnpm exec vitest run apps/code/src/features/app/hooks/useGitHubRuntimeTaskLaunchers.test.tsx`
  Passed, 1 file and 3 tests.
- `pnpm exec vitest run apps/code/src/features/app/hooks/useSettingsModalState.test.ts apps/code/src/application/runtime/facades/githubSourceGovernedLaunch.test.ts apps/code/src/features/app/hooks/useGitHubRuntimeTaskLaunchers.test.tsx`
  Passed, 3 files and 13 tests.
- `pnpm test:e2e:smoke`
  Passed on rerun after prebuilding `code-runtime-service-rs`, 13 tests passed in about 1.7 minutes.
- `pnpm test:desktop:smoke`
  Passed, 2 desktop smoke tests.
- `pnpm desktop:verify:fast`
  Passed.
- `pnpm validate`
  Passed after stabilizing an unrelated settings modal test that was timing out under incremental validate load.

## Beta Checklist

- GitHub issue launch reaches `prepare_v2` and `start_v2` through the governed runtime facade.
- GitHub PR follow-up launch reaches the same governed runtime facade.
- GitHub `taskSource` carries workspace and repo lineage.
- Repo source mappings can override execution profile, backend defaults, validation preset, review profile, and access mode.
- Review and continuation stay on shared runtime surfaces.
- Desktop startup rejects duplicate restored sessions instead of silently duplicating recent-session state.
- Smoke and validation gates have current recorded outcomes.

## Core Blockers And Risks

- No functional blocker remains on the GitHub source governed path itself after the final validation run.
- Cold-start e2e environments remain sensitive to Rust runtime compile time. On this machine the first `pnpm test:e2e:smoke` attempt timed out at the default 240000 ms runtime-ready budget before the runtime service finished building. The standard smoke command passed once the runtime service had been prebuilt and warm.
- That startup-budget sensitivity is a beta operational risk, not a GitHub ingress contract failure. If cold-cache CI lanes become a regular beta gate, increase the runtime ready budget or add an explicit runtime-service prewarm step.

## Known Limitations

- This MVP supports manual GitHub-triggered ingress only. It does not poll GitHub or schedule unattended runs.
- The source policy is intentionally restrictive for beta. Repository-only research and no automatic continuation are design choices, not accidental omissions.
- Repo defaults depend on a present and valid repository execution contract. Without it, the launch still works, but falls back to runtime/application defaults.
- The implementation does not introduce a GitHub-specific review surface; it depends on the existing shared review pack and continuation loop being present.

## Follow-Up Recommendations

- Add a runtime-backed e2e fixture that exercises GitHub issue launch through review-pack follow-up with a deterministic fake runtime payload.
- Expand packaging smoke only when shell-owned changes require it; keep desktop validation narrow by default.
- Revisit the GitHub source autonomy policy after beta if evidence shows that broader WebMCP or external research can be governed without creating a second intake path.
