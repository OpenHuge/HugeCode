# @ku0/native-runtime-host-contract

Native Swift host namespace helpers and parity types layered on top of `@ku0/code-runtime-host-contract`.

## What Lives Here

- Native-prefixed RPC method mappings
- Native capability payload helpers
- Parity tests for the macOS/native host namespace

## Start Here

- Runtime overview: [`docs/runtime/README.md`](../../docs/runtime/README.md)
- Shared code runtime contract: [`../code-runtime-host-contract/README.md`](../code-runtime-host-contract/README.md)
- Native RPC helpers: [`src/nativeRuntimeRpc.ts`](./src/nativeRuntimeRpc.ts)

## Validation

- `pnpm --filter @ku0/native-runtime-host-contract test`
- `pnpm check:runtime-contract`

Run the native package tests whenever native-only RPC namespaces or capability mappings change.
