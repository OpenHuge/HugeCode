# apps/code Style System

This document defines the styling contract for `apps/code`.

## Stack

- Styling runtime: `@vanilla-extract/css`
- Build integration: `@vanilla-extract/vite-plugin`
- Style entrypoint: `apps/code/src/styles/runtime.css.ts`

`apps/code/src/main.tsx` must import the runtime entry so all global styles and themes are registered.

## File Conventions

- Use `*.css.ts` files for all styles in `apps/code`.
- Use semantic file names for split style modules (for example `home-skeleton-responsive.css.ts`).
- Do not use placeholder split names like `*.part.css.ts`.
- Keep style modules scoped by UI domain and intent, not by migration order.
- Prefer split modules when a file grows beyond ~700 lines (soft target); hard guard is 1314 lines.
- Keep one main entry file per domain and import submodules via side-effect imports.
- Prefer local style modules and class exports for component-owned styles.
- Use `globalStyle` only for:
  - third-party DOM you do not control
  - document-level selectors (`:root`, `body`, theme selectors)
  - existing legacy selectors that are intentionally retained

## Naming Template

- Pattern: `<feature>-<surface>-<intent>.css.ts`
- Examples:
  - `main-topbar-workspace.css.ts`
  - `home-usage-bars-latest.css.ts`
  - `settings-projects-open-apps.css.ts`

## Theme and Tokens

- Theme contract: `apps/code/src/styles/tokens/themeContract.css.ts`
- Theme values source of truth: `apps/code/src/styles/tokens/themeValues.ts`
- Theme application: `apps/code/src/styles/tokens/themes.css.ts`
- DS alias variables: `apps/code/src/styles/tokens/dsAliases.css.ts`

Do not introduce a second token source. Add new token keys to the contract and all four themes (`light`, `dark`, `dim`, `system`) together.

## Layering

Use layers defined in `apps/code/src/styles/system/layers.css.ts`:

1. `reset`
2. `tokens`
3. `components`
4. `features`
5. `utilities`
6. `overrides`

Place new rules in the narrowest layer that matches the intent.

## Forbidden Patterns

- Legacy class contracts in TSX: `.primary`, `.secondary`, `.ghost`, `.icon-button`
- New global `button {}` catch-all rules
- Inline JSX style objects (`style={{ ... }}`) without explicit review
- Hardcoded color literals in style code when a token exists

## Validation Guards

Run these checks for style changes:

- `node scripts/check-style-color-tokens.mjs`
- `pnpm exec tsx scripts/check-theme-token-parity.mjs`
- `node scripts/check-legacy-style-classes.mjs`
- `node scripts/check-style-module-file-names.mjs`
- `pnpm validate:fast` (minimum)
- `pnpm validate` before merge
