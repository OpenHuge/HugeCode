# Runtime Control Plane Phase 2 Plan

Status: proposed
Date: 2026-04-04
Audience: `apps/code`, `apps/code-web`, `packages/code-application`, `packages/code-workspace-client`, `packages/code-platform-interfaces`, `packages/code-runtime-host-contract`, `packages/code-runtime-service-rs`

## Goal

Advance HugeCode from a partially extracted runtime composition platform to a genuinely shared control-plane architecture:

- `apps/code` stays a shell and adapter surface
- shared read-only control-plane composition moves into `packages/code-application`
- shared settings/state ownership moves into `packages/code-workspace-client`
- capability binding contracts stay in `packages/code-platform-interfaces`
- runtime-owned invocation evidence and host dispatch continue moving toward the Rust runtime and host contract

The target path remains:

`UI / host intent -> code-application -> workspace-client / platform interfaces -> runtime host contract -> Rust runtime`

## Baseline On 2026-04-04

This plan is grounded in `origin/main` at commit `f8872c56` as inspected on 2026-04-04.

### What main already has

- activation truth is now canonical for invocation and WebMCP-facing runtime tools
- composition vocabulary is formalized in `packages/code-runtime-host-contract`
- `packages/code-application` already owns:
  - runtime composition profiles
  - runtime executable skill catalog
  - runtime invocation catalog
  - workspace client bindings
- boundary governance already exists through:
  - `pnpm ui:contract`
  - `pnpm check:ui-service-boundary`
  - `scripts/check-platform-boundaries.mjs`

### What main still leaves app-local

The next extraction target is visible in current file weight and ownership:

- `apps/code/src/application/runtime/facades/runtimeWorkspaceMissionControlProjection.ts`
- `apps/code/src/application/runtime/facades/runtimeReviewPackSurfaceFacade.ts`
- `apps/code/src/application/runtime/facades/runtimeMissionControlRunProjection.ts`
- `apps/code/src/application/runtime/facades/runtimeMissionControlReviewPackProjection.ts`
- `apps/code/src/application/runtime/facades/runtimeMissionControlSurfaceModel.ts`

These files still carry large amounts of host-agnostic read-only composition and presentation assembly that should not remain app-local long term.

### Immediate gap between main and desired target

`main` still lacks a merged version of several shared utilities already implied by the architecture direction:

- backend preference resolution with provenance
- config hook pipeline for effective composition resolution
- shared extension explainability helpers
- capability registry / binding factory primitives in `packages/code-platform-interfaces`

If the open extraction branch lands first, this plan starts from a better baseline. If it does not, Phase 0 below should absorb that delta before broader follow-on work.

## External Trend Signals

The architecture direction remains aligned with current external standards and platform patterns.

### MCP

The official MCP roadmap dated 2026-03-09 prioritizes:

- transport scalability and stateless discovery metadata
- agent communication lifecycle hardening around the Tasks primitive
- enterprise readiness including audit trails and configuration portability
- extension-oriented evolution rather than making the base protocol heavier

This supports pushing HugeCode toward:

- inspectable provenance
- portable configuration layers
- explicit extension metadata
- runtime-backed evidence instead of UI-local reconstruction

### VS Code

The VS Code extension capability docs updated 2026-04-01 still center the model on:

- declarative contribution points
- capability registration
- extension-host separation from the workbench shell

This reinforces keeping `apps/code` as a shell consumer rather than letting it become the canonical plugin/composition owner.

### OpenFeature

OpenFeature continues to model configuration through:

- merged evaluation context
- client and invocation-scoped resolution
- lifecycle hooks before and after evaluation

This maps well to HugeCode's composition needs:

- global defaults
- workspace or surface-specific bindings
- launch/session overrides
- validation, telemetry, redaction, and trust hooks

### WebAssembly Component Model

The WebAssembly Component Model still treats imports and exports as a strict world boundary with strong sandboxing and explicit composition.

That is a good fit for HugeCode's future plugin-host direction:

- capability requirements stay explicit
- host bindings stay narrow
- future WASI or component execution can slot behind a host registry rather than leaking into UI orchestration

## Phase Structure

## Phase 0: Baseline Cutover

Complete or merge the already-started shared extraction baseline before opening another wide front.

### Required outputs

- land the shared backend-preference resolver
- land the shared composition config-hook pipeline
- land shared extension explainability helpers
- land capability registry and binding-factory helpers in `packages/code-platform-interfaces`
- rewire app consumers onto those shared modules

### Why this is first

Without this baseline, later extraction would keep duplicating effective-profile logic and host binding assumptions.

## Phase 1: Extract Shared Read-Only Control-Plane Composers

Move host-agnostic Mission Control and Review Pack composition out of `apps/code` and into `packages/code-application`.

### Scope

- extract pure read-only composers from:
  - `runtimeWorkspaceMissionControlProjection.ts`
  - `runtimeMissionControlRunProjection.ts`
  - `runtimeMissionControlReviewPackProjection.ts`
  - `runtimeMissionControlSurfaceModel.ts`
  - selected pure helpers from `runtimeReviewPackSurfaceFacade.ts`
- keep app-local only:
  - React hooks
  - navigation wiring
  - desktop/web host adaptation
  - view-model selection tied to app routes

### New package shape

Create a dedicated shared folder such as:

- `packages/code-application/src/runtime-control-plane/`

Candidate modules:

- `missionControlProjectionComposer.ts`
- `missionControlRunProjection.ts`
- `missionControlReviewPackProjection.ts`
- `missionControlSurfaceModel.ts`
- `reviewPackDetailComposer.ts`
- `reviewPackSelection.ts`

### Hard rules

- no new app-local DTO copies of host-contract or shared package types
- no page-local recomputation of review-pack or mission-control truth
- no direct feature imports from `apps/code/src/application/runtime/facades/*` for logic that can live in `packages/code-application`

## Phase 2: Move Composition Settings And Effective Profile State Into Shared Workspace Client

`packages/code-workspace-client` should become the shared state owner for composition settings and previewable effective profile state across desktop and web shells.

### Scope

- add shared composition settings state and selectors
- add shared settings-shell sections for profile selection, provenance preview, and backend preference explanation
- keep `apps/code` and `apps/code-web` as consumers of the same shared state path

### Candidate outputs

- `packages/code-workspace-client/src/settings-state/useRuntimeCompositionProfilesState.ts`
- `packages/code-workspace-client/src/settings-state/useRuntimeCompositionPreviewState.ts`
- `packages/code-workspace-client/src/settings-shell/RuntimeCompositionProfilesSection.tsx`
- `packages/code-platform-interfaces/src/runtimeCompositionSettings.ts`

### Key behavior

- enforce effective layer order:
  - `built_in`
  - `user`
  - `workspace`
  - `launch_override`
- show provenance rather than only final values
- keep page-level overrides transient and non-durable

## Phase 3: Make Invocation Evidence And Host Dispatch Runtime-Owned

Once the client-side composition path is shared, move the execution-facing seams toward the runtime.

### Contract additions

Add additive host-contract fields for:

- invocation provenance
- shadowing explanation
- host capability requirements
- preflight outcome
- post-execution shaping metadata
- observability / trust provenance

### Runtime additions

Add a runtime-owned invocation host registry in `packages/code-runtime-service-rs` that can model:

- built-in runtime tools
- runtime extension tools
- workspace skills
- reserved RPC host bindings
- reserved WASI/component hosts

### Why now

Main already hardened activation truth and composition vocabulary. The next maturity step is to stop treating invocation execution as a client convention and make it an inspectable runtime-owned path.

## Boundary And CI Work

Tighten repo governance alongside extraction so new code cannot regress into app-local truth ownership.

### Required rule updates

- extend `ui-service-boundary` to block new feature or shell imports from app-local control-plane composition files once shared equivalents exist
- add package-boundary checks so `packages/code-workspace-client` and `apps/code-web` consume shared control-plane modules instead of app-local facades
- keep `packages/code-application` dependent only on `code-platform-interfaces` abstractions, never concrete Electron or browser host implementations

## Recommended Execution Order

1. Finish Phase 0 or merge the equivalent extraction PR first.
2. Extract Mission Control shared composers.
3. Extract Review Pack shared composers.
4. Move composition settings state into `packages/code-workspace-client`.
5. Add runtime-owned invocation evidence and host registry.
6. Tighten boundary gates after each extraction instead of waiting until the end.

## Validation

### Required checks for Phase 1 and Phase 2

- targeted vitest coverage for moved composers
- `pnpm ui:contract`
- `pnpm check:ui-service-boundary`
- `pnpm validate`

### Required checks for Phase 3

- `pnpm --filter @ku0/code-runtime-host-contract test`
- targeted Rust tests in `packages/code-runtime-service-rs`
- `pnpm validate`
- `pnpm validate:full` if RPC/event contracts or CI wiring change

## Done Criteria

This phase is done only when:

- Mission Control and Review Pack read-only composition no longer live primarily in `apps/code`
- desktop and web shells consume the same shared composition/settings path
- effective profile provenance is inspectable from shared resolvers
- invocation evidence is additive in contract form and no longer inferred only in UI code
- future RPC/WASI/component hosts have an explicit model seam without expanding UI-side orchestration

## Sources

- MCP roadmap, 2026-03-09: https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
- MCP tools spec: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- VS Code extension capabilities overview: https://code.visualstudio.com/api/extension-capabilities/overview
- OpenFeature evaluation context: https://openfeature.dev/docs/reference/concepts/evaluation-context/
- OpenFeature hooks: https://openfeature.dev/docs/reference/concepts/hooks/
- WebAssembly Component Model worlds: https://component-model.bytecodealliance.org/design/worlds.html
