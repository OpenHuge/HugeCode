# @ku0/code-runtime-host-contract

Transport-neutral source of truth for the HugeCode code runtime host contract.

## What Lives Here

- Canonical RPC method catalog
- Explicit compatibility registry and alias lifecycle
- Shared event envelope types for `/events`
- Frozen contract spec generation and verification for `/rpc`, `/events`, and `/ws`
- Runtime kernel v2 lifecycle contract for run preparation, execution, and
  review (`code_runtime_run_prepare_v2`, `code_runtime_run_start_v2`,
  `code_runtime_run_get_v2`, `code_runtime_review_get_v2`, and companion
  resume/intervene/subscribe methods)

## Start Here

- Contract overview: [`docs/runtime/README.md`](../../docs/runtime/README.md)
- Frozen specs: [`docs/runtime/spec/`](../../docs/runtime/spec/)
- Canonical RPC registry: [`src/codeRuntimeRpc.ts`](./src/codeRuntimeRpc.ts)
- Compat registry: [`src/codeRuntimeRpcCompat.ts`](./src/codeRuntimeRpcCompat.ts)
- Event kinds and envelope parsing: [`src/index.ts`](./src/index.ts)

## Validation

- `pnpm --filter @ku0/code-runtime-host-contract test`
- `pnpm --filter @ku0/code-runtime-host-contract spec:check`
- `pnpm check:runtime-contract`

Use `pnpm validate` when the change reaches beyond the package and affects service, client, or adapter behavior.
