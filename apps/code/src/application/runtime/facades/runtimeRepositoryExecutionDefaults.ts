import type { AccessMode, AgentTaskSourceSummary } from "@ku0/code-runtime-host-contract";
import {
  type RepositoryExecutionContract,
  type RepositoryExecutionExplicitLaunchInput,
  type ResolvedRepositoryExecutionDefaults,
  type SupportedRepositoryTaskSourceKind,
} from "./runtimeRepositoryExecutionContract";
import { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBackendIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids.length > 0 ? ids : undefined;
}

function readSourceMappingKind(value: string): SupportedRepositoryTaskSourceKind | null {
  switch (value) {
    case "manual":
    case "github_issue":
    case "github_pr_followup":
    case "github_discussion":
    case "note":
    case "customer_feedback":
    case "doc":
    case "call_summary":
    case "external_ref":
    case "schedule":
      return value;
    default:
      return null;
  }
}

function normalizeTaskSourceKind(
  taskSource: AgentTaskSourceSummary | null | undefined
): SupportedRepositoryTaskSourceKind {
  const kind = readSourceMappingKind(taskSource?.kind ?? "manual");
  return kind ?? "manual";
}

function profileValidationPresetId(profileId: string | null): string | null {
  if (!profileId) {
    return null;
  }
  return (
    listRunExecutionProfiles().find((profile) => profile.id === profileId)?.validationPresetId ??
    null
  );
}

function profileAccessMode(profileId: string | null): AccessMode | null {
  if (!profileId) {
    return null;
  }
  return listRunExecutionProfiles().find((profile) => profile.id === profileId)?.accessMode ?? null;
}

export function resolveRepositoryExecutionDefaults(input: {
  contract: RepositoryExecutionContract | null;
  taskSource: AgentTaskSourceSummary | null | undefined;
  explicitLaunchInput?: RepositoryExecutionExplicitLaunchInput;
}): ResolvedRepositoryExecutionDefaults {
  const sourceMappingKind = normalizeTaskSourceKind(input.taskSource);
  const sourceMapping = input.contract?.sourceMappings[sourceMappingKind];
  const defaults = input.contract?.defaults ?? {};
  const explicit = input.explicitLaunchInput ?? {};
  const explicitExecutionProfileId = readOptionalText(explicit.executionProfileId);
  const explicitValidationPresetId = readOptionalText(explicit.validationPresetId);
  const explicitBackendIds = normalizeBackendIds(explicit.preferredBackendIds);
  const explicitDefaultBackendId = readOptionalText(explicit.defaultBackendId);
  const explicitAccessMode = readOptionalText(explicit.accessMode) as AccessMode | null;

  const executionProfileId =
    explicitExecutionProfileId ??
    sourceMapping?.executionProfileId ??
    defaults.executionProfileId ??
    null;
  const explicitReviewProfileId = readOptionalText(explicit.reviewProfileId);
  const reviewProfileId =
    explicitReviewProfileId ??
    sourceMapping?.reviewProfileId ??
    defaults.reviewProfileId ??
    input.contract?.defaultReviewProfileId ??
    null;
  const reviewProfile =
    reviewProfileId === null
      ? null
      : (input.contract?.reviewProfiles.find((profile) => profile.id === reviewProfileId) ?? null);
  const validationPresetId =
    explicitValidationPresetId ??
    sourceMapping?.validationPresetId ??
    defaults.validationPresetId ??
    reviewProfile?.validationPresetId ??
    profileValidationPresetId(executionProfileId);
  const preferredBackendIds =
    explicitBackendIds ??
    sourceMapping?.preferredBackendIds ??
    defaults.preferredBackendIds ??
    undefined;
  const defaultBackendId = explicitDefaultBackendId ?? null;
  const accessMode =
    explicitAccessMode ??
    sourceMapping?.accessMode ??
    defaults.accessMode ??
    profileAccessMode(executionProfileId);
  const validationPreset =
    validationPresetId === null
      ? null
      : (input.contract?.validationPresets.find((preset) => preset.id === validationPresetId) ??
        null);

  return {
    contract: input.contract,
    sourceMappingKind: input.contract?.sourceMappings[sourceMappingKind] ? sourceMappingKind : null,
    executionProfileId,
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    ...(defaultBackendId ? { defaultBackendId } : {}),
    accessMode,
    reviewProfileId,
    reviewProfile,
    validationPresetId,
    validationPresetLabel: validationPreset?.label ?? validationPresetId,
    validationCommands: validationPreset?.commands ?? [],
    repoInstructions: defaults.guidance?.instructions ?? [],
    repoSkillIds: defaults.guidance?.skillIds ?? [],
    sourceInstructions: sourceMapping?.guidance?.instructions ?? [],
    sourceSkillIds: sourceMapping?.guidance?.skillIds ?? [],
    owner: sourceMapping?.triage?.owner ?? defaults.triage?.owner ?? null,
    triagePriority: sourceMapping?.triage?.priority ?? defaults.triage?.priority ?? null,
    triageRiskLevel: sourceMapping?.triage?.riskLevel ?? defaults.triage?.riskLevel ?? null,
    triageTags: sourceMapping?.triage?.tags ?? defaults.triage?.tags ?? [],
  };
}
