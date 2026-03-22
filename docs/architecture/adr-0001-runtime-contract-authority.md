# ADR-0001: Runtime And Contract Authority

## Status

Accepted

## Decision

HugeCode will keep runtime truth and TypeScript contract truth in separate but canonical layers:

- runtime truth lives in `packages/code-runtime-service-rs`
- TypeScript contract truth lives in `packages/code-runtime-host-contract`

Shared client packages must depend on those layers.
App shells must not define alternate runtime-domain contracts or alternate execution truth.

## Consequences

- client packages may own transport helpers and typed client interfaces
- app shells may compose and adapt, but not fork runtime-domain types
- compatibility layers are transitional only and should shrink over time
- mission-control naming must converge on one active vocabulary in downstream consumers
