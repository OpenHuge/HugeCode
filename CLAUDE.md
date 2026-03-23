# HugeCode - Claude Code Entry Point

This file exists so Claude Code loads the same repo policy as other coding agents.
`AGENTS.md` is the canonical shared instruction file for this repository.

**Name**: HugeCode
**Node**: 24.11.1
**pnpm**: 10.28.0

If `CLAUDE.md`, `AGENTS.md`, package manifests, or tracked scripts disagree, follow `AGENTS.md` first, then current manifests/scripts/source.

When using `gh` to inspect or handle pull requests, reviews, comments, or related Actions status, use English for all agent-authored GitHub-facing output.

Use the root docs in this order before scanning deeper materials:

1. `README.md`
2. `AGENTS.md`
3. `docs/README.md`
4. `docs/guide/agents.md`
5. `docs/development/README.md`
6. `docs/workspace-map.md`
7. relevant `.agent/*` docs for the touched surface

Default scoping reminders:

- Official product context is `HugeCode`; `Keep-Up` and `Reader` are historical names only.
- `apps/code`, `apps/code-web`, and `apps/code-tauri` are the active app surfaces.
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
- `docs/specs/agentic/*` are frozen support contracts, not the main product definition, unless the task explicitly targets them.

@AGENTS.md
