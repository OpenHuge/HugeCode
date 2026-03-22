# Design System

This document describes the current shared design-system contract for repo-owned UI.

## Source of Truth

The source of truth lives in `packages/design-system/src/` and is exposed through `@ku0/design-system`.

## Package Roles

Treat the shared UI packages as layered, not interchangeable:

- `packages/design-system`
  Owns shared tokens, themes, primitives, shell vocabulary, and all Figma-backed family closure work.
- `apps/code/src/design-system/adapters/<Family>`
  Owns thin product-facing compatibility adapters that normalize app-specific props or icon conventions on top of `@ku0/design-system`.
- `apps/code/src/design-system/adapters/index.ts`
  Is the app adapter barrel. Only families with real app normalization should be re-exported here before they are surfaced through broader app design-system entrypoints.
- `apps/code/src/design-system/index.ts`
  Is the root app design-system barrel. It should re-export the app adapter barrel, explicit direct shared forwards for trivial families, and any remaining app-local compatibility surfaces, including app-owned utility helpers and styling presets, without becoming a second source of truth for shared family behavior.
- `packages/ui`
  May consume `@ku0/design-system` and host stories, wrappers, or incubating composites, but it is not a second source of truth for shared family completion.
  Prefer compatibility re-exports or prop-normalizing wrappers over package-local reimplementation when a shared family already exists in `packages/design-system`.

For production UI inside `apps/code`, import runtime components, execution helpers, and app-owned presets from `apps/code/src/design-system` rather than `@ku0/ui` or deep links into `design-system/components/*` and `features/design-system/components/*`.

If a family exists in `packages/ui` but not yet in `packages/design-system`, treat the `packages/ui` version as reference or migration debt, not as the authoritative implementation.

Current public layers:

- Theme CSS variables: `--color-*`, `--font-size-*`, `--line-height-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`
- TypeScript token exports: `semanticColors`, `fontSize`, `spacing`, `borderRadius`, `boxShadow`, `transitionDuration`
- Semantic styling helpers: typography, motion, elevation, and focus primitives

`apps/code` also defines private `--ds-*` bridge vars for app-shell migration. Those are not shared package API.

Legacy alias families such as `--surface-*`, `--text-*`, `--border-*`, and `--brand-*` are not public consumption interfaces.

## Token Families

### Colors

Representative theme variables:

| Token                                                                           | Usage                            |
| ------------------------------------------------------------------------------- | -------------------------------- |
| `--color-background` / `--color-foreground`                                     | Base app canvas and default text |
| `--color-card` / `--color-card-foreground`                                      | Cards and card text              |
| `--color-popover` / `--color-popover-foreground`                                | Floating surfaces                |
| `--color-primary` / `--color-primary-foreground`                                | Primary actions                  |
| `--color-secondary` / `--color-secondary-foreground`                            | Secondary emphasis               |
| `--color-muted` / `--color-muted-foreground`                                    | Muted UI and secondary text      |
| `--color-surface-0` ... `--color-surface-3`                                     | Surface depth ramp               |
| `--color-surface-elevated`                                                      | Elevated panels                  |
| `--color-border` / `--color-input` / `--color-ring`                             | Borders, inputs, focus           |
| `--color-success` / `--color-warning` / `--color-error` / `--color-destructive` | Status and error semantics       |

### Typography

The type scale is exposed as paired size/line-height vars and TS helpers:

- `nano`, `tiny`, `micro`, `fine`
- `label`, `meta`, `ui`, `chrome`
- `chat`, `content`
- `title`, `titleLg`, `displaySm`, `display`, `displayLg`

Use the exported typography helpers or `fontSize.*`; do not reintroduce raw pixel sizes in `.css.ts`.

### Motion and Chrome

| Family | Examples                                                                   |
| ------ | -------------------------------------------------------------------------- |
| Motion | `--duration-fast`, `--duration-normal`, `--duration-slow`, `--ease-smooth` |
| Radius | `--radius-sm`, `--radius`, `--radius-md`, `--radius-lg`, `--radius-2xl`    |
| Shadow | `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`  |

Use semantic motion/elevation/focus helpers before dropping to raw vars.

## Component Guidance

- Use design-system semantic primitives first.
- Promote reusable chrome primitives such as dialog, panel, and toast shells into `packages/design-system`; keep `apps/code/src/design-system` wrappers only when app compatibility names or class hooks still need to be preserved.
- When app-specific normalization is required, land it in `apps/code/src/design-system/adapters/<Family>`, then wire it through `apps/code/src/design-system/adapters/index.ts`, then re-export it from `apps/code/src/design-system/index.ts`.
- If an app adapter does not add normalization, product semantics, or compatibility hooks, do not keep a dedicated adapter file; route the family through an explicit direct forward from `apps/code/src/design-system/index.ts` instead.
- Use `cn()` only to combine generated classes and optional overrides.
- Keep focus styles, elevation, and motion aligned with shared helpers.
- Do not document or introduce new consumers of private bridge tokens.

## Component Library Closure Policy

The governed closure target for the current shared library has two parallel endpoints:

1. All 14 families from `docs/design-system/figma-focus-plan.linear-dark-mode.json`
2. All four shared visual phases from `docs/design-system/figma-node-rollout.md`: shell, row/meta, chip, and translucent overlay

The library is not considered complete until both endpoints are closed.

Execution order should stay narrow:

- Phase A: `Button` -> `Select` -> `Checkbox` -> `Tabs` -> `Badge`
- Phase B: `DropdownMenu` -> `Tooltip` -> `Avatar` -> `Text`
- Phase C: shell -> row/meta -> chip -> translucent overlay

Each family or visual phase should land as its own verified commit and push. Do not batch the full closure effort into one large branch milestone.

## Non-Goals

The following are not current public contracts:

- `useDensity()`
- legacy alias token families
- repo-local compatibility bridges in `apps/code` beyond the adapter-family -> adapter-barrel -> app-root-barrel layering
