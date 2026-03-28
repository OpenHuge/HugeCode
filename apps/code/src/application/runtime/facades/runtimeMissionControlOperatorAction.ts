import type {
  HugeCodeTakeoverTarget,
  HugeCodeReviewPackSummary,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import type { MissionControlProjection } from "./runtimeMissionControlFacade";
import { buildRuntimeContinuationDescriptor } from "./runtimeContinuationTruth";
import type { MissionNavigationTarget } from "./runtimeMissionNavigationTarget";

type MissionOperatorActionInput = {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
};

function buildContinuation(input: MissionOperatorActionInput) {
  return buildRuntimeContinuationDescriptor({
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

function mapCanonicalTargetToMissionNavigationTarget(input: {
  task: HugeCodeTaskSummary;
  target: HugeCodeTakeoverTarget | null | undefined;
  missionTarget: MissionNavigationTarget;
  reviewTarget: MissionNavigationTarget;
}): MissionNavigationTarget {
  const target = input.target;
  if (!target) {
    return input.missionTarget;
  }
  if (target.kind === "thread") {
    // Mission Control should keep mission context intact even when runtime
    // continuation truth says the next continue path is the mission thread.
    return input.missionTarget;
  }
  if (target.kind === "review_pack") {
    return {
      kind: "review",
      workspaceId: target.workspaceId,
      taskId: target.taskId,
      runId: target.runId,
      reviewPackId: target.reviewPackId,
      limitation: input.task.origin.threadId ? null : "thread_unavailable",
    };
  }
  if (target.kind === "run") {
    return {
      kind: "mission",
      workspaceId: target.workspaceId,
      taskId: target.taskId,
      runId: target.runId,
      reviewPackId: target.reviewPackId ?? null,
      threadId: input.task.origin.threadId ?? null,
      limitation: input.task.origin.threadId ? null : "thread_unavailable",
    };
  }
  return input.reviewTarget;
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
  const continuation = buildContinuation(input);
  return (
    input.run?.operatorSnapshot?.currentActivity?.trim() ||
    input.run?.operatorSnapshot?.blocker?.trim() ||
    input.run?.approval?.summary?.trim() ||
    continuation?.recommendedAction ||
    input.run?.nextAction?.detail?.trim() ||
    input.reviewPack?.recommendedNextAction?.trim() ||
    null
  );
}

export function resolveMissionOperatorAction(input: {
  task: HugeCodeTaskSummary;
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
  missionTarget: MissionNavigationTarget;
  reviewTarget: MissionNavigationTarget;
  defaultActiveLabel: string;
}): {
  label: string;
  detail: string | null;
  target: MissionNavigationTarget;
} {
  const continuation = buildContinuation(input);
  const continuationTarget = continuation
    ? mapCanonicalTargetToMissionNavigationTarget({
        task: input.task,
        target: continuation.canonicalNextAction.navigationTarget,
        missionTarget: input.missionTarget,
        reviewTarget: input.reviewTarget,
      })
    : input.missionTarget;
  if (
    input.reviewPack &&
    (input.reviewPack.reviewStatus === "ready" ||
      input.reviewPack.reviewStatus === "incomplete_evidence" ||
      input.reviewPack.reviewStatus === "action_required" ||
      input.reviewPack.reviewDecision?.status === "pending")
  ) {
    const useCanonicalReviewAction =
      continuation &&
      continuation.pathKind !== "missing" &&
      continuation.canonicalNextAction.kind !== "blocked";
    return {
      label:
        (useCanonicalReviewAction ? continuation?.canonicalNextAction.label : null) ??
        (input.reviewPack.reviewStatus === "incomplete_evidence"
          ? "Inspect evidence"
          : input.reviewPack.reviewStatus === "action_required"
            ? "Resolve review"
            : "Open review"),
      detail:
        (useCanonicalReviewAction ? continuation?.canonicalNextAction.detail : null) ||
        resolveCheckpointHandoffLabel(input) ||
        input.reviewPack.recommendedNextAction?.trim() ||
        input.reviewPack.governance?.summary?.trim() ||
        null,
      target: useCanonicalReviewAction
        ? (continuationTarget ?? input.reviewTarget)
        : input.reviewTarget,
    };
  }
  if (continuation) {
    return {
      label: continuation.canonicalNextAction.label,
      detail: continuation.canonicalNextAction.detail,
      target:
        continuation.canonicalNextAction.kind === "review"
          ? input.reviewTarget
          : (continuationTarget ?? input.missionTarget),
    };
  }
  if (input.run?.approval?.status === "pending_decision") {
    return {
      label: "Open approval",
      detail: input.run.approval.summary?.trim() || null,
      target: input.missionTarget,
    };
  }
  if (input.run?.state === "failed" || input.run?.state === "cancelled") {
    return {
      label: "View failure",
      detail:
        input.run.relaunchContext?.summary?.trim() ||
        input.run.completionReason?.trim() ||
        input.run.governance?.summary?.trim() ||
        null,
      target: input.missionTarget,
    };
  }
  if (input.run?.checkpoint?.resumeReady || input.run?.checkpoint?.recovered) {
    return {
      label: "Resume mission",
      detail:
        input.run.checkpoint.summary?.trim() ||
        input.run.nextAction?.detail?.trim() ||
        input.run.governance?.summary?.trim() ||
        null,
      target: input.missionTarget,
    };
  }
  if (input.run?.state === "needs_input") {
    return {
      label: "Resume mission",
      detail: input.run.nextAction?.detail?.trim() || input.run.governance?.summary?.trim() || null,
      target: input.missionTarget,
    };
  }
  if (
    input.run?.state === "queued" ||
    input.run?.state === "preparing" ||
    input.run?.state === "running" ||
    input.run?.state === "validating"
  ) {
    return {
      label: input.defaultActiveLabel,
      detail: input.run.nextAction?.detail?.trim() || input.run.governance?.summary?.trim() || null,
      target: input.missionTarget,
    };
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
