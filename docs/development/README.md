# HugeCode Development Guide

This document is the canonical entrypoint for local setup, core commands, and validation gates.

## Setup

```bash
pnpm install
pnpm dev
pnpm build
pnpm preflight:codex
```

If `pnpm install` reports `ERR_PNPM_MODIFIED_DEPENDENCY`, `Packages in the store have been mutated`,
or bin-link `ENOENT` errors for known package files under `node_modules/.pnpm`, treat that as a damaged
pnpm store instead of a repo dependency change.

Recover in this order:

```bash
pnpm install --force
pnpm repo:doctor
```

If multiple repos keep hitting the same error after a forced install, clean the global pnpm store before
continuing local debugging.

When working from multiple git worktrees, `pnpm run` / `pnpm exec` now warn instead of hard-failing if
`node_modules` looks stale for the current branch metadata. Treat the warning as a prompt to run
`pnpm install` when dependencies, lockfile contents, or workspace package manifests actually changed.

Root build, lint, and typecheck include the Cloudflare web shell through the
default workspace graph. Use the explicit `pnpm web:*` commands when you need
to run or deploy the Cloudflare shell directly.

- `pnpm check:workflow-governance`
  Required when CI workflow docs, workflow files, or reusable workflow mappings change.

## Core Validation Gates

Choose the narrowest gate that covers the change risk:

| Risk     | When to use                                     | Command              |
| -------- | ----------------------------------------------- | -------------------- |
| Fast     | Isolated UI or local TypeScript changes         | `pnpm validate:fast` |
| Standard | Default for multi-file or behavior changes      | `pnpm validate`      |
| Full     | Shared contracts, CI, or release-sensitive work | `pnpm validate:full` |

Validation gates are engineering checks, not product-health promises. In particular:

- `pnpm validate:fast` is the narrow local gate for touched UI or TS surfaces; it does not prove every runtime, desktop, or end-to-end path is green.
- `pnpm validate` and `pnpm validate:fast` keep workflow-governance-only changes and self-covered validation guard script edits on the targeted path instead of auto-escalating to `validate:full`.
- style token, style stack, and inline-style checks should stay change-aware in `validate` / `validate:fast`; repo-wide style scans belong to `validate:full` or explicit lint commands.
- `pnpm desktop:verify:fast` is the narrow desktop/Tauri confidence pass; it does not replace full packaging or release verification.
- operator-facing docs and UI copy should describe the actual supported execution, review, and degraded paths rather than implying that a single script guarantees product-wide readiness.

## Common PR CI Failures

Recent PR failures have repeated in a small set of gates. Use the mapping below
before opening the PR so CI is confirming work you already checked locally
instead of discovering the first missed requirement.

| CI gate                                              | Typical local miss                                                                                                                                               | Run before PR                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Quality / Typecheck (affected)`                     | Type unions, status enums, facade return shapes, or cross-package TS drift compile locally in one package but fail in the affected graph.                        | `pnpm typecheck:affected`                      |
| `PR Affected Checks / PR Affected Checks`            | Build output, UI copy, rendered states, settings/account flows, or browser-visible interactions changed without updating the affected build/test proof.          | `pnpm build:affected` and `pnpm test:affected` |
| `frontend_optimization / Frontend optimization gate` | Frontend startup, runtime readiness on `127.0.0.1:8788`, shell bootstrap, bundle-sensitive changes, or dependency churn breaks the expensive browser/build lane. | `pnpm validate:frontend-optimization`          |
| `Workflow governance`                                | Workflow YAML, shared action wiring, or workflow-facing docs drift from the scripted governance rules.                                                           | `pnpm check:workflow-governance`               |

Practical usage:

- If the change is mostly TypeScript correctness, run `pnpm validate` or at
  least `pnpm typecheck:affected`.
- If the change is visible in the browser, especially `apps/code` settings,
  auth, or copy, run `pnpm build:affected` and `pnpm test:affected`, then add
  `pnpm test:component` when the risk is interaction-heavy.
- If the change can alter startup timing, browser boot, runtime service
  readiness, or bundle output, run `pnpm validate:frontend-optimization` before
  pushing.
- If the change only touches workflow docs or CI plumbing, do not guess:
  run `pnpm check:workflow-governance` and classify it as workflow/governance
  work in the PR notes.
- In the PR body, list the exact commands you ran. Prefer targeted commands
  such as `pnpm typecheck:affected` or `pnpm validate:frontend-optimization`
  over vague statements like "tested locally".

## Runtime And Desktop Checks

- `pnpm ui:contract`
  Required when `apps/code` UI/runtime boundaries change.
- `pnpm check:runtime-contract`
  Required when runtime host contracts or frozen runtime specs change.
- `pnpm desktop:verify:fast`
  Default desktop verification gate for Tauri/runtime integration work.
- `pnpm desktop:verify`
  Use when packaging or full desktop build risk is in scope.

Electron desktop update and release-channel behavior is documented in [Electron Updates](./electron-updates.md).

## Control-Plane Operator Guidance

- runtime truth stays in runtime snapshots and host contracts, not in page-local caches
- Settings should separate execution routing, backend pool operability, and transport or daemon maintenance
- Mission Control control devices observe, approve, intervene, resume, and review; execution backends do the work
- Review Pack is the primary finish-line artifact, including publish handoff and checkpoint context when available
- degraded web or gateway states must say clearly what still works, what is read-only, and what still needs desktop or runtime-backed flow

## Targeted Test Commands

Use targeted suites instead of broad default runs:

```bash
pnpm test:component
pnpm test:e2e:core
pnpm test:e2e:blocks
pnpm test:e2e:collab
pnpm test:e2e:annotations
pnpm test:e2e:features
pnpm test:e2e:smoke
pnpm test:e2e:a11y
```

## Web Platform Commands

- Run Cloudflare web work through the explicit `pnpm web:*` command family.
- Legacy `pnpm experimental:web:*` aliases still work, but they are now compatibility shims over the canonical `pnpm web:*` commands.
- For Cloudflare web publishing, public routes, or Start/SSR shell work,
  `apps/code-web` is still the current repo-owned shell. Do not assume
  `apps/code` fully replaces it just because the workspace client is shared.

## Docs-Only Changes

For docs-only work with no runtime impact:

- fix local links and references
- keep navigation aligned with [docs/README.md](../README.md)
- note `docs-only, no runtime impact` in delivery

For workflow-facing documentation, use [CI Workflow Map](./ci-workflows.md) as the source of truth for public versus internal reusable workflows.

## Prompt Design Workflow

- [ChatGPT Web Prompt Lab Workflow](./chatgpt-web-prompt-lab-workflow.md)
  Use this workflow when you want ChatGPT web to handle prompt exploration and refinement before handing the final prompt to Codex for repo execution.
