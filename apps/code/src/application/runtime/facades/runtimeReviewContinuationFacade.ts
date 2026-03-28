import type {
  AccessMode,
  AgentTaskRelaunchContext,
  AgentTaskSourceSummary,
  HugeCodeContinuationSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeContinuationDescriptor,
  formatRuntimeContinuationTruthSourceLabel,
  type RuntimeContinuationTruthSource,
} from "./runtimeContinuationTruth";
import {
  type RepositoryExecutionContract,
  type RepositoryExecutionExplicitLaunchInput,
} from "./runtimeRepositoryExecutionContract";

export type ReviewContinuationIntent = "retry" | "clarify" | "switch_profile" | "pair_mode";

export type ReviewContinuationFieldOrigin =
  | "explicit_override"
  | "runtime_recorded"
  | "runtime_relaunch_context";

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
  fieldOrigins: ReviewContinuationFieldOrigins;
};

export type ReviewContinuationActionabilitySummary = {
  state: "ready" | "degraded" | "blocked" | "missing";
  summary: string;
  details: string[];
  blockingReason: string | null;
  recommendedAction: string;
  continuePathLabel: "Mission thread" | "Mission run" | "Review Pack" | "Sub-agent session";
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
};

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

function mapPublishedContinuationState(
  state: HugeCodeContinuationSummary["state"]
): ReviewContinuationActionabilitySummary["state"] {
  if (state === "attention") {
    return "degraded";
  }
  if (state === "ready" || state === "blocked") {
    return state;
  }
  return "missing";
}

function resolvePublishedContinuePathLabel(
  continuation: HugeCodeContinuationSummary
): ReviewContinuationActionabilitySummary["continuePathLabel"] {
  if (continuation.pathKind === "review" || continuation.target?.kind === "review_pack") {
    return "Review Pack";
  }
  if (continuation.target?.kind === "thread") {
    return "Mission thread";
  }
  if (continuation.target?.kind === "run") {
    return "Mission run";
  }
  if (continuation.target?.kind === "sub_agent_session") {
    return "Sub-agent session";
  }
  return "Review Pack";
}

function pushUniqueDetail(details: string[], value: string | null | undefined) {
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed || details.includes(trimmed)) {
    return;
  }
  details.push(trimmed);
}

export function summarizeReviewContinuationActionability(input: {
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  reviewPackId?: string | null;
  continuation?: HugeCodeContinuationSummary | null;
}): ReviewContinuationActionabilitySummary {
  if (input.continuation) {
    const continuePathLabel = resolvePublishedContinuePathLabel(input.continuation);
    const truthSource = input.continuation.source as RuntimeContinuationTruthSource;
    const truthSourceLabel = formatRuntimeContinuationTruthSourceLabel(truthSource);
    const summary =
      (input.continuation.pathKind === "review"
        ? input.continuation.reviewActionability?.summary
        : null) ?? input.continuation.summary;
    const details: string[] = [];
    pushUniqueDetail(details, input.continuation.detail ?? summary);
    pushUniqueDetail(details, `Canonical continue path: ${continuePathLabel}.`);
    pushUniqueDetail(details, `Follow-up source: ${truthSourceLabel}.`);
    pushUniqueDetail(details, input.missionLinkage?.summary);
    pushUniqueDetail(details, input.publishHandoff?.summary);
    const state = mapPublishedContinuationState(input.continuation.state);
    return {
      state,
      summary,
      details,
      blockingReason: state === "blocked" ? (input.continuation.detail ?? summary) : null,
      recommendedAction: input.continuation.recommendedAction,
      continuePathLabel,
      truthSource,
      truthSourceLabel,
    };
  }
  const descriptor = buildRuntimeContinuationDescriptor({
    takeoverBundle: input.takeoverBundle ?? null,
    actionability: input.actionability ?? null,
    missionLinkage: input.missionLinkage ?? null,
    publishHandoff: input.publishHandoff ?? null,
    reviewPackId: input.reviewPackId ?? null,
    continuation: input.continuation ?? null,
  });
  const summary = descriptor?.summary ?? "Runtime continuation guidance is unavailable.";
  const state =
    descriptor?.state === "attention"
      ? "degraded"
      : descriptor?.state === "ready" || descriptor?.state === "blocked"
        ? descriptor.state
        : "missing";
  return {
    state,
    summary,
    details: descriptor?.details ?? [
      "Runtime continuation guidance is unavailable.",
      "Follow-up source: Runtime truth unavailable.",
    ],
    blockingReason: descriptor?.blockingReason ?? (state === "blocked" ? summary : null),
    recommendedAction:
      descriptor?.recommendedAction ?? "Inspect the recorded runtime truth before continuing.",
    continuePathLabel: descriptor?.continuePathLabel ?? "Review Pack",
    truthSource: descriptor?.truthSource ?? "missing",
    truthSourceLabel: descriptor?.truthSourceLabel ?? "Runtime truth unavailable",
  };
}

export function resolveReviewContinuationDefaults(input: {
  contract: RepositoryExecutionContract | null;
  taskSource?: AgentTaskSourceSummary | null;
  runtimeDefaults: RuntimeRecordedContinuationDefaults;
  explicitLaunchInput?: RepositoryExecutionExplicitLaunchInput;
  fallbackProfileId?: string | null;
}): ReviewContinuationDefaults | null {
  const runtimeTaskSource = input.runtimeDefaults.taskSource ?? input.taskSource ?? null;
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
  const relaunchSourceTaskId = readOptionalText(
    input.runtimeDefaults.relaunchContext?.sourceTaskId
  );
  const relaunchSourceRunId = readOptionalText(input.runtimeDefaults.relaunchContext?.sourceRunId);
  const relaunchSourceReviewPackId = readOptionalText(
    input.runtimeDefaults.relaunchContext?.sourceReviewPackId
  );

  const executionProfileId =
    explicitExecutionProfileId ??
    runtimeExecutionProfileId ??
    readOptionalText(input.fallbackProfileId);
  if (!executionProfileId) {
    return null;
  }
  const preferredBackendIds = explicitBackendIds ?? runtimeBackendIds ?? undefined;
  const accessMode = explicitAccessMode ?? runtimeAccessMode ?? null;
  const reviewProfileId = explicitReviewProfileId ?? runtimeReviewProfileId;
  const validationPresetId = explicitValidationPresetId ?? runtimeValidationPresetId;
  const validationPresetMetadata = lookupValidationPresetMetadata(
    input.contract,
    validationPresetId
  );

  return {
    sourceTaskId: relaunchSourceTaskId ?? input.runtimeDefaults.sourceTaskId,
    sourceRunId: relaunchSourceRunId ?? input.runtimeDefaults.sourceRunId,
    sourceReviewPackId:
      readOptionalText(input.runtimeDefaults.sourceReviewPackId) ??
      relaunchSourceReviewPackId ??
      null,
    taskSource: runtimeTaskSource,
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
        : runtimeExecutionProfileId || readOptionalText(input.fallbackProfileId)
          ? "runtime_recorded"
          : "runtime_relaunch_context",
      preferredBackendIds: explicitBackendIds
        ? "explicit_override"
        : runtimeBackendIds
          ? "runtime_recorded"
          : "runtime_relaunch_context",
      accessMode: explicitAccessMode
        ? "explicit_override"
        : runtimeAccessMode
          ? "runtime_recorded"
          : "runtime_relaunch_context",
      reviewProfileId: explicitReviewProfileId
        ? "explicit_override"
        : runtimeReviewProfileId
          ? "runtime_recorded"
          : "runtime_relaunch_context",
      validationPresetId: explicitValidationPresetId
        ? "explicit_override"
        : runtimeValidationPresetId
          ? "runtime_recorded"
          : "runtime_relaunch_context",
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
}): ReviewContinuationDraft | null {
  const resolved = resolveReviewContinuationDefaults({
    contract: input.contract,
    taskSource: input.taskSource,
    runtimeDefaults: input.runtimeDefaults,
    explicitLaunchInput: input.explicitLaunchInput,
    fallbackProfileId: input.fallbackProfileId,
  });
  if (!resolved) {
    return null;
  }

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
    fieldOrigins: resolved.fieldOrigins,
  };
}
