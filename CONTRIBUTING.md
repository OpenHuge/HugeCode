# Contributing Guide

Official product name: **HugeCode**.

Legacy references to **Keep-Up** or **Reader** should be treated as historical aliases unless a document is explicitly marked archival.

A retired product-branded alias has been fully removed from tracked repo paths and file content. Do not restore deleted placeholder surfaces, product-branded runtime policy names, or pre-`project-context:*` generator sentinels. `pnpm check:repo:sot` enforces this rule.

## Start Here

```bash
pnpm install
pnpm workflow:list
pnpm repo:doctor
```

Use the canonical docs before deeper work:

- [Development Guide](./docs/development/README.md)
- [Workspace Map](./docs/workspace-map.md)
- [Architecture Overview](./docs/arch.md)
- [Runtime Docs](./docs/runtime/README.md)

## Primary Entrypoints

- `pnpm dev`
  Starts the main HugeCode coding workspace.
- `pnpm dev:code:ui`
  Starts the `apps/code` Vite UI only.
- `pnpm dev:code:service`
  Starts the Rust-first code runtime service only.
- `pnpm dev:desktop`
  Starts the Electron desktop shell for `apps/code`.
- `pnpm dev:code:runtime-gateway-web:all`
  Starts the coding workspace with the local web runtime gateway flow.

## Validation Policy

Use the narrowest gate that matches the blast radius:

- `pnpm validate:fast`
  Isolated UI or TypeScript changes.
- `pnpm validate`
  Default gate for multi-file behavior work.
- `pnpm validate:full`
  Config, workflow, CI, release, or shared-contract changes.
- `pnpm check:runtime-contract`
  Runtime contract freeze and runtime source-of-truth checks for `packages/code-runtime-host-contract`.

Additional targeted checks:

- `pnpm test:e2e:<category>`
  Run only the relevant Playwright category.
- `pnpm desktop:verify`
  Required for desktop integration work.
- `pnpm ui:contract`
  Required for `apps/code` UI/runtime boundary work.
- `pnpm repo:doctor`
  Repo-wide source-of-truth, governance, and readiness checks.

## PR Preflight

Before opening a pull request, run the narrowest local checks that match the
surfaces you changed instead of waiting for CI to tell you which gate you
missed.

Use this checklist:

- TypeScript, React state, runtime facade, or shared contract changes:
  run `pnpm typecheck:affected` at minimum, and prefer `pnpm validate` for the
  default pre-PR gate.
- `apps/code` behavior, UI copy, OAuth/account flows, settings flows, or other
  browser-visible interaction changes:
  run `pnpm test:affected`; add `pnpm test:component` when the regression risk
  is centered in rendered browser behavior.
- Frontend startup, runtime bootstrap, shell wiring, bundle-sensitive UI,
  `apps/code` build behavior, or dependency changes that can affect browser
  startup:
  run `pnpm validate:frontend-optimization` before asking CI to run the same
  expensive lane.
- `.github/workflows/**`, shared GitHub actions, workflow-facing docs, or
  reusable workflow wiring:
  run `pnpm check:workflow-governance` and treat the change as
  `pnpm validate:full` scope.
- Docs-only changes with no runtime, workflow, or contract impact:
  note `docs-only, no runtime impact` in the PR summary instead of implying
  product validation was run.

Recent CI failures have clustered around `Typecheck (affected)`,
`Tests (affected)`, and `Frontend optimization gate`. The checklist above is
intended to catch those locally before the PR enters the queue.

When you open the PR, copy the exact commands you ran into the PR body instead
of checking a generic "tests passed" box. The PR template now expects targeted
validation evidence that matches the changed surface.

## Working Rules

- Do not introduce `any`, unused imports, or non-semantic clickable elements.
- Do not add Tailwind to the repo; active UI surfaces standardize on `vanilla-extract`.
- Do not add inline styles.
- Do not add Yjs; the active collaboration model remains Loro-based.
- Treat `apps/code/src/application/runtime/*` as the stable runtime API for the UI.
- Do not import `apps/code/src/services/*` runtime internals directly from feature/UI code.
- Treat undocumented placeholder directories under `apps/` as inactive entrypoints.
- Do not introduce new primary app narratives outside `apps/code`, `apps/code-web`, and `apps/code-electron` without an ADR and a tracked manifest.
- Use `runtime-policy` for policy-domain packages, examples, fixtures, and docs.
- For docs-only changes, state that the work is docs-only and has no runtime impact.
