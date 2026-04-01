# Runtime Executable Skill Gate

## What is now canonical

- Internal runtime skill execution no longer treats `runLiveSkill()` as live truth.
- The canonical execution-readiness source is now the activation-backed executable skill facade, which derives from `invocations.catalog` and only falls back to `listLiveSkills()` when invocation readers are unavailable.
- WebMCP delegated skill resolution, AutoDrive validation/research, and kernel live-skill plugin execution now share the same alias, readiness, and non-live explanation path.

## What remains transport-only

- `runLiveSkill()` remains the bounded execution transport.
- `runtimeLiveSkillsBridge.ts` and the debug runtime probe still expose that raw transport intentionally, but they are documented as non-canonical.

## What still remains on older paths

- Product surfaces that directly probe raw runtime execution outside WebMCP, AutoDrive, and kernel plugin execution still need migration if they want activation-backed readiness semantics.
- `runtimeToolExposurePolicy` remains a catalog-shaping policy layer, not an activation-aware execution gate.

## Recommended next follow-up

- Move additional internal execution consumers onto `runRuntimeExecutableSkill`.
- Decide whether tool exposure should become activation-aware for selected provider/tool-profile combinations, as a separate slice from execution gating.
- If operator-facing UX needs richer explanations, render `RuntimeSkillExecutionGateError` state directly instead of flattening it into generic execution failure text.
