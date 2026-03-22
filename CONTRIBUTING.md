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
  Starts the Tauri desktop shell for `apps/code`.
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
  Required for Tauri or desktop integration work.
- `pnpm ui:contract`
  Required for `apps/code` UI/runtime boundary work.
- `pnpm repo:doctor`
  Repo-wide source-of-truth, governance, and readiness checks.

## Working Rules

- Do not introduce `any`, unused imports, or non-semantic clickable elements.
- Do not add Tailwind to the repo; active UI surfaces standardize on `vanilla-extract`.
- Do not add inline styles.
- Do not add Yjs; the active collaboration model remains Loro-based.
- Treat `apps/code/src/application/runtime/*` as the stable runtime API for the UI.
- Do not import `apps/code/src/services/*` runtime internals directly from feature/UI code.
- Treat undocumented placeholder directories under `apps/` as inactive entrypoints.
- Do not introduce new primary app narratives outside `apps/code` and `apps/code-tauri` without an ADR and a tracked manifest.
- Use `runtime-policy` for policy-domain packages, examples, fixtures, and docs.
- For docs-only changes, state that the work is docs-only and has no runtime impact.
