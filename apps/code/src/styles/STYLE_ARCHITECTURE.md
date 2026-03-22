# `apps/code` Style Architecture

## Goals

- Keep style ownership local to the component that renders the DOM.
- Reduce cross-feature cascade coupling.
- Keep global rules limited and auditable.

## Naming

- Component-local style module: `Component.styles.css.ts`
- Shared design-system/global style module: `ds-*.css.ts`
- Theme/token files stay under `styles/tokens/**`
- Bridge naming is forbidden: do not add `*Legacy.global.css.ts` or `*Panels.global.css.ts`.

## Ownership Rules

- If a class is only used by one component tree, define it in that component's local `.styles.css.ts` file.
- Avoid adding new cross-domain style files under `styles/` for feature-specific DOM.
- `runtime.css.ts` is a bootstrap entry, not a place to accumulate feature behavior rules.

## Global Style Boundary

`globalStyle(...)` is restricted to controlled global surfaces:

- `apps/code/src/styles/base.css.ts`
- `apps/code/src/styles/tokens/**`
- `apps/code/src/styles/ds-*.css.ts`
- `apps/code/src/styles/rich-content-global.css.ts` (if present)

For any new work, do not introduce `globalStyle(...)` outside those paths.

`apps/code/src/features/**` may temporarily keep `.global.css.ts` files for migration safety, but:

- they must not use bridge naming patterns,
- they must not duplicate selectors across files,
- and component-owned styles should continue moving into local `.styles.css.ts` modules.

## Button and Select Contracts

- Business code should import shared families from `apps/code/src/design-system` instead of reaching into `design-system/components/*`.
- Business code should use the root `design-system` barrel instead of per-feature custom select primitives.
- For icon-only interactive controls, always provide `aria-label`.
- For native `<button>`, always set an explicit `type`.

## Guardrails

Validation scripts enforce maintainability budgets and regressions:

- `scripts/check-style-budgets.mjs`
- `scripts/check-global-style-boundary.mjs`
- `scripts/check-duplicate-global-selectors.mjs`
- `scripts/check-stale-style-selectors.mjs`
