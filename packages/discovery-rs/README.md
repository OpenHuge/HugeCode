# @ku0/discovery-rs

Rust-backed local discovery bindings for HugeCode runtime surfaces.

## What Lives Here

- Browser-safe discovery entrypoints for shared package consumers
- Node-only native binding loading for mDNS discovery and advertisement
- TypeScript types for discovery payloads and native binding contracts

## Start Here

- Shared browser-safe entrypoint: [`src/index.ts`](./src/index.ts)
- Node binding loader: [`src/node.ts`](./src/node.ts)
- Binding types: [`src/types.ts`](./src/types.ts)

## Validation

- `pnpm --filter @ku0/discovery-rs typecheck`
- `pnpm --filter @ku0/discovery-rs test`
