# Activation Truth Invocation Plane Design

## Goal

Make activation truth the canonical live source for extension-derived invocability by ingesting `extensions.activation` into a unified runtime invocation catalog and converting the first high-value WebMCP runtime tool surfaces to consume that catalog instead of inferring liveness from `plugins.catalog` or direct live-skill listing.

## Problem

HugeCode now publishes runtime-owned activation truth through `extensions.activation`, including:

- canonical activation state
- readiness
- diagnostics
- transition history
- `activeContributions`

But current runtime invocation decisions still bypass that truth in important places:

- WebMCP runtime workspace tools gate execution through `listLiveSkills()`
- `run-runtime-live-skill` resolves ids from the direct runtime skill list
- `list-runtime-live-skills` projects direct runtime skill inventory instead of activation truth

That leaves the system with two competing sources of “live capability”:

1. activation truth
2. direct runtime skill/catalog inference

The next slice should remove that split for the most important runtime-facing invocation surfaces.

## Design

### Canonical Boundary

Activation owns:

- discovery
- verification
- bind/activate/deactivate state
- readiness
- diagnostics
- session overlays

Invocation catalog owns:

- ingestion of activation snapshots
- normalization of invocable contributions into stable descriptors
- active listing
- resolution by stable id
- explanation metadata for degraded/failed/deactivated states

Invocation catalog does not own:

- install flows
- activation state transitions
- runtime execution implementation

### New Runtime Capability

Add a new workspace runtime capability:

- `invocations.catalog`

This capability will be created from the existing `extensions.activation` capability. It is a thin derived view, not a second source of truth.

### Normalized Descriptor Model

Normalize only contribution kinds that are meaningfully invocable right now:

- `invocation`
- `skill`
- `route`
- `host_binding`

Each invocation descriptor preserves:

- stable contribution id
- contribution kind
- title
- binding stage
- source provenance
- activation state
- readiness summary/detail
- diagnostics
- transition history
- session scope / overlay provenance
- contribution metadata

`activeContributions` remains the canonical live set. The catalog also retains non-live invocable entries when they have an activation record, so downstream surfaces can explain why something is degraded, failed, or deactivated.

### First Converted Surface

Convert WebMCP runtime live-skill/workspace-tool routing first:

- `list-runtime-live-skills`
- `run-runtime-live-skill`
- runtime workspace tools that currently call `assertRuntimeLiveSkillAvailable(...)`

These tools should resolve runtime invocability from the new invocation catalog. Execution may still flow through `runLiveSkill(...)` for this slice, but the decision that a skill is live must come from activation truth.

### Session Overlay Behavior

Invocation catalog methods accept optional `sessionId`. If provided, the catalog reads `extensions.activation.readSnapshot({ sessionId })` and includes session overlay contributions. This keeps session-scoped activation separate while still making it invocable through a bounded path.

### Guardrails

Add tests that enforce:

- active skill/invocation contributions appear in the invocation catalog
- overlay contributions appear when `sessionId` is provided
- degraded/failed/deactivated states survive normalization
- WebMCP live-skill availability checks prefer invocation catalog data over legacy direct skill listing when the new surface is present

## Alternatives Considered

### 1. Put activation-reading logic directly into WebMCP services

Rejected because it would duplicate normalization logic in service code and make future non-WebMCP invocation surfaces repeat the same work.

### 2. Expand host RPC/runtime service contracts now

Rejected for this slice because the problem is currently solvable inside the app runtime kernel without broad RPC churn.

### 3. Keep direct `listLiveSkills()` as the live source and only annotate with activation

Rejected because it preserves the exact source-of-truth split this follow-up is meant to remove.

## Testing Plan

Targeted tests:

- new invocation catalog facade tests
- workspace scope capability wiring tests
- WebMCP runtime tool tests for activation-truth-backed availability and listing
- session overlay coverage through the invocation catalog facade

Repo-wide validation is unnecessary for this slice unless shared contracts outside the app/runtime WebMCP surface are touched.
