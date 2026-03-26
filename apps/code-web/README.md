# Cloudflare Web Platform

`apps/code-web` is the current Cloudflare-platform web implementation for
HugeCode.

It owns the repo's web route shell, SSR boundary, and Wrangler deployment
wiring. Root build, lint, and typecheck workflows now include this package, but
explicit Cloudflare dev and deploy flows still use the dedicated `pnpm web:*`
commands.

Do not treat this package as a duplicate implementation of the workspace client
in `apps/code`.

## Scope

- TanStack Start app shell and routing.
- Cloudflare-first SSR deployment target.
- Public web routes that can use SSR today and prerender later.
- Client-only `/app` entry that composes the shared workspace shell from
  `packages/code-workspace-client` and `packages/code-application` without
  changing the Tauri frontend contract.
- Web PWA installability, update flow, offline fallback shell, and static
  service worker ownership for the web host.
- Web-platform ownership remains separate from the desktop host shell.

## PWA Product Boundary

- The web host ships as a single-scope PWA rooted at `/` and launches installed
  sessions into `/app`.
- Public routes can reopen from cache offline; the workspace route only
  promises a cached shell and explicit runtime reconnect messaging.
- Runtime gateway traffic such as `/rpc` and `/ws` is never cached or replayed
  as fake offline state.
- Installed-window behavior is optimized for a single active HugeCode session
  where supported, so relaunching the app does not blindly duplicate workspace
  windows.

## Current Interpretation

- `apps/code-web` owns the web route shell, TanStack Start integration, and
  Cloudflare/Wrangler deployment boundary.
- `packages/code-workspace-client` owns the shared workspace shell and
  bindings contract consumed by both web and desktop hosts.
- The current web path is therefore `apps/code-web` shell +
  `packages/code-workspace-client`, not two independent workspace apps.
- Do not assume `apps/code` fully replaces this package for Cloudflare web
  publishing, public routes, or SSR work.
- If the repo later consolidates these surfaces, prefer extracting a shared
  workspace client package/module and keeping the web deployment shell separate
  from the desktop host.

## Commands

- `pnpm web:dev`
- `pnpm web:build`
- `pnpm web:typecheck`
- `pnpm --filter @ku0/code-web run test`

Legacy `pnpm experimental:web:*` aliases still resolve to the same workflow for
compatibility, but `pnpm web:*` is the canonical command family.

## Boundary Rules

- Cloudflare bindings and Worker-only code must stay on the Start server side.
- Do not import `@tauri-apps/*` into SSR code paths.
- Tauri continues to load `apps/code`, not this package.
- New shared workspace behavior should enter through the shared packages before
  either host shell grows another private copy.
