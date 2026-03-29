# 2026-03-29 Next Direction Prompts

## Objective

Use the last several days of `main` branch commits, merged PR history, and the public GitHub repository/PR record to identify the highest-leverage next work for HugeCode, then package that work into agent-ready prompts.

## Direction Summary

The current direction is not broad surface expansion. It is a focused convergence program around three threads:

1. runtime-owned execution truth and continuation truth
2. multi-backend placement, readiness, and checkpoint-aware control flow
3. capability/plugin normalization as the extension model

That reading matches both the product definition and the recent delivery stream:

- The public repo description still anchors HugeCode on `AutoDrive` and `multi-remote server control`, with `Launch Readiness`, `Continuity Readiness`, and `Skills-First Extension` called out as active capabilities.
- `README.md`, `docs/prd.md`, `docs/arch.md`, and `docs/agents-system-design.md` all reinforce the same product center: runtime owns truth, UI is a control plane, and extensions should converge on capabilities/skills instead of connector sprawl.
- Recent merged work clusters around runtime truth cleanup, launch/continuity alignment, capability-aware routing, runtime lifecycle tracks, and kernel/plugin registration instead of adding unrelated product areas.

## Evidence Snapshot

### Product anchors

- Repo description and README position HugeCode as a mission control for coding agents centered on `AutoDrive` and multi-remote control: <https://github.com/OpenHuge/HugeCode>
- `docs/prd.md` explicitly rejects a broad plugin marketplace as the main story and instead keeps extension work subordinate to the core supervised autonomy product.
- `docs/specs/apps/code-product-shape-2026.md` keeps `Launch Readiness` and `Continuity Readiness` as first-class product surfaces.

### Local `main` commit signals

- `f4a0207` `Continue runtime kernel plugin architecture upgrade (#144)`
- `cfad26f` `feat: integrate runtime architecture tracks 1-4 with browser facade adaptation (#143)`
- `9eda7b1` `feat: align runtime review triage surfaces (#132)`
- `011d35f` `refactor: close shared runtime ownership (#129)`
- `af6526b` `feat: align review-pack continuation truth and source launch handshake (#121)`
- `9878d61` `feat: refine runtime routing launch readiness (#125)`
- `66263e7` `feat: converge continuation truth on canonical review-pack actions (#120)`
- `c2d0985` `feat: unify GitHub source ingress with governed runtime launch (#92)`

### Merged PR signals

- PR #144 normalized the runtime kernel around a capability registry and projected a unified plugin catalog across runtime extensions, live skills, repo manifests, and host binders: <https://github.com/OpenHuge/HugeCode/pull/144>
- PR #143 integrated the runtime architecture tracks for lifecycle hooks, session checkpoints, provider capability baseline, and boundary-guarded browser adaptation: <https://github.com/OpenHuge/HugeCode/pull/143>
- PR #125 pushed launch readiness toward explicit blocked/attention/degraded-but-launchable states and aligned summaries across app, shared workspace shell, and runtime service: <https://github.com/OpenHuge/HugeCode/pull/125>
- PR #121 aligned review-pack continuation truth with runtime-owned handoff semantics and fixed the GitHub source launch handshake to `prepare -> approvedPlanVersion -> start`: <https://github.com/OpenHuge/HugeCode/pull/121>
- PR #132 aligned runtime review triage surfaces across Mission Control, Review Queue, and the shared workspace shell: <https://github.com/OpenHuge/HugeCode/pull/132>
- PR #128 completed the Electron-only desktop cutover and demoted old Tauri naming to compatibility debt rather than active architecture: <https://github.com/OpenHuge/HugeCode/pull/128>

## Three Next Directions

## 1. Productize the runtime plugin and capability catalog

### Why this is next

PR #144 did the foundational work: the runtime kernel now exposes a unified catalog over runtime extensions, live skills, repo manifests, permissions, and host binders. The current implementation is strong on normalization and debug visibility, but it is still early for operator-facing product use. The next meaningful step is to turn that kernel truth into a first-class control-plane surface that helps an operator answer:

- what capabilities are available right now
- which plugin source supplied them
- what permissions are missing, degraded, or unsupported
- what action to take when a plugin is not launch-ready

### Outcome

Ship an operator-grade extension readiness surface that consumes runtime-published plugin truth instead of relying on fallback placeholders or debug-only inspection.

## 2. Close the launch-to-continuity runtime loop

### Why this is next

PR #125 strengthened launch readiness, while PR #143 integrated lifecycle hooks, checkpoints, and provider capability baselines. The repo docs and AGENTS instructions are explicit that `Launch Readiness` and `Continuity Readiness` are separate surfaces and must both come from runtime truth. The launch side is now ahead of the post-launch side. The next leverage point is to make continuity equally legible and runtime-backed inside Mission Control and Review Pack.

### Outcome

Expose a canonical continuity summary over checkpoint durability, handoff readiness, review follow-up actionability, and recovery paths without rebuilding those heuristics in pages or hooks.

## 3. Complete source-to-review lineage for GitHub-driven work

### Why this is next

PR #121 fixed the source-launch handshake and converged review-pack continuation semantics, but the user-visible story from GitHub source ingestion to run start to review follow-up still looks fragmented. Recent commits and older merged work around governed ingestion imply that HugeCode wants GitHub-driven work to behave like a first-class runtime source, not a side path. The next step is to make provenance, handshake state, and follow-up actions visible end to end.

### Outcome

Make GitHub-source launches auditable from intake through review, with runtime-owned provenance and consistent operator guidance across web intake, Mission Control, and Review Pack.

## Agent Task Prompts

## Prompt 1: Extension readiness from runtime kernel truth

**Prompt**

You are implementing the next step after the runtime kernel plugin architecture upgrade. The repo already has a capability registry and a unified plugin catalog coming from runtime extensions, live skills, repo manifests, and host binders. Your job is to turn that raw truth into an operator-facing extension readiness surface without violating the existing runtime boundary rules.

Work from these constraints:

- HugeCode remains `runtime-first`; do not invent page-local plugin truth.
- New UI/runtime behavior must enter through `apps/code/src/application/runtime/*`.
- Do not widen `WorkspaceRuntimeScope` or reintroduce direct implementation imports from UI code.
- Treat live skills and repo manifests as first-class plugin sources; do not fallback them to `unsupported` unless runtime truth says so.
- Preserve the current `skills-first` extension model; do not add marketplace language or connector-style product framing.

Primary outcome:

- Add an operator-facing plugin/extension readiness panel in an existing active surface such as Mission Control or Settings.
- The panel must show source, capability support, permission state, and a concise remediation summary for each plugin.
- Runtime-published `host:wasi` and `host:rpc` capability slots must be visible as real readiness facts, not placeholder labels.

Suggested starting points:

- `apps/code/src/application/runtime/kernel/runtimeKernelPlugins.ts`
- `apps/code/src/application/runtime/facades/runtimeKernelPluginProjection.ts`
- `apps/code/src/application/runtime/facades/runtimeWorkspaceMissionControlProjection.ts`
- `apps/code/src/features/workspaces/components/WorkspaceHomeAgentRuntimeOrchestration.tsx`
- `apps/code/src/features/debug/components/DebugRuntimePluginsSection.tsx`
- `packages/code-runtime-service-rs/src/rpc_dispatch_kernel.rs`
- `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`

Acceptance criteria:

- UI reads only derived runtime-facing facade data.
- The panel distinguishes at least `ready`, `attention`, and `blocked` extension states.
- Permission mismatches and unsupported operations are explained with operator-readable wording.
- Existing debug/plugin tests keep passing and new tests cover the new readiness model.
- No new legacy boundary exceptions are added.

Validation:

- Run targeted Vitest suites covering the new facade/projection/hooks/UI.
- Run `pnpm ui:contract`.
- Run the narrowest matching repo validation gate, likely `pnpm validate`.
- Run any targeted Rust contract/runtime tests required by the new plugin readiness fields.

Deliver with:

- updated code
- tests
- a short doc note if new operator semantics need explanation

## Prompt 2: Runtime-backed continuity readiness in Mission Control and Review Pack

**Prompt**

You are closing the gap between launch readiness and post-launch continuity readiness. The repo already established launch readiness, provider capability baselines, runtime lifecycle tracks, and session checkpoint baselines. Your task is to make continuity readiness equally runtime-backed and equally legible across Mission Control and Review Pack.

Work from these constraints:

- `Launch Readiness` and `Continuity Readiness` are separate surfaces. Do not merge them into one generic health card.
- Continuity must consume runtime-published truth such as `checkpoint`, `missionLinkage`, `publishHandoff`, `reviewActionability`, and `takeoverBundle` when present.
- Do not reconstruct recovery or handoff heuristics from page-local state when runtime already publishes the answer.
- Keep Mission Control and Review Pack aligned on the same continuity semantics.
- Preserve the existing UI/runtime boundary and shared workspace client layering.

Primary outcome:

- Add or refine a continuity readiness model that answers:
  - can this run continue safely
  - is there a handoff path
  - is review follow-up still actionable
  - has checkpoint durability degraded enough to block or warn
- Surface that summary in Mission Control and Review Pack using the same underlying facade/projection logic.

Suggested starting points:

- `apps/code/src/application/runtime/facades/runtimeLaunchReadiness.ts`
- `apps/code/src/application/runtime/facades/runtimeReviewContinuationFacade.ts`
- `apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.ts`
- `apps/code/src/application/runtime/facades/runtimeWorkspaceMissionControlProjection.ts`
- `apps/code/src/features/review/components/ReviewQueuePanel.tsx`
- `packages/code-workspace-client/src/workspace-shell/sharedMissionControlSummary.ts`
- `packages/code-runtime-service-rs/src/rpc_dispatch_mission_control_summary.rs`

Acceptance criteria:

- Continuity state is derived from runtime truth and shared across surfaces.
- The model distinguishes blocked, attention, and ready/continue states with explicit reasons.
- Review Pack follow-up guidance prefers runtime-published actionability summaries and navigation targets.
- Mission Control and shared workspace shell do not drift on wording or state mapping.
- Tests cover checkpoint degradation, handoff availability, and actionable review follow-up cases.

Validation:

- Run targeted Vitest suites for runtime facades, Mission Control, and Review Queue/Review Pack UI.
- Run targeted workspace-client tests for shared summary alignment.
- Run targeted Rust tests if mission-control summary RPC payloads change.
- Run `pnpm ui:contract`.
- Run `pnpm validate`.

Deliver with:

- code
- tests
- updated runtime/product docs if the continuity contract becomes more explicit

## Prompt 3: End-to-end provenance for GitHub source launches

**Prompt**

You are extending the recent GitHub-source runtime work so that HugeCode can show clear provenance from source intake through run start and review follow-up. The repo already supports runtime-owned GitHub source ingestion and the `prepare -> approvedPlanVersion -> start` handshake. Your job is to make that path operator-visible and reviewable across the web intake and workspace surfaces.

Work from these constraints:

- GitHub-source launches must stay runtime-owned; do not build a second UI-side launch state machine.
- Preserve the existing host contract and runtime contract discipline if new source-provenance fields are added.
- Keep public/web intake concerns in `apps/code-web` and workspace/runtime concerns in `apps/code` plus shared packages.
- Do not regress the canonical continuation truth work that recently landed in Review Pack.

Primary outcome:

- Surface GitHub source provenance, launch-handshake status, and review follow-up context as a consistent thread from intake to Mission Control to Review Pack.
- Make it obvious which repo/ref/event/comment or source record created the run and whether the runtime launch handshake completed cleanly.
- Prefer runtime-published next actions over inferred local advice.

Suggested starting points:

- `apps/code-web/app/github/githubWebhook.ts`
- `apps/code-web/app/server.ts`
- `packages/code-runtime-service-rs/src/rpc_dispatch_task_sources.rs`
- `packages/code-runtime-host-contract/src/codeRuntimeRpc.ts`
- `apps/code/src/application/runtime/facades/runtimeRepositoryExecutionContract.ts`
- `apps/code/src/application/runtime/facades/runtimeReviewContinuationFacade.ts`
- `apps/code/src/features/review/*`
- `apps/code/src/features/missions/*`

Acceptance criteria:

- A GitHub-driven run exposes source provenance in the runtime-facing UI model.
- Review surfaces can explain which source event launched the work and what the next operator action is.
- The source-launch handshake path remains deterministic and covered by targeted tests.
- Webhook/server intake tests and runtime contract tests remain green.
- Any new UI strings use the existing product language around review, continuation, and runtime truth.

Validation:

- Run targeted web tests for webhook/server behavior.
- Run targeted Vitest suites for the affected runtime facades and review UI.
- Run targeted Rust tests for task-source dispatch and source dedupe/handshake behavior.
- Run `pnpm validate`.

Deliver with:

- code
- tests
- updated docs/spec snippets if the runtime contract changes

## Recommended Branch For This Doc

- `codex/next-direction-prompts-2026-03-29`

## Notes For PR

- This document is intentionally an active working artifact under `docs/plans/`.
- It should be presented as a docs-only strategy artifact with no runtime behavior change.
