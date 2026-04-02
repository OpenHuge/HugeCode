# Runtime Composition Plane 2026

Status: active
Audience: runtime, contracts, app-runtime, host adapters, workspace client

## Purpose

This spec defines the ownership boundaries for HugeCode's runtime composition system.
It exists to stop adjacent concerns from collapsing into one another as the runtime extension and invocation platform grows.

## Canonical Planes

### Source plane

The source plane identifies where contributed capabilities originate.

Examples:

- runtime extension packages
- workspace skills
- prompt overlays
- session commands
- route plugins
- future rpc or wasi host binders

Source presence is not activation truth and not executability.

### Activation plane

The activation plane owns lifecycle truth for contributed capabilities.

It answers:

- is this contribution active now
- if not, is it degraded, failed, refresh-pending, or deactivated
- what diagnostics explain that state

Activation truth must come from runtime-owned state, not UI inference.

### Invocation plane

The invocation plane owns stable operator-facing identities.

It answers:

- what the operator can discover
- what can execute
- which invocation shadows another
- why an invocation is hidden or blocked

Invocation IDs are the stable identity surface for discovery and execution.

### Composition profile plane

The composition profile plane owns layered assembly of sources and policy.

It answers:

- which profile is active
- which config layers applied
- how source selectors were resolved
- which routes and backends were preferred
- which trust rules blocked or allowed publication and execution

The current expected layer order is:

1. `built_in`
2. `user`
3. `workspace`
4. `launch_override`

## Anti-Bypass Rules

- Installed package metadata does not imply activation.
- Activation does not imply invocation visibility.
- Invocation visibility does not imply execution readiness.
- WebMCP publication does not define canonical invocation truth.
- UI-side settings merges do not define durable composition truth.

## Consumer Rules

- `packages/code-runtime-host-contract` defines shared plane vocabulary.
- `packages/code-runtime-service-rs` owns runtime-backed plane truth and execution.
- `packages/code-application` and `packages/code-workspace-client` compose and present plane outputs.
- `apps/code`, `apps/code-web`, and `apps/code-electron` remain shell consumers and adapters.

## Immediate Implication

Future architecture work must land as one of:

- new source descriptors
- new activation records
- new invocation descriptors or execution policies
- new composition profile layers or selectors

It must not land as one more page-local capability merge path.
