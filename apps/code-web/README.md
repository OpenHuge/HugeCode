# Cloudflare Web Platform

`apps/code-web` is the current Cloudflare-platform web implementation for
HugeCode.

It owns the repo's web route shell, SSR boundary, and Wrangler deployment
wiring. It is still excluded from the root default dev/build/validate workflows
today, but that workflow choice does not make the surface experimental.

Do not treat this package as a duplicate implementation of the workspace client
in `apps/code`.

## Scope

- TanStack Start app shell and routing.
- Cloudflare-first SSR deployment target.
- Public web routes that can use SSR today and prerender later.
- Client-only `/app` entry that reuses the existing `apps/code` workspace shell without changing the Tauri frontend contract.
- Web-platform ownership separate from the default root workflow.

## Current Interpretation

- `apps/code-web` owns the web route shell, TanStack Start integration, and
  Cloudflare/Wrangler deployment boundary.
- `apps/code` still owns the main workspace client implementation.
- The current web path is therefore `apps/code-web` shell + `apps/code`
  workspace client, not two independent workspace apps.
- Do not assume `apps/code` fully replaces this package for Cloudflare web
  publishing, public routes, or SSR work.
- If the repo later consolidates these surfaces, prefer extracting a shared
  workspace client package/module and keeping the web deployment shell separate
  from the desktop host.

## Commands

- `pnpm web:dev`
- `pnpm web:build`
- `pnpm web:typecheck`

Legacy `pnpm experimental:web:*` aliases still resolve to the same workflow for
compatibility, but `pnpm web:*` is the canonical command family.

## Boundary Rules

- Cloudflare bindings and Worker-only code must stay on the Start server side.
- Do not import `@tauri-apps/*` into SSR code paths.
- Tauri continues to load `apps/code`, not this package.
- Returning this surface to the default root workflows is a workflow-governance
  decision, not a product-status change.
