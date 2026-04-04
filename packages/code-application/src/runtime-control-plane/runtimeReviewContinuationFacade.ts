import type {
  AccessMode,
  AgentTaskRelaunchContext,
  HugeCodeCheckpointSummary,
  AgentTaskSourceSummary,
  HugeCodeContinuationSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeRunState,
  HugeCodeTakeoverBundle,
  RuntimeContinuationPathKind,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeContinuationDescriptor,
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

export type ReviewContinuationCheckpointDurabilityState =
  | "ready"
  | "attention"
  | "blocked"
  | "unknown";

export type ReviewContinuationActionabilitySummary = {
  state: "ready" | "attention" | "blocked" | "missing";
  summary: string;
  details: string[];
  blockingReason: string | null;
  recommendedAction: string;
  pathKind: RuntimeContinuationPathKind;
  continuePathLabel: "Mission thread" | "Mission run" | "Review Pack" | "Sub-agent session";
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
  canSafelyContinue: boolean;
  hasHandoffPath: boolean;
  reviewFollowUpActionable: boolean;
  checkpointDurabilityState: ReviewContinuationCheckpointDurabilityState;
  continuityOverview: string;
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

function resolveCheckpointDurabilityState(input: {
  checkpoint: HugeCodeCheckpointSummary | null;
  state: ReviewContinuationActionabilitySummary["state"];
}): ReviewContinuationCheckpointDurabilityState {
  if (!input.checkpoint) {
    return "unknown";
  }
  if (input.checkpoint.resumeReady === true) {
    return "ready";
  }
  if (input.state === "blocked") {
    return "blocked";
  }
  return "attention";
}

function buildReviewContinuationOverview(input: {
  state: ReviewContinuationActionabilitySummary["state"];
  canSafelyContinue: boolean;
  hasHandoffPath: boolean;
  reviewFollowUpActionable: boolean;
  checkpointDurabilityState: ReviewContinuationCheckpointDurabilityState;
  hasReviewFollowUpTruth: boolean;
}) {
  const safeContinueLabel = input.canSafelyContinue
    ? "Safe continue path published."
    : "Safe continue path unavailable.";
  const handoffLabel = input.hasHandoffPath
    ? "Handoff path available."
    : "Handoff path unavailable.";
  const reviewLabel = input.reviewFollowUpActionable
    ? "Review follow-up actionable."
    : input.hasReviewFollowUpTruth
      ? input.state === "blocked"
        ? "Review follow-up blocked."
        : input.state === "attention"
          ? "Review follow-up needs attention."
          : "Review follow-up unavailable."
      : "Review follow-up unavailable.";
  const checkpointLabel =
    input.checkpointDurabilityState === "ready"
      ? "Checkpoint durability ready."
      : input.checkpointDurabilityState === "attention"
        ? "Checkpoint durability warning."
        : input.checkpointDurabilityState === "blocked"
          ? "Checkpoint durability blocked."
          : "Checkpoint durability unknown.";
  return [
    `Continuity readiness ${input.state}.`,
    safeContinueLabel,
    handoffLabel,
    reviewLabel,
    checkpointLabel,
  ].join(" ");
}

export function summarizeReviewContinuationActionability(input: {
  runState?: string | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  reviewPackId?: string | null;
  continuation?: HugeCodeContinuationSummary | null;
}): ReviewContinuationActionabilitySummary {
  const descriptor = buildRuntimeContinuationDescriptor({
    runState:
      input.runState === null || input.runState === undefined
        ? null
        : (input.runState as HugeCodeRunState),
    checkpoint: input.checkpoint ?? null,
    takeoverBundle: input.takeoverBundle ?? null,
    actionability: input.actionability ?? null,
    missionLinkage: input.missionLinkage ?? null,
    publishHandoff: input.publishHandoff ?? null,
    reviewPackId: input.reviewPackId ?? null,
    continuation: input.continuation ?? null,
  });
  const summary = descriptor?.summary ?? "Runtime continuation guidance is unavailable.";
  const state = descriptor?.state ?? "missing";
  const hasReviewFollowUpTruth = Boolean(
    descriptor?.pathKind === "review" ||
    input.actionability ||
    input.takeoverBundle?.reviewActionability ||
    input.continuation?.pathKind === "review"
  );
  const canSafelyContinue = Boolean(
    descriptor && descriptor.state === "ready" && descriptor.pathKind !== "missing"
  );
  const hasHandoffPath = Boolean(
    descriptor?.pathKind === "handoff" ||
    input.publishHandoff ||
    input.takeoverBundle?.publishHandoff ||
    input.missionLinkage?.recoveryPath
  );
  const reviewFollowUpActionable = Boolean(
    descriptor?.pathKind === "review" && descriptor.state === "ready"
  );
  const checkpointDurabilityState = resolveCheckpointDurabilityState({
    checkpoint: input.checkpoint ?? null,
    state,
  });
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
    pathKind: descriptor?.pathKind ?? "missing",
    continuePathLabel: descriptor?.continuePathLabel ?? "Review Pack",
    truthSource: descriptor?.truthSource ?? "missing",
    truthSourceLabel: descriptor?.truthSourceLabel ?? "Runtime truth unavailable",
    canSafelyContinue,
    hasHandoffPath,
    reviewFollowUpActionable,
    checkpointDurabilityState,
    continuityOverview: buildReviewContinuationOverview({
      state,
      canSafelyContinue,
      hasHandoffPath,
      reviewFollowUpActionable,
      checkpointDurabilityState,
      hasReviewFollowUpTruth,
    }),
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
