# UI Governance Baseline

This document defines the current minimum governance baseline for shared UI work.

## Goal

Keep UI convergence work enforceable by default instead of relying on review memory.

The baseline is intentionally narrow:

- route shared design-system changes through a required baseline validation
- keep ownership between `packages/design-system`, `packages/ui`, and `apps/code/src/design-system` explicit
- require fixture and Storybook surfaces to stay part of the validation story for promoted shared UI

## Current Layer Contract

- `packages/design-system`
  Source of truth for tokens, themes, primitives, shared chrome, and family closure.
- `packages/ui`
  Public inspection surface for shared UI work, including Storybook and docs.
- `apps/code/src/design-system`
  App-owned adapter, compatibility, and explicit root-barrel governance layer.

Do not add new product-facing chrome as app-local truth when it can live in `packages/design-system`.
`Dialog*`, `Panel*`, `Shell*`, and `SplitPanel` stay app-owned at the root barrel through local grammar primitives.
Only app families with real normalization or compatibility needs should keep adapter entries.
Trivial shared families may forward directly from the app root barrel when they are explicitly governed in the barrel baseline and do not need app-local normalization.
Do not add undocumented or ad hoc raw root-barrel forwards from `@ku0/design-system`.

## Governance Units

The current product UI should be governed in these units:

1. `main shell`
2. `home/sidebar`
3. `mission control`
4. `core loop`
5. `review loop`
6. `settings/form chrome`

Cross-surface families are governed separately from page ownership:

- `select`
- `popover`
- `dialog`
- `field`
- `textarea`

Treat these as shared syntax assets, not page-local implementation details.

High-churn operator grammar adjuncts are governed separately from page units:

- `composer-select`
- `composer-action-stop`
- `autodrive-navigation`
- `runtime-subagent-observability`

## Automatic Validation Baseline

`pnpm validate` and `pnpm validate:fast` now route shared design-system changes through:

```bash
pnpm check:design-system:baseline
```

This baseline is triggered when changes touch:

- `packages/design-system/src/**`
- `packages/design-system/tokens/**`
- `packages/ui/src/components/**`
- `apps/code/src/design-system/**`
- `apps/code/src/features/design-system/**`
- design-system baseline scripts and fixture-smoke tests

The baseline command currently verifies:

- design-system barrels
- design-system ownership, including the frozen app adapter/root-barrel file baseline
- app design-system surface semantics, including:
  - substantive app adapters staying inside `apps/code/src/design-system/adapters/*`
  - compat bridge survivors staying explicit inside namespaced `apps/code/src/design-system/components/*` surfaces
  - app-owned grammar exports staying explicit in the root barrel
  - governed direct shared forwards for trivial families staying explicit in the root barrel baseline
  - `Dialog*`, `Panel*`, `Shell*`, and `SplitPanel` routing through app-owned modal/panel/shell primitives
- undocumented shared root forwards remaining disallowed from the root barrel
- `apps/code` UI import boundaries into the app design-system barrel
- Storybook/docs inspection coverage for promoted shared families listed in `PublicComponents.mdx`
- cross-surface family contract evidence for promoted `button`, `input`, `checkbox`, `switch`, `radio-group`, `select`, `popover`, `dialog`, `field`, `textarea`, `badge`, `text`, `list-row`, `rows`, `section-header`, `shell`, `status-badge`, and `surface` families:
  - shared public promotion in `packages/ui`
  - shared focused test coverage in `packages/design-system` and `packages/ui`
  - app compatibility evidence when the app owns a compat surface
  - representative adoption evidence across current product surfaces or shared embeds
- governance-unit fixture coverage for all current product units:
  - `main-shell-closure`
  - `home-sidebar-closure`
  - `mission-control`
  - `core-loop-closure`
  - `review-loop-closure`
  - `settings-form-chrome`
- operator-adjunct fixture coverage for high-churn operator grammar surfaces:
  - `composer-select`
  - `composer-action-stop`
  - `autodrive-navigation`
  - `runtime-subagent-observability`
- style compatibility boundary
- design-system fixture smoke

## Promotion Rules

For shared UI work:

1. New shared chrome belongs in `packages/design-system` first.
2. `apps/code/src/design-system` may add adapters or compat hooks, but not a second source of truth.
3. `packages/ui` should inspect and document promoted families, not reimplement them.

## Required Evidence

Promoted shared UI should carry matching evidence:

- shared primitive or chrome family: Storybook/docs coverage
- governed cross-surface family: promoted docs + shared contract tests + app compat evidence when applicable + representative adoption evidence
- governance-unit app-level grammar surface: fixture host + smoke coverage
- operator-adjunct grammar surface: fixture host + smoke coverage
- behavior-sensitive shared family: focused component or browser test

## Current Gaps

This baseline does not yet fully enforce:

- fixture coverage requirements beyond the current six governance units and four operator adjuncts
- wider fixture coverage outside the current governed units and adjunct surfaces
- further compat-bridge normalization beyond the current namespaced `popover`, `textarea`, `toast`, and execution-survivor set
- wider governed-family coverage beyond the current family registry

Those remain the next governance phase.
