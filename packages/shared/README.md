# @ku0/shared

Shared HugeCode utilities and UI-adjacent helpers consumed across active app and package surfaces.

## What Lives Here

- Shared constants and type guards
- External URL and about-content helpers
- Runtime gateway environment/browser helpers
- Small shared UI primitives for chat, nav, and motion

## Start Here

- Package exports: [`src/index.ts`](./src/index.ts)
- Runtime gateway helpers: [`src/runtimeGatewayEnv.ts`](./src/runtimeGatewayEnv.ts), [`src/runtimeGatewayBrowser.ts`](./src/runtimeGatewayBrowser.ts)
- Shared UI helpers: [`src/ui/`](./src/ui/)

## Validation

- `pnpm --filter @ku0/shared typecheck`
- `pnpm --filter @ku0/shared test`
