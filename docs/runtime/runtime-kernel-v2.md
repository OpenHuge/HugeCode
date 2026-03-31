# Runtime Kernel v2

Date: 2026-03-22
Status: Active

## Decision

HugeCode now treats the `runtime kernel v2` run lifecycle as the preferred
truth-first evolution path for runtime planning, execution, and review.

The v2 path exists to move task clarification, context shaping, execution
planning, and review truth back into the runtime instead of letting `apps/code`
rebuild those semantics in facades or page-local state.

## Canonical v2 surfaces

The shared host contract now exposes these canonical methods:

- `code_runtime_run_prepare_v2`
- `code_runtime_run_start_v2`
- `code_runtime_run_get_v2`
- `code_runtime_run_subscribe_v2`
- `code_runtime_review_get_v2`
- `code_runtime_run_resume_v2`
- `code_runtime_run_intervene_v2`

`code_runtime_run_prepare_v2` is the new pre-execution planning surface.
It returns runtime-owned preparation truth:

- `runIntent`
- `contextWorkingSet`
- `executionGraph`
- `approvalBatches`
- `validationPlan`
- `reviewFocus`

These fields are the canonical runtime summary for launch preparation. New UI
surfaces must read them instead of re-deriving intent clarity, repo context,
approval grouping, or validation scope locally.

## Compatibility posture

The v2 contract is canonical for new runtime planning and review work.
The legacy `runtimeRunStart/runtimeRunSubscribe/runtimeRunResume/...` methods
remain in place as a compatibility path during migration.
Thread/turn lifecycle surfaces (`code_threads_*`, `code_thread_live_*`,
`code_turn_*`) remain available only as explicit compatibility boundaries for
thread-specific conversational flows; they are not the canonical product
lifecycle for launch, resume, intervene, or review follow-up.
Raw `subscribeAppServerEvents(...)` usage is now expected to stay inside the
shared thread event router and thread live compat subscription only. Non-thread
product flows should consume `runtime/updated` scopes instead of growing the
legacy app-server event surface.
Legacy account login/update notifications are no longer a supported product
event path; OAuth/account refresh should flow through `runtime/updated` with the
`oauth` scope instead.

Retirement readiness is metered through:

- `runtime_legacy_lifecycle_usage` for remaining thread/turn RPC usage.
- `runtime_legacy_event_translation` for runtime-host events still translated
  onto legacy app-server slash methods.

Current v2 execution and review reads may still reuse compat-backed runtime
projections under the hood while the Rust runtime converges on a smaller native
kernel. That is acceptable during migration because:

- the v2 contract shape is already frozen
- the control plane now consumes the v2 shape directly
- new product meaning must land in v2 payloads, not in further v1 expansion

No new product feature should depend on growing legacy v1 run payloads when the
same meaning belongs in v2 task preparation, run truth, or review truth.

## Client boundary rule

`apps/code` remains the control plane, not the execution brain.

This means:

- shared `RuntimeClient` methods should expose v2 lifecycle operations directly
- `src/services/*` may adapt transport details, but must not invent runtime
  planning truth
- `src/application/runtime/*` should migrate toward consuming v2 records as the
  primary run/review source
- Mission Control, Review Pack, and launch surfaces should prefer runtime-owned
  v2 summaries over UI-side reconstruction

## Migration direction

Near-term migration should move in this order:

1. shared contract and runtime client support
2. control-plane adapters and service bridges
3. app-runtime facades
4. page-level consumers

This order keeps runtime truth stable while shrinking UI-side orchestration
debt.
