# Shared Runtime Ownership Closure Design

**Date:** 2026-03-27

**Status:** Approved for implementation

**Goal**

Close `apps/code/src/services/*` ownership around runtime client and WebMCP so that `apps/code` returns to a composition-only role. Shared runtime business logic must live in `packages/code-runtime-client` and `packages/code-runtime-webmcp-client`; `apps/code` must keep only host binding, runtime composition, and app-facing facade wiring.

**Explicit Constraint**

Do not preserve or extend compatibility / fallback paths for the ownership-closure work. When a canonical implementation already exists or should exist in a shared package, the app-local copy must be deleted or reduced to a thin wrapper. This line is architectural convergence, not another compatibility layer.

## Problem

The repo already extracted:

- `packages/code-runtime-client`
- `packages/code-runtime-webmcp-client`

But `apps/code/src/services/*` still owns neighboring logic for:

- runtime RPC client method composition
- web runtime HTTP transport assembly
- WebMCP context descriptors
- WebMCP read tools
- WebMCP tool-name catalogs
- WebMCP agent-control helper logic

That keeps canonical truth split between app-local services and shared packages. Each runtime truth change risks being implemented three times: in app services, in host bindings, and in the shared package.

## Desired End State

### Ownership

- `packages/code-runtime-client`
  Owns runtime RPC client behavior, payload shaping, transport helpers, and canonical client extensions.
- `packages/code-runtime-webmcp-client`
  Owns canonical WebMCP catalog pieces, descriptors, tool-name sets, shared write-tool helpers, and generic agent-control normalization.
- `apps/code/src/services/*`
  Owns only:
  - host-specific transport adaptation
  - runtime tool composition that depends on app facades or app event wiring
  - live skill invalidation hooks tied to app runtime update ports
- `apps/code/src/application/runtime/*`
  Remains the only app-facing runtime boundary.

### Deletion / Slimming Rules

- Delete app-local files when the package can own the full implementation.
- Keep app-local wrappers only when they inject host-specific inputs such as:
  - desktop host invoke bridge
  - runtime gateway endpoint discovery
  - auth token resolution
  - app runtime update subscriptions
- Do not create new `compat`, `legacy`, or `withFallback` helpers to bridge old and new ownership.

## Recommended Approach

### Option A: Narrow ownership closure on the existing extracted seams

Move the specific neighboring implementations already duplicated in app services back into the shared packages, then reduce app files to imports/wrappers.

Why this is recommended:

- It directly resolves the debt called out in `docs/architecture/debt-inventory.md`.
- It keeps the blast radius inside the existing extraction seams.
- It supports a clean PR with strong architectural justification.
- It avoids conflating ownership closure with a broader runtime redesign.

### Option B: Leave shared packages as partial libraries and formalize app-local service ownership

Reject. This locks in split truth and guarantees future drift.

### Option C: Broaden the change into a larger runtime/application rearchitecture

Reject for this PR. That is too large for a safe production-quality convergence step.

## Scope For This Line

### In Scope

- Move app-local runtime RPC extension construction into `packages/code-runtime-client`
- Move canonical WebMCP descriptors / read tools / tool names into `packages/code-runtime-webmcp-client`
- Move generic WebMCP agent-control write helpers and normalization into `packages/code-runtime-webmcp-client`
- Reduce app service files to wrappers or composition-only code
- Delete `apps/code/src/services/runtimeClientRpcClient.ts`
- Add package tests that prove canonical ownership
- Add targeted app tests proving wrapper/composition integrity
- Update debt/docs to reflect the new source of truth

### Out Of Scope

- Replacing runtime launch / continuity / review-pack product behavior
- New async cloud agent product surfaces
- Broad removal of all runtime fallbacks everywhere in the repo
- Rust runtime service restructuring

## Architecture

### Runtime Client

`createExtendedRpcRuntimeClient` becomes the full shared runtime client constructor, including the app-local RPC methods that were still assembled in `apps/code`.

`apps/code/src/services/runtimeClientTransport.ts` becomes a mode switch plus host invoker assembly:

- resolve mode
- create raw invokers for desktop host and web runtime
- call the shared client factory

`apps/code/src/services/runtimeClientWebHttpTransport.ts` remains only as a thin host wrapper around the shared HTTP transport to inject:

- runtime gateway auth token
- auth header name

### WebMCP

`packages/code-runtime-webmcp-client` owns:

- `webMcpBridgeContextDescriptors`
- `webMcpBridgeReadTools`
- `webMcpBridgeToolNames`
- new `webMcpAgentControlCatalog`

`apps/code/src/services/webMcpBridge.ts` stays as the app composition root because it still wires:

- runtime tool catalogs that depend on app runtime facades
- input-schema preflight wrapping
- runtime live-skill cache invalidation using app update subscriptions
- app-specific runtime exposure policy

All generic helper logic moves out of the app file, and the deleted app-local
descriptor / read-tool / tool-name service wrappers are not retained as
compatibility shims.

## Product Impact

This is not a user-facing feature PR. The product benefit is structural:

- runtime truth changes land in one place
- WebMCP catalog changes land in one place
- app facades become easier to reason about
- future review/handoff/operator-loop work can build on a single runtime client and WebMCP core

That is the correct prerequisite for later top-tier product work such as stronger PR review summaries, review-pack actionability polish, and better async delegation surfaces.

## Testing Strategy

### Package-Level

- runtime client extension constructor tests
- WebMCP descriptor tests
- WebMCP tool-name catalog tests
- WebMCP shared write-tool helper tests

### App-Level

- targeted service tests covering:
  - runtime client transport
  - web runtime HTTP transport wrapper
  - WebMCP bridge composition
  - WebMCP descriptor wrapper integrity

### Repo Gates

- `pnpm --filter @ku0/code-runtime-client test -- ...`
- `pnpm --filter @ku0/code-runtime-webmcp-client test -- ...`
- `pnpm --filter @ku0/code exec vitest run --config vitest.config.ts ...`
- `pnpm --filter @ku0/code typecheck`
- `pnpm ui:contract`

## Risks

- Shared package exports may drift from existing app imports.
- App wrappers may retain stale type imports after helper extraction.
- Tool-name catalog moves can break WebMCP exposure filtering if app and package diverge.

## Mitigations

- Add package-level tests for canonical exports and behaviors.
- Keep app wrappers extremely thin.
- Validate with app-level targeted tests and `ui:contract`.

## Follow-Up After This PR

Once ownership closure lands, the next product-facing PR should improve runtime-backed review / handoff presentation:

- stronger review-pack actionability summaries
- cleaner operator next-step guidance
- PR-facing review summary extraction from canonical runtime truth

That follow-up should build on this converged architecture rather than reintroducing app-local duplication.
