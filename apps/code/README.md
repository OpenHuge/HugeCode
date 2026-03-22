# apps/code

`apps/code` is the Tauri-facing coding-assistant frontend built with React and Vite. It remains the desktop/mobile WebView entrypoint and continues to produce static client assets for `apps/code-tauri`.

## Scope in this scaffold

- Static/CSR shell for the coding assistant workspace.
- Composer/threads/model-pool placeholder surfaces.
- Tauri IPC service entrypoint for Rust command integration.
- Shared UI/runtime-safe modules that can be consumed by `apps/code-web` for
  the client-only workspace shell.
- The current repo-owned workspace client that `apps/code-web` reuses for the
  client-only `/app` web entry.

## Target Boundary

- Keep `apps/code` compatible with `tauri dev` and `tauri build`.
- Do not introduce a Cloudflare Workers runtime dependency here.
- TanStack Start and Cloudflare platform shell work live in `apps/code-web`,
  which remains outside the default root workflows today.
- Visual and deterministic fixtures now load through `fixtures.html`, not through the production app entry.
- Browser/runtime-gateway support may live here, but that does not make this
  package the full Cloudflare web deployment shell.
- Do not assume `apps/code` fully replaces `apps/code-web` for public routes,
  SSR, or Wrangler-based deploy flows.
- Keep extension UX `skills`-first. Do not restore ChatGPT apps/connectors or a
  `/apps` product surface here.
- Do not add back runtime apps discovery RPCs or tooling in this package; the
  app-layer `appsListV1` / `list-runtime-apps` compatibility path has been removed.
- Keep multi-agent, sub-agent, and parallel-agent execution flows intact; they
  are core product behavior, not optional experiments.
- Keep the local Agent Command Center minimal. Do not reintroduce a local
  execution board, governance automation panel, or audit-log workflow under
  `apps/code`; runtime orchestration truth belongs to the runtime-backed
  surfaces.
- Keep `launch readiness` and `continuity readiness` separate in this package:
  launch readiness is preflight-only, while continuity readiness explains
  checkpoint recovery, control-device handoff, and review continuation from
  runtime-published truth after launch.
- In Review Pack and Mission Control, treat runtime `missionLinkage` as the
  canonical continue path and runtime `reviewActionability` as the canonical
  follow-up summary whenever those fields are present.

## Commands

- `pnpm --filter @ku0/code dev`
- `pnpm --filter @ku0/code build`
- `pnpm --filter @ku0/code typecheck`

## Styling

- Style system guide: `apps/code/docs/style-system.md`
