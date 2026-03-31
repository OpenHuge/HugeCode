# HugeCode - Gemini CLI Entry Point

This file exists so Gemini CLI loads the same repo-level guidance as Codex and Claude Code.

## Source Of Truth

- `AGENTS.md` is the canonical shared instruction file for this repository.
- If `GEMINI.md`, `CLAUDE.md`, and `AGENTS.md` disagree, follow `AGENTS.md`, then tracked manifests/scripts, then current source.
- Start repo discovery from `README.md`, `AGENTS.md`, `docs/README.md`, `docs/guide/agents.md`, `docs/development/README.md`, and `docs/workspace-map.md` before reading deeper docs.
- When using `gh` to inspect or handle pull requests, reviews, comments, or related Actions status, use English for all agent-authored GitHub-facing output.

## Product And Scope

- Official product context is `HugeCode`.
- Legacy names such as `Keep-Up` and `Reader` are historical only.
- Active product surfaces are `apps/code`, `apps/code-web`, and `apps/code-electron`.
- `apps/code-web` is the Cloudflare-platform web implementation for public routes, SSR, and deploy wiring.
- `apps/code` remains the shared workspace client implementation that `apps/code-web` reuses for client-only `/app` flows.
- The local Agent Command Center in `apps/code` is intentionally slim: keep it
  to intent capture, runtime orchestration, and WebMCP controls rather than a
  local task board or governance dashboard.
- `continuity readiness` is post-launch runtime truth. When runtime publishes
  `missionLinkage`, `publishHandoff`, or `reviewActionability`, prefer that
  truth in Mission Control and Review Pack instead of rebuilding follow-up paths
  locally.
- `docs/plans/` is active in-flight working space only.
- `docs/archive/**` is historical context only and should not drive new implementation.
- `docs/specs/agentic/*` are frozen support contracts, not the main product definition, unless the task explicitly targets those contracts.

## Architecture Guardrails

- Keep `apps/code` runtime access behind `apps/code/src/application/runtime/*`.
- Do not orchestrate runtime, desktop-host, or transport ports directly from UI components or feature hooks.
- New remote execution behavior should enter through an application/runtime facade or service first.
- Do not introduce new wide aggregation ports like `desktopSettings` or `desktopWorkspaces` for fresh feature work.
- Remote backend preference must flow through runtime/application logic and the `preferredBackendIds` contract path.

## Stack And Non-Negotiables

- TypeScript, React 19, pnpm 10 monorepo, Turbo, Vite, Rust native accelerators.
- `@ku0/*` for TypeScript packages and `ku0-*` for Rust crates.
- Loro only; do not add Yjs.
- Use `vanilla-extract` (`.css.ts`) and shared design tokens on active UI surfaces.
- Do not add Tailwind or inline styles on repo-owned UI surfaces.
- Do not use `any`, `var`, array-index React keys, or clickable non-semantic elements.

## Commands

- Setup: `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm preflight:codex`
- Validation: `pnpm validate:fast`, `pnpm validate`, `pnpm validate:full`
- Boundary checks: `pnpm ui:contract`, `pnpm check:runtime-contract`
- Desktop verification: `pnpm desktop:verify:fast`, `pnpm desktop:verify`
- Targeted browser checks: `pnpm test:component`, `pnpm test:e2e:{core,blocks,collab,annotations,features,smoke,a11y}`

## Delivery Expectations

- State what changed and why.
- State validation commands run and the outcomes.
- State risks, skipped checks, or residual uncertainty.
