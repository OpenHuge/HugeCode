# Textarea Family Evidence

## Status

- Family: `Textarea`
- Evidence strength: governed family
- Reason: `Textarea` now participates in the shared UI governance baseline through promoted docs, shared contract coverage, app compat evidence, representative product adoption evidence, and existing browser-visible proof.

## Current Local Evidence

| Evidence type         | Source                                                                                 | What it proves                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Shared implementation | `packages/design-system/src/components/Textarea.tsx`                                   | The shared library exposes a stable multiline text control with label, description, error, disabled, and invalid wiring.                |
| App compat bridge     | `apps/code/src/design-system/components/textarea/TextareaPrimitives.tsx`               | `apps/code` routes through a normalized app-owned compat bridge instead of a divergent local implementation.                            |
| Product surfaces      | `ComposerInput`, `AcpBackendEditorDialog`, `FileEditorCard`, `GitDiffPanelModeContent` | The family is used across representative runtime-facing product surfaces instead of a single weak-anchor scene.                         |
| Verification fixture  | `apps/code/src/features/git/components/GitInspectorDetailVisualFixture.tsx`            | The family remains rendered in a deterministic browser-visible scene tied to the Git inspector design-language checks.                  |
| Shared component test | `packages/design-system/src/components/Textarea.test.tsx`                              | The shared control keeps its accessible description, invalid wiring, and field shell behavior.                                          |
| UI package test       | `packages/ui/src/components/Textarea.test.tsx`                                         | The promoted `@ku0/ui` surface keeps helper/error mapping intact.                                                                       |
| App compat test       | `apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx`          | The app compat layer preserves `error -> invalid`, default sizing, and passthrough semantics.                                           |
| Playwright smoke      | `tests/e2e/src/code/design-system-fixture-smoke.spec.ts`                               | The `git-inspector-detail` fixture renders the textarea in a real browser session without module failures, Vite 500s, or boot fallback. |

## Evidence Layer Matrix

| Layer                   | Status  | Current source                                                                                            | Gate meaning                                                                         |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Shared implementation   | Present | `packages/design-system/src/components/Textarea.tsx`                                                      | The family exists in the shared library.                                             |
| Public promotion        | Present | `packages/ui/src/components/PublicComponents.mdx`                                                         | The family is promoted as a shared public primitive.                                 |
| Shared contract tests   | Present | `packages/design-system/src/components/Textarea.test.tsx`, `packages/ui/src/components/Textarea.test.tsx` | Shared and public wrappers keep the contract stable.                                 |
| App compat bridge       | Present | `apps/code/src/design-system/components/textarea/TextareaPrimitives.tsx`                                  | `apps/code` routes through a normalized compat layer.                                |
| App compat test         | Present | `apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx`                             | The app bridge keeps its compatibility semantics.                                    |
| Representative adoption | Present | `ComposerInput`, `AcpBackendEditorDialog`, `FileEditorCard`, `GitDiffPanelModeContent`                    | The family remains in multiple real product surfaces.                                |
| Fixture verification    | Present | `apps/code/src/features/git/components/GitInspectorDetailVisualFixture.tsx`                               | The family has a deterministic browser-visible verification scene.                   |
| Playwright smoke        | Present | `tests/e2e/src/code/design-system-fixture-smoke.spec.ts`                                                  | The current workspace can render the verified scene without module/runtime breakage. |
| Dedicated Figma anchor  | Missing | None found in tracked registry or pipeline outputs                                                        | Stronger design-anchor governance is still a separate future step.                   |

## Browser Evidence

The current `Textarea` family continues to reuse the deterministic Git inspector scene as browser-visible proof:

- product surface: `GitDiffPanelModeContent`
- fixture surface: `GitInspectorDetailVisualFixture`
- smoke route: `git-inspector-detail`

This browser proof remains useful, but it is no longer treated as a standalone weak-anchor gate.

## Governed Family Evidence

`Textarea` is now governed through the same baseline layers as the other cross-surface families:

- promoted public docs in `packages/ui/src/components/PublicComponents.mdx`
- shared contract tests in `packages/design-system` and `packages/ui`
- app compat evidence in `apps/code/src/design-system/components/textarea/TextareaPrimitives.test.tsx`
- representative adoption evidence in current product surfaces
- existing browser-visible proof through `git-inspector-detail`

## Current Boundary

Allowed work includes:

- correctness and accessibility fixes for the shared multiline control
- compat-bridge normalization that preserves the shared implementation path
- representative product-surface adoption changes that continue to route through the governed family
- stronger design evidence collection if the team later wants stricter design-anchor governance

This note still does **not** justify:

- autosize behavior
- markdown, rich-text, or editor behavior
- counters, mentions, chip/tag composition, or removable tokens
- composer-specific abstraction
- treating `Textarea` as a strong Figma anchor without separate tracked evidence

## Remaining Gaps

`Textarea` still lacks:

- a dedicated local Figma export URL or node entry in the registry
- a family-local `component-specs` / `generation-plan` artifact path derived from Figma
- a tracked manual design confirmation that the current multiline baseline is the canonical cross-product design anchor

## Governance Note

`Textarea` no longer has a standalone `weak-anchor` gate. It is governed through the shared family contract and adoption baseline, with the Git inspector smoke scene retained as existing browser-visible evidence rather than as an independent blocker.
