# Coding Standards

This document captures the current engineering rules for the tracked HugeCode repository.

When this document disagrees with current code, scripts, or package manifests, treat the implementation as the source of truth and update the docs.

## 1. Core Principles

- Prefer small, verifiable changes over broad speculative rewrites.
- Keep behavior deterministic. Do not introduce logic that depends on random values, hidden ambient state, or local timestamps when correctness depends on reproducibility.
- Use the narrowest validation gate that still covers the real blast radius.
- Preserve active repository conventions instead of reintroducing removed packages, aliases, or placeholder surfaces.
- Treat current `apps/code` and related runtime packages as the primary product surface.

## 2. TypeScript And JavaScript

- Use TypeScript for TypeScript-owned surfaces.
- Do not use `any`; prefer `unknown`, discriminated unions, or explicit interfaces.
- Use `const` by default, `let` when reassignment is required, and never use `var`.
- Remove unused imports and variables. Prefix intentionally unused parameters with `_`.
- Prefer `for...of` over `forEach`.
- Prefer early returns over deep nesting.
- Do not add empty blocks or dead branches.

## 3. React And JSX

- Use semantic elements for interaction: prefer `<button>` and `<a>` over clickable `<div>`.
- Every non-submit button must declare `type="button"`.
- Do not use array index as a React key when stable identity exists.
- Icon-only controls must have an `aria-label`.
- Inputs, textareas, selects, and range controls need accessible labels.
- Keep keyboard navigation, focus states, and dynamic status updates understandable.

## 4. Styling

- Repo-owned styles belong in `*.css.ts` files with `vanilla-extract`.
- Do not add Tailwind.
- Do not add inline style objects unless an existing reviewed pattern explicitly requires them.
- Do not add repo-owned plain `.css` files outside the allowlisted vendor cases.
- Prefer semantic tokens and shared CSS custom properties over ad hoc values.
- Avoid hardcoded color literals when a token already exists.
- Do not reintroduce legacy button/style contracts such as `.primary`, `.secondary`, `.ghost`, or `.icon-button`.
- Frontend file size is capped at 1314 lines by repo checks. Oversized legacy files should not grow when touched.

## 5. Runtime And Package Boundaries

- Keep UI/runtime boundaries explicit. `apps/code` talks to runtime surfaces through tracked contracts, not ad hoc imports.
- When changing runtime-facing shapes, run `pnpm check:runtime-contract`.
- When changing `apps/code` UI/runtime boundaries, run `pnpm ui:contract`.
- Prefer existing package roles over inventing new near-duplicate modules.

## 6. Validation And Testing

Use the narrowest command that matches the change:

| Change shape                                               | Minimum command                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Docs-only                                                  | No runtime validation required; state that the work is docs-only |
| Small UI or TS change                                      | `pnpm validate:fast`                                             |
| Multi-file or package behavior change                      | `pnpm validate`                                                  |
| Shared contract, CI, workflow, or release-sensitive change | `pnpm validate:full`                                             |

Targeted checks:

- Use `pnpm test:e2e:<category>` for focused Playwright coverage.
- Do not run the full E2E suite by default.
- Use `pnpm desktop:verify` for Tauri and desktop-runtime changes.
- Use `pnpm repo:doctor` or narrower `check:*` commands for repo policy, SOT, or workflow changes.

## 7. Rust

- `cargo clippy -- -D warnings` must pass for touched crates.
- Run `cargo fmt` before shipping Rust changes.
- Use `thiserror` for library errors and `anyhow` for application entrypoints.
- Avoid `unsafe` unless there is a clear need and the justification is documented inline.
- Rust file size is capped by `pnpm check:rust-file-size`; oversized legacy files should not grow.
- Windows MSVC builds require Visual Studio C++ tools and a Windows SDK. If `kernel32.lib` is missing, install the matching Windows SDK component documented in repo guidance.

## 8. Logging And Error Handling

- Prefer structured, contextual logging over vague string-only logs.
- Do not log secrets, auth tokens, or raw sensitive user content.
- Fail with clear typed errors where possible instead of hiding failure causes.
- Fix the verified cause before stacking speculative retries or patches.

## 9. Repository Surfaces

Active surfaces to prefer in documentation and examples:

- `apps/code`
- `apps/code-tauri`
- `packages/code-runtime-service-rs`
- `packages/code-runtime-host-contract`
- `packages/design-system`
- `packages/shared`

Avoid reintroducing removed or retired package surfaces in new guidance.

## 10. Agent And Artifact Notes

- Read the current task context and relevant tracked docs before editing.
- `task.md`, `implementation_plan.md`, and `walkthrough.md` are optional working artifacts. They may be stale; code, scripts, and manifests are the source of truth.
- Before committing, ensure the chosen validation gate passes and the final summary includes commands and outcomes.
