import type {
  AccessMode,
  AgentTaskRelaunchContext,
  AgentTaskSourceSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";
import type { HugeCodeOperatorTruthSource } from "@ku0/code-runtime-host-contract/hugeCodeOperatorLoop";
import { summarizeHugeCodeOperatorContinuation } from "@ku0/code-runtime-host-contract/hugeCodeOperatorLoop";
import { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";
import { type RuntimeContinuationTruthSource } from "./runtimeContinuationTruth";
import {
  resolveRepositoryExecutionDefaults,
  type RepositoryExecutionContract,
  type RepositoryExecutionExplicitLaunchInput,
  type SupportedRepositoryTaskSourceKind,
} from "./runtimeRepositoryExecutionContract";

export type ReviewContinuationIntent = "retry" | "clarify" | "switch_profile" | "pair_mode";

export type ReviewContinuationFieldOrigin =
  | "explicit_override"
  | "runtime_recorded"
  | "runtime_relaunch_context"
  | "repo_source_mapping"
  | "repo_defaults"
  | "runtime_fallback";

export type ReviewContinuationFieldOrigins = {
  executionProfileId: ReviewContinuationFieldOrigin;
  preferredBackendIds: ReviewContinuationFieldOrigin;
  accessMode: ReviewContinuationFieldOrigin;
  reviewProfileId: ReviewContinuationFieldOrigin;
  validationPresetId: ReviewContinuationFieldOrigin;
};

export type ReviewContinuationDefaults = {
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId: string | null;
  taskSource: AgentTaskSourceSummary | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  executionProfileId: string;
  preferredBackendIds?: string[];
  accessMode: AccessMode | null;
  reviewProfileId: string | null;
  validationPresetId: string | null;
  validationPresetLabel: string | null;
  validationCommands: string[];
  relaunchContext: AgentTaskRelaunchContext | null;
  fieldOrigins: ReviewContinuationFieldOrigins;
};

export type ReviewContinuationDraft = {
  intent: ReviewContinuationIntent;
  title: string;
  instruction: string;
  profileId: string;
  preferredBackendIds?: string[];
  reviewProfileId: string | null;
  validationPresetId: string | null;
  accessMode: AccessMode | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId: string | null;
  taskSource: AgentTaskSourceSummary | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  fieldOrigins: ReviewContinuationFieldOrigins;
};

export type ReviewContinuationActionabilitySummary = {
  state: "ready" | "degraded" | "blocked" | "missing";
  summary: string;
  details: string[];
  blockingReason: string | null;
  recommendedAction: string;
  continuePathLabel: "Mission thread" | "Mission run" | "Review Pack";
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
};

function mapTruthSource(source: HugeCodeOperatorTruthSource): RuntimeContinuationTruthSource {
  return source;
}

type RuntimeRecordedContinuationDefaults = {
  sourceTaskId: string;
  sourceRunId: string;
  sourceReviewPackId?: string | null;
  taskSource?: AgentTaskSourceSummary | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[];
  accessMode?: AccessMode | null;
  reviewProfileId?: string | null;
  validationPresetId?: string | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
};

export type RuntimeFollowUpPlacementInput = {
  requestedBackendIds: string[];
  lifecycleState: string;
  readiness: string | null;
};

type RepositoryContinuationFallback = {
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  executionProfileId: string | null;
  preferredBackendIds?: string[];
  accessMode: AccessMode | null;
  reviewProfileId: string | null;
  validationPresetId: string | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBackendIds(value: string[] | undefined | null): string[] | undefined {
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

function lookupValidationPresetMetadata(
  contract: RepositoryExecutionContract | null,
  validationPresetId: string | null
): {
  label: string | null;
  commands: string[];
} {
  if (!contract || !validationPresetId) {
    return {
      label: validationPresetId,
      commands: [],
    };
  }
  const preset =
    contract.validationPresets.find((entry) => entry.id === validationPresetId) ?? null;
  return {
    label: preset?.label ?? validationPresetId,
    commands: preset?.commands ?? [],
  };
}

function hasRuntimePolicyDefaults(input: RuntimeRecordedContinuationDefaults): boolean {
  return Boolean(
    readOptionalText(input.executionProfileId) ||
    readOptionalText(input.accessMode) ||
    readOptionalText(input.reviewProfileId) ||
    readOptionalText(input.validationPresetId)
  );
}

function resolveRepoFieldOrigin(input: {
  contract: RepositoryExecutionContract | null;
  sourceMappingKind: SupportedRepositoryTaskSourceKind | null;
  field:
    | "executionProfileId"
    | "preferredBackendIds"
    | "accessMode"
    | "reviewProfileId"
    | "validationPresetId";
  value: string | AccessMode | string[] | null | undefined;
}): ReviewContinuationFieldOrigin {
  const { contract, sourceMappingKind, field, value } = input;
  const normalizedValue = Array.isArray(value) ? value.join("|") : value;
  if (
    sourceMappingKind &&
    contract?.sourceMappings[sourceMappingKind] &&
    (() => {
      const sourceValue = contract.sourceMappings[sourceMappingKind]?.[field];
      const normalizedSourceValue = Array.isArray(sourceValue)
        ? sourceValue.join("|")
        : sourceValue;
      return normalizedSourceValue === normalizedValue;
    })()
  ) {
    return "repo_source_mapping";
  }
  if (
    contract?.defaults[field] !== undefined &&
    normalizedValue !== undefined &&
    normalizedValue !== null
  ) {
    const defaultsValue = contract.defaults[field];
    const normalizedDefaultsValue = Array.isArray(defaultsValue)
      ? defaultsValue.join("|")
      : defaultsValue;
    if (normalizedDefaultsValue === normalizedValue) {
      return "repo_defaults";
    }
  }
  return "runtime_fallback";
}

export function resolveRuntimeFollowUpPreferredBackendIds(
  placement: RuntimeFollowUpPlacementInput | null | undefined,
  backendId: string | null | undefined
) {
  if ((placement?.requestedBackendIds.length ?? 0) > 0) {
    return placement?.requestedBackendIds;
  }
  return typeof backendId === "string" && backendId.trim().length > 0
    ? [backendId.trim()]
    : undefined;
}

function mapTakeoverStateToReviewContinuationState(
  state: HugeCodeTakeoverBundle["state"] | null | undefined
): ReviewContinuationActionabilitySummary["state"] {
  if (state === "ready") {
    return "ready";
  }
  if (state === "attention") {
    return "degraded";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

export function summarizeReviewContinuationActionability(input: {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
}): ReviewContinuationActionabilitySummary {
  const shared = summarizeHugeCodeOperatorContinuation({
    takeoverBundle: input.takeoverBundle ?? null,
    reviewActionability: input.actionability ?? null,
    missionLinkage: input.missionLinkage ?? null,
    publishHandoff: input.publishHandoff ?? null,
  });
  return {
    state:
      shared.state === "ready"
        ? "ready"
        : shared.state === "blocked"
          ? "blocked"
          : shared.state === "degraded"
            ? "degraded"
            : mapTakeoverStateToReviewContinuationState(input.takeoverBundle?.state),
    summary: shared.summary,
    details: shared.details,
    blockingReason: shared.blockingReason,
    recommendedAction: shared.recommendedAction,
    continuePathLabel: shared.continuePathLabel,
    truthSource: mapTruthSource(shared.truthSource),
    truthSourceLabel: shared.truthSourceLabel,
  };
}

export function resolveReviewContinuationDefaults(input: {
  contract: RepositoryExecutionContract | null;
  taskSource?: AgentTaskSourceSummary | null;
  runtimeDefaults: RuntimeRecordedContinuationDefaults;
  explicitLaunchInput?: RepositoryExecutionExplicitLaunchInput;
  fallbackProfileId?: string | null;
}): ReviewContinuationDefaults {
  const runtimeTaskSource = input.runtimeDefaults.taskSource ?? input.taskSource ?? null;
  const runtimeOwnsPolicyDefaults = hasRuntimePolicyDefaults(input.runtimeDefaults);
  const fieldOriginContract = runtimeOwnsPolicyDefaults ? null : input.contract;
  const repoDefaults: RepositoryContinuationFallback = runtimeOwnsPolicyDefaults
    ? {
        sourceMappingKind: null,
        executionProfileId: null,
        preferredBackendIds: undefined,
        accessMode: null,
        reviewProfileId: null,
        validationPresetId: null,
      }
    : resolveRepositoryExecutionDefaults({
        contract: input.contract,
        taskSource: runtimeTaskSource,
        explicitLaunchInput: {},
      });
  const explicit = input.explicitLaunchInput ?? {};
  const explicitExecutionProfileId = readOptionalText(explicit.executionProfileId);
  const explicitBackendIds = normalizeBackendIds(explicit.preferredBackendIds);
  const explicitAccessMode = readOptionalText(explicit.accessMode) as AccessMode | null;
  const explicitReviewProfileId = readOptionalText(explicit.reviewProfileId);
  const explicitValidationPresetId = readOptionalText(explicit.validationPresetId);

  const runtimeExecutionProfileId = readOptionalText(input.runtimeDefaults.executionProfileId);
  const runtimeBackendIds = normalizeBackendIds(input.runtimeDefaults.preferredBackendIds);
  const runtimeAccessMode = readOptionalText(input.runtimeDefaults.accessMode) as AccessMode | null;
  const runtimeReviewProfileId = readOptionalText(input.runtimeDefaults.reviewProfileId);
  const runtimeValidationPresetId = readOptionalText(input.runtimeDefaults.validationPresetId);

  const executionProfileId =
    explicitExecutionProfileId ??
    runtimeExecutionProfileId ??
    repoDefaults.executionProfileId ??
    readOptionalText(input.fallbackProfileId) ??
    "balanced-delegate";
  const preferredBackendIds =
    explicitBackendIds ?? runtimeBackendIds ?? repoDefaults.preferredBackendIds ?? undefined;
  const accessMode =
    explicitAccessMode ??
    runtimeAccessMode ??
    repoDefaults.accessMode ??
    profileAccessMode(executionProfileId);
  const reviewProfileId =
    explicitReviewProfileId ?? runtimeReviewProfileId ?? repoDefaults.reviewProfileId;
  const validationPresetId =
    explicitValidationPresetId ??
    runtimeValidationPresetId ??
    repoDefaults.validationPresetId ??
    profileValidationPresetId(executionProfileId);
  const validationPresetMetadata = lookupValidationPresetMetadata(
    input.contract,
    validationPresetId
  );

  return {
    sourceTaskId:
      readOptionalText(input.runtimeDefaults.relaunchContext?.sourceTaskId) ??
      input.runtimeDefaults.sourceTaskId,
    sourceRunId:
      readOptionalText(input.runtimeDefaults.relaunchContext?.sourceRunId) ??
      input.runtimeDefaults.sourceRunId,
    sourceReviewPackId:
      readOptionalText(input.runtimeDefaults.sourceReviewPackId) ??
      readOptionalText(input.runtimeDefaults.relaunchContext?.sourceReviewPackId) ??
      null,
    taskSource: runtimeTaskSource,
    sourceMappingKind: repoDefaults.sourceMappingKind,
    executionProfileId,
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    accessMode,
    reviewProfileId,
    validationPresetId,
    validationPresetLabel: validationPresetMetadata.label,
    validationCommands: validationPresetMetadata.commands,
    relaunchContext: input.runtimeDefaults.relaunchContext ?? null,
    fieldOrigins: {
      executionProfileId: explicitExecutionProfileId
        ? "explicit_override"
        : runtimeExecutionProfileId
          ? "runtime_recorded"
          : resolveRepoFieldOrigin({
              contract: fieldOriginContract,
              sourceMappingKind: repoDefaults.sourceMappingKind,
              field: "executionProfileId",
              value: executionProfileId,
            }),
      preferredBackendIds: explicitBackendIds
        ? "explicit_override"
        : runtimeBackendIds
          ? "runtime_recorded"
          : resolveRepoFieldOrigin({
              contract: fieldOriginContract,
              sourceMappingKind: repoDefaults.sourceMappingKind,
              field: "preferredBackendIds",
              value: preferredBackendIds,
            }),
      accessMode: explicitAccessMode
        ? "explicit_override"
        : runtimeAccessMode
          ? "runtime_recorded"
          : resolveRepoFieldOrigin({
              contract: fieldOriginContract,
              sourceMappingKind: repoDefaults.sourceMappingKind,
              field: "accessMode",
              value: accessMode,
            }),
      reviewProfileId: explicitReviewProfileId
        ? "explicit_override"
        : runtimeReviewProfileId
          ? "runtime_recorded"
          : resolveRepoFieldOrigin({
              contract: fieldOriginContract,
              sourceMappingKind: repoDefaults.sourceMappingKind,
              field: "reviewProfileId",
              value: reviewProfileId,
            }),
      validationPresetId: explicitValidationPresetId
        ? "explicit_override"
        : runtimeValidationPresetId
          ? "runtime_recorded"
          : resolveRepoFieldOrigin({
              contract: fieldOriginContract,
              sourceMappingKind: repoDefaults.sourceMappingKind,
              field: "validationPresetId",
              value: validationPresetId,
            }),
    },
  };
}

export function prepareReviewContinuationDraft(input: {
  contract: RepositoryExecutionContract | null;
  taskSource?: AgentTaskSourceSummary | null;
  runtimeDefaults: RuntimeRecordedContinuationDefaults;
  explicitLaunchInput?: RepositoryExecutionExplicitLaunchInput;
  intent: ReviewContinuationIntent;
  title: string;
  instruction: string;
  fallbackProfileId?: string | null;
}): ReviewContinuationDraft {
  const resolved = resolveReviewContinuationDefaults({
    contract: input.contract,
    taskSource: input.taskSource,
    runtimeDefaults: input.runtimeDefaults,
    explicitLaunchInput: input.explicitLaunchInput,
    fallbackProfileId: input.fallbackProfileId,
  });

  return {
    intent: input.intent,
    title: input.title.trim(),
    instruction: input.instruction,
    profileId: resolved.executionProfileId,
    ...(resolved.preferredBackendIds ? { preferredBackendIds: resolved.preferredBackendIds } : {}),
    reviewProfileId: resolved.reviewProfileId,
    validationPresetId: resolved.validationPresetId,
    accessMode: resolved.accessMode,
    ...(resolved.relaunchContext ? { relaunchContext: resolved.relaunchContext } : {}),
    sourceTaskId: resolved.sourceTaskId,
    sourceRunId: resolved.sourceRunId,
    sourceReviewPackId: resolved.sourceReviewPackId,
    taskSource: resolved.taskSource,
    sourceMappingKind: resolved.sourceMappingKind,
    fieldOrigins: resolved.fieldOrigins,
  };
}
