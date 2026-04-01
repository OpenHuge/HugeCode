# Runtime Executable Skill Gate

## What is now canonical

- Internal runtime skill execution no longer treats `runLiveSkill()` as live truth.
- The canonical execution-readiness source is now the activation-backed executable skill facade, which derives from `invocations.catalog` and only falls back to `listLiveSkills()` when invocation readers are unavailable.
- WebMCP delegated skill resolution, AutoDrive validation/research, and kernel live-skill plugin execution now share the same alias, readiness, and non-live explanation path.
- WebMCP workspace and direct live-skill execution tools now also prefer `runRuntimeExecutableSkill` for actual execution, not only activation-backed preflight checks.
- WebMCP runtime tool publication now hides a narrow set of skill-backed tools when activation truth reports their backing skill as non-live. `list-runtime-live-skills` and `run-runtime-live-skill` remain published so callers can still inspect availability and use the generic execution path when appropriate.

## What remains transport-only

- `runLiveSkill()` remains the bounded execution transport.
- `runtimeLiveSkillsBridge.ts` and the debug runtime probe still expose that raw transport intentionally, but they are documented as non-canonical.

## What still remains on older paths

- Product surfaces that directly probe raw runtime execution outside WebMCP, AutoDrive, and kernel plugin execution still need migration if they want activation-backed readiness semantics.
- `runtimeToolExposurePolicy` remains a provider/catalog-shaping policy layer. Activation-aware publication currently applies only to the app-local WebMCP runtime sync path for dedicated skill-backed tools.

## Recommended next follow-up

- Move additional internal execution consumers onto `runRuntimeExecutableSkill`.
- Extend activation-aware publication beyond the first WebMCP skill-backed tool set if more runtime tools gain a one-to-one executable skill dependency.
- If operator-facing UX needs richer explanations, render `RuntimeSkillExecutionGateError` state directly instead of flattening it into generic execution failure text.
