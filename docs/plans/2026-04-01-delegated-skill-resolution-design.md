# Delegated Skill Resolution from Activation Truth

## What is now canonical

- Delegated WebMCP skill resolution now reads `runtimeControl.listRuntimeInvocations({ sessionId, kind: "skill" })` as the canonical live/readiness source when that capability is available.
- `allowedSkillResolution` now carries `catalogSessionId` plus per-skill `availability` metadata with `invocationId`, `live`, `activationState`, and `readiness`.
- `catalogSessionId` is an invocation-catalog scope selector only. It does not mutate or extend the runtime sub-agent session contract.

## What remains compatibility-only

- `listLiveSkills()` remains as the legacy fallback when an embed does not expose `listRuntimeInvocations`.
- `runLiveSkill()` remains the execution transport for bounded skill execution.

## Remaining old inference paths

- Non-delegated execution consumers that still call `listLiveSkills()` directly continue to rely on compatibility transport behavior.
- Broader product surfaces outside the delegated WebMCP/sub-agent path have not been converted in this slice.

## Recommended next follow-up

- Move the remaining non-delegated live-skill discovery and execution-preflight paths onto activation-backed invocation availability.
- Add operator-facing surfaces that render degraded / failed / deactivated / refresh-pending invocation explanations directly from invocation catalog metadata instead of recreating those semantics locally.
