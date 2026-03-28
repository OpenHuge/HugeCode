# Provider Capability Matrix Baseline

Date: 2026-03-28
Status: active

## Goal

Make provider/model capability differences explicit in shared runtime contracts so runtime-aware
consumers can branch safely without collapsing to a fake universal model surface.

## Contract Shape

- `RuntimeProviderCatalogEntry.capabilityMatrix`
  Provider-level capability summary for routing-aware consumers.
- `ModelPoolEntry.capabilityMatrix`
  Model-level capability summary for concrete launch/input decisions.
- Existing legacy fields such as `supportsReasoning`, `supportsVision`, and `reasoningEfforts`
  stay intact for compatibility during the migration window.

## Capability Matrix Fields

- `supportsTools`
- `supportsReasoningEffort`
- `supportsVision`
- `supportsJsonSchema`
- `maxContextTokens`
- `supportedReasoningEfforts`

Support values are explicit tri-state values: `supported`, `unsupported`, or `unknown`.
This keeps the contract honest when runtime has not yet proven a capability.

## Compatibility Behavior

- Runtime publishes the additive `capabilityMatrix` field.
- Shared client code normalizes both `capabilityMatrix` and legacy fallback fields.
- If runtime explicitly reports `unknown`, the compat shim preserves `unknown`.
- If runtime does not publish the new field yet, the compat shim derives the narrowest safe matrix
  it can from legacy fields instead of inventing a lowest-common-denominator abstraction.

## Narrow Proof Slice

The first consumer is reasoning-effort selection in `apps/code`.

- The selected model keeps using runtime-owned model metadata.
- The app clamps a requested reasoning effort against the normalized model capability matrix.
- Unsupported efforts fall back to the model's compatible default or first supported effort.

This proves capability-aware branching without changing lifecycle truth, runtime routing ownership,
or page-local orchestration boundaries.
