# Unified Invocation Plane Track A

> Active working note for the initial contract freeze on `origin/main`.

## What Is Canonical Now

Track A freezes three minimal shared contracts:

- `RuntimeToolDescriptor`
- `InvocationDescriptor`
- `ActiveInvocationCatalog`

These live in [runtimeInvocationPlane.ts](/Volumes/Dev/A-HugeCode/packages/code-runtime-host-contract/src/runtimeInvocationPlane.ts) and are the only canonical descriptor shapes new invocation-plane work should target.

The runtime kernel now exposes `invocations.catalog` as a first-class capability. Consumers should access it through:

- [runtimeInvocationCatalog.ts](/Volumes/Dev/A-HugeCode/apps/code/src/application/runtime/kernel/runtimeInvocationCatalog.ts)
- [runtimeInvocationCatalogFacadeHooks.ts](/Volumes/Dev/A-HugeCode/apps/code/src/application/runtime/facades/runtimeInvocationCatalogFacadeHooks.ts)

## What The Follow-on Ingestion Slice Now Includes

- stable descriptor IDs
- source provenance/category metadata
- readiness metadata
- exposure metadata for operator vs model publication
- active catalog read/search/resolve/publication behavior
- projection-backed runtime-extension ingestion
- runtime-extension tool publication through `RuntimeToolDescriptor`
- explicit catalog-level collision precedence and winner metadata
- stable snapshot caching with monotonic revision increments on catalog change

The active catalog now includes:

- built-in runtime tools
- plugin-catalog entries, including live skills and workspace skill manifests
- projection-backed runtime extension bundles when kernel projection truth is available
- runtime extension tool summaries normalized into `InvocationDescriptor`
- runtime prompt-library overlays published as operator-facing session-command descriptors
- compatibility session commands

## What Track A Explicitly Does Not Include

- invoke handler execution binding
- revisioned runtime publication/events for catalog changes
- full source ingestion for every WebMCP/runtime surface
- extension lifecycle or activation flows
- UI-heavy discoverability work

## Publication Rule For Follow-on Tracks

Any new invocable surface should publish an `InvocationDescriptor` into the kernel catalog rather than minting a parallel UI-only or transport-only descriptor shape.

Track B should treat `invocations.catalog` as the publish target for active extension contributions and keep execution binding in app/runtime facades, not in view code.

Projection-backed activation truth now wins over fallback plugin-catalog rows for the same stable invocation ID. New source integrations should follow the same rule: normalize first, then publish through the catalog’s dedupe/precedence seam instead of exposing parallel read models.
