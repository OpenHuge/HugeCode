import type {
  HugeCodeNextOperatorAction,
  HugeCodeReviewPackSummary,
  HugeCodeTakeoverTarget,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeTruthCompatInputFromRunReviewPair,
  resolveCanonicalRuntimeTruth,
} from "@ku0/code-runtime-host-contract";
import type { HugeCodeMissionControlSnapshot as MissionControlProjection } from "@ku0/code-runtime-host-contract";
import { buildRuntimeContinuationDescriptor } from "./runtimeContinuationTruth";
import { readRuntimeOperatorActionText } from "./runtimeOperatorActionPresentation";
import type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";

type MissionOperatorActionInput = {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
};

type MissionOperatorActionContext = MissionOperatorActionInput & {
  workspaceId: string;
  threadId: string | null;
  taskId: string;
  runId: string | null;
  missionTarget: MissionNavigationTarget;
  reviewTarget: MissionNavigationTarget;
  defaultActiveLabel: string;
};

export type MissionOperatorActionModel = {
  label: string;
  detail: string | null;
  target: MissionNavigationTarget;
};

function readOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveCanonicalTruth(
  input: MissionOperatorActionInput &
    Partial<Pick<MissionOperatorActionContext, "workspaceId" | "taskId" | "runId">>
) {
  const compatInput = buildRuntimeTruthCompatInputFromRunReviewPair(input);
  return resolveCanonicalRuntimeTruth({
    ...compatInput,
    workspaceId: input.workspaceId ?? compatInput.workspaceId ?? null,
    taskId: input.taskId ?? compatInput.taskId ?? null,
    runId: input.runId ?? compatInput.runId ?? null,
  });
}

function buildContinuation(
  input: MissionOperatorActionInput,
  canonicalTruth = resolveCanonicalTruth(input)
) {
  return buildRuntimeContinuationDescriptor({
    continuation: canonicalTruth.continuation,
    runState: input.run?.state ?? (input.reviewPack ? "review_ready" : null),
    checkpoint: input.reviewPack?.checkpoint ?? input.run?.checkpoint ?? null,
    missionLinkage: input.reviewPack?.missionLinkage ?? input.run?.missionLinkage ?? null,
    actionability: input.reviewPack?.actionability ?? input.run?.actionability ?? null,
    publishHandoff: input.reviewPack?.publishHandoff ?? input.run?.publishHandoff ?? null,
    takeoverBundle: input.reviewPack?.takeoverBundle ?? input.run?.takeoverBundle ?? null,
    nextAction: input.run?.nextAction ?? null,
    reviewPackId: input.reviewPack?.id ?? input.run?.reviewPackId ?? null,
  });
}

function mapTakeoverTargetToMissionNavigationTarget(input: {
  workspaceId: string;
  threadId: string | null;
  operatorAction: HugeCodeNextOperatorAction | null;
  takeoverTarget: HugeCodeTakeoverTarget | null | undefined;
  missionTarget: MissionNavigationTarget;
  reviewTarget: MissionNavigationTarget;
}): MissionNavigationTarget {
  const takeoverTarget = input.takeoverTarget;
  if (!takeoverTarget) {
    return input.operatorAction?.action === "open_review_pack"
      ? input.reviewTarget
      : input.missionTarget;
  }
  if (takeoverTarget.kind === "thread") {
    if (
      input.threadId &&
      takeoverTarget.workspaceId === input.workspaceId &&
      takeoverTarget.threadId === input.threadId
    ) {
      return input.missionTarget;
    }
    return {
      kind: "thread",
      workspaceId: takeoverTarget.workspaceId,
      threadId: takeoverTarget.threadId,
    };
  }
  if (takeoverTarget.kind === "review_pack") {
    return {
      kind: "review",
      workspaceId: takeoverTarget.workspaceId,
      taskId: takeoverTarget.taskId,
      runId: takeoverTarget.runId,
      reviewPackId: takeoverTarget.reviewPackId,
      limitation: input.threadId ? null : "thread_unavailable",
    };
  }
  if (takeoverTarget.kind === "run") {
    return {
      kind: "mission",
      workspaceId: takeoverTarget.workspaceId,
      taskId: takeoverTarget.taskId,
      runId: takeoverTarget.runId,
      reviewPackId: takeoverTarget.reviewPackId ?? null,
      threadId: input.threadId,
      limitation: input.threadId ? null : "thread_unavailable",
    };
  }
  return input.operatorAction?.action === "open_review_pack"
    ? input.reviewTarget
    : input.missionTarget;
}

function resolveContinuationPreferredLabel(
  pathKind: NonNullable<ReturnType<typeof buildContinuation>>["pathKind"] | null | undefined,
  fallbackLabel: string | null
) {
  if (pathKind === "approval") {
    return "Open approval";
  }
  if (pathKind === "review") {
    return "Open review";
  }
  if (pathKind === "resume") {
    return "Resume mission";
  }
  if (pathKind === "handoff") {
    return "Open handoff";
  }
  return fallbackLabel;
}

function resolveContinuationPreferredDetail(
  continuation: ReturnType<typeof buildContinuation>,
  operatorAction: HugeCodeNextOperatorAction | null,
  input: MissionOperatorActionContext
) {
  const continuationDetail =
    continuation?.blockingReason ??
    continuation?.summary ??
    continuation?.canonicalNextAction.detail ??
    continuation?.recommendedAction ??
    null;
  return (
    readOptionalText(operatorAction?.detail) ??
    continuationDetail ??
    resolveCheckpointHandoffLabel(input) ??
    input.reviewPack?.recommendedNextAction?.trim() ??
    input.run?.nextAction?.detail?.trim() ??
    input.run?.governance?.summary?.trim() ??
    null
  );
}

export function resolveCheckpointHandoffLabel(input: MissionOperatorActionInput): string | null {
  const checkpointSummary = input.reviewPack?.checkpoint?.summary?.trim();
  if (checkpointSummary) {
    return checkpointSummary;
  }
  const runCheckpointSummary = input.run?.checkpoint?.summary?.trim();
  if (runCheckpointSummary) {
    return runCheckpointSummary;
  }
  const checkpoint = input.reviewPack?.checkpoint ?? input.run?.checkpoint ?? null;
  if (!checkpoint) {
    return null;
  }
  if (checkpoint.resumeReady) {
    return "Resume ready";
  }
  if (checkpoint.recovered) {
    return "Recovered from checkpoint";
  }
  return checkpoint.checkpointId ? "Checkpoint available" : null;
}

export function buildMissionOverviewOperatorSignal(
  input: MissionOperatorActionInput
): string | null {
  const canonicalTruth = resolveCanonicalTruth(input);
  const continuation = buildContinuation(input, canonicalTruth);
  const runtimeActionText = readRuntimeOperatorActionText(canonicalTruth.nextOperatorAction);
  return (
    input.run?.operatorSnapshot?.currentActivity?.trim() ||
    input.run?.operatorSnapshot?.blocker?.trim() ||
    runtimeActionText ||
    continuation?.recommendedAction ||
    input.run?.approval?.summary?.trim() ||
    input.run?.nextAction?.detail?.trim() ||
    input.reviewPack?.recommendedNextAction?.trim() ||
    null
  );
}

export function resolveCanonicalMissionOperatorAction(
  input: MissionOperatorActionContext
): MissionOperatorActionModel | null {
  const canonicalTruth = resolveCanonicalTruth(input);
  const continuation = buildContinuation(input, canonicalTruth);
  const operatorAction = canonicalTruth.nextOperatorAction;

  if (!continuation && !operatorAction && !input.run && !input.reviewPack) {
    return null;
  }

  const label =
    resolveContinuationPreferredLabel(
      continuation?.pathKind ?? null,
      operatorAction?.label?.trim() || null
    ) ?? input.defaultActiveLabel;
  const detail = resolveContinuationPreferredDetail(continuation, operatorAction, input);
  const target = mapTakeoverTargetToMissionNavigationTarget({
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    operatorAction,
    takeoverTarget:
      continuation?.navigationTarget && "kind" in continuation.navigationTarget
        ? continuation.navigationTarget
        : (operatorAction?.target ?? null),
    missionTarget: input.missionTarget,
    reviewTarget: input.reviewTarget,
  });
  const normalizedTarget =
    continuation?.pathKind === "review" || operatorAction?.action === "open_review_pack"
      ? input.reviewTarget
      : target;

  return {
    label,
    detail,
    target: normalizedTarget,
  };
}

export function resolveMissionOperatorAction(input: {
  task: HugeCodeTaskSummary;
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
  missionTarget: MissionNavigationTarget;
  reviewTarget: MissionNavigationTarget;
  defaultActiveLabel: string;
}): MissionOperatorActionModel {
  const resolved = resolveCanonicalMissionOperatorAction({
    reviewPack: input.reviewPack,
    run: input.run,
    workspaceId: input.task.workspaceId,
    threadId: input.task.origin.threadId ?? null,
    taskId: input.task.id,
    runId: input.run?.id ?? input.reviewPack?.runId ?? null,
    missionTarget: input.missionTarget,
    reviewTarget: input.reviewTarget,
    defaultActiveLabel: input.defaultActiveLabel,
  });
  if (resolved) {
    return resolved;
  }
  return {
    label: input.task.origin.threadId ? "Open mission" : "Open action center",
    detail:
      input.run?.nextAction?.detail?.trim() ||
      input.reviewPack?.recommendedNextAction?.trim() ||
      input.run?.governance?.summary?.trim() ||
      null,
    target: input.missionTarget,
  };
}
