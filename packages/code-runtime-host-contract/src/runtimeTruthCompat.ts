import type {
  HugeCodeCheckpointSummary,
  HugeCodeContinuationState,
  HugeCodeContinuationSummary,
  HugeCodeReviewPackSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodeMissionNavigationTarget,
  HugeCodeNextOperatorAction,
  HugeCodePublishHandoffReference,
  HugeCodeReviewActionabilitySummary,
  HugeCodeReviewDecisionSummary,
  HugeCodeRunSummary,
  HugeCodeReviewStatus,
  HugeCodeRunApprovalSummary,
  HugeCodeRunNextAction,
  HugeCodeRunState,
  HugeCodeRuntimeSessionBoundary,
  HugeCodeTakeoverBundle,
  HugeCodeTakeoverTarget,
} from "./hugeCodeMissionControl.js";

export type RuntimeTruthCompatInput = {
  workspaceId?: string | null;
  taskId?: string | null;
  runId?: string | null;
  reviewPackId?: string | null;
  state?: HugeCodeRunState | null;
  reviewStatus?: HugeCodeReviewStatus | null;
  approval?: HugeCodeRunApprovalSummary | null;
  reviewDecision?: HugeCodeReviewDecisionSummary | null;
  nextAction?: HugeCodeRunNextAction | null;
  checkpoint?: HugeCodeCheckpointSummary | null;
  missionLinkage?: HugeCodeMissionLinkageSummary | null;
  actionability?: HugeCodeReviewActionabilitySummary | null;
  publishHandoff?: HugeCodePublishHandoffReference | null;
  takeoverBundle?: HugeCodeTakeoverBundle | null;
  sessionBoundary?: HugeCodeRuntimeSessionBoundary | null;
  continuation?: HugeCodeContinuationSummary | null;
  nextOperatorAction?: HugeCodeNextOperatorAction | null;
};

export type CanonicalRuntimeTruth = {
  sessionBoundary: HugeCodeRuntimeSessionBoundary | null;
  continuation: HugeCodeContinuationSummary | null;
  nextOperatorAction: HugeCodeNextOperatorAction | null;
};

export type RuntimeTruthCompatRunReviewPairInput = {
  run: Pick<
    HugeCodeRunSummary,
    | "id"
    | "workspaceId"
    | "taskId"
    | "state"
    | "reviewPackId"
    | "approval"
    | "reviewDecision"
    | "nextAction"
    | "checkpoint"
    | "missionLinkage"
    | "actionability"
    | "publishHandoff"
    | "takeoverBundle"
    | "sessionBoundary"
    | "continuation"
    | "nextOperatorAction"
  > | null;
  reviewPack: Pick<
    HugeCodeReviewPackSummary,
    | "id"
    | "workspaceId"
    | "taskId"
    | "runId"
    | "reviewStatus"
    | "reviewDecision"
    | "checkpoint"
    | "missionLinkage"
    | "actionability"
    | "publishHandoff"
    | "takeoverBundle"
    | "sessionBoundary"
    | "continuation"
    | "nextOperatorAction"
  > | null;
};

function readOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function mapTakeoverStateToContinuationState(
  state: HugeCodeTakeoverBundle["state"] | null | undefined
): HugeCodeContinuationState {
  if (state === "ready") {
    return "ready";
  }
  if (state === "attention") {
    return "attention";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

function mapReviewActionabilityState(
  state: HugeCodeReviewActionabilitySummary["state"] | null | undefined
): HugeCodeContinuationState {
  if (state === "ready") {
    return "ready";
  }
  if (state === "degraded") {
    return "attention";
  }
  if (state === "blocked") {
    return "blocked";
  }
  return "missing";
}

function createReviewPackTarget(
  boundary: HugeCodeRuntimeSessionBoundary,
  reviewPackId: string | null
): HugeCodeTakeoverTarget | null {
  if (!reviewPackId) {
    return null;
  }
  return {
    kind: "review_pack",
    workspaceId: boundary.workspaceId,
    taskId: boundary.taskId,
    runId: boundary.runId,
    reviewPackId,
    checkpointId: boundary.checkpointId ?? null,
    traceId: boundary.traceId ?? null,
  };
}

function mapMissionTarget(target: HugeCodeMissionNavigationTarget): HugeCodeTakeoverTarget {
  return target;
}

function resolveBoundaryTarget(
  boundary: HugeCodeRuntimeSessionBoundary | null
): HugeCodeTakeoverTarget | null {
  return boundary ? mapMissionTarget(boundary.navigationTarget) : null;
}

export function resolveRuntimeSessionBoundary(
  input: RuntimeTruthCompatInput
): HugeCodeRuntimeSessionBoundary | null {
  if (input.sessionBoundary) {
    return input.sessionBoundary;
  }
  const missionLinkage = input.missionLinkage;
  if (missionLinkage) {
    return {
      workspaceId: missionLinkage.workspaceId,
      taskId: missionLinkage.taskId,
      runId: missionLinkage.runId,
      missionTaskId: missionLinkage.missionTaskId,
      sessionKind: missionLinkage.taskEntityKind,
      threadId: missionLinkage.threadId ?? null,
      requestId: missionLinkage.requestId ?? null,
      reviewPackId: missionLinkage.reviewPackId ?? input.reviewPackId ?? null,
      checkpointId: missionLinkage.checkpointId ?? null,
      traceId: missionLinkage.traceId ?? null,
      navigationTarget: missionLinkage.navigationTarget,
    };
  }
  const workspaceId = readOptionalText(input.workspaceId);
  const taskId = readOptionalText(input.taskId);
  const runId = readOptionalText(input.runId);
  if (!workspaceId || !taskId || !runId) {
    return null;
  }
  return {
    workspaceId,
    taskId,
    runId,
    missionTaskId: taskId,
    sessionKind: "run",
    threadId: null,
    requestId: null,
    reviewPackId: readOptionalText(input.reviewPackId),
    checkpointId: input.checkpoint?.checkpointId ?? null,
    traceId: input.checkpoint?.traceId ?? null,
    navigationTarget: {
      kind: "run",
      workspaceId,
      taskId,
      runId,
      reviewPackId: readOptionalText(input.reviewPackId),
      checkpointId: input.checkpoint?.checkpointId ?? null,
      traceId: input.checkpoint?.traceId ?? null,
    },
  };
}

export function resolveRuntimeContinuation(
  input: RuntimeTruthCompatInput
): HugeCodeContinuationSummary | null {
  if (input.continuation) {
    return input.continuation;
  }

  const boundary = resolveRuntimeSessionBoundary(input);
  if (!boundary) {
    return null;
  }

  const reviewPackId = readOptionalText(input.reviewPackId) ?? boundary.reviewPackId ?? null;
  const reviewActionability =
    input.takeoverBundle?.reviewActionability ?? input.actionability ?? null;
  const takeoverDetail =
    input.takeoverBundle?.blockingReason ??
    (input.takeoverBundle?.pathKind === "review" ? reviewActionability?.summary : null) ??
    input.takeoverBundle?.summary ??
    null;

  if (input.takeoverBundle) {
    return {
      state: mapTakeoverStateToContinuationState(input.takeoverBundle.state),
      pathKind: input.takeoverBundle.pathKind,
      source: "takeover_bundle",
      summary: input.takeoverBundle.summary,
      detail: takeoverDetail,
      recommendedAction: input.takeoverBundle.recommendedAction,
      target:
        input.takeoverBundle.target ??
        (input.takeoverBundle.pathKind === "review"
          ? createReviewPackTarget(boundary, reviewPackId)
          : resolveBoundaryTarget(boundary)),
      reviewPackId,
      reviewActionability,
      sessionBoundary: boundary,
    };
  }

  if (reviewActionability) {
    return {
      state: mapReviewActionabilityState(reviewActionability.state),
      pathKind: "review",
      source: "review_actionability",
      summary: reviewActionability.summary,
      detail: reviewActionability.summary,
      recommendedAction:
        reviewActionability.state === "blocked"
          ? "Open Review Pack and resolve the runtime-blocked follow-up before continuing."
          : reviewActionability.state === "degraded"
            ? "Open Review Pack and inspect the degraded runtime follow-up guidance before continuing."
            : "Continue from Review Pack using the runtime-published follow-up actions.",
      target: createReviewPackTarget(boundary, reviewPackId) ?? resolveBoundaryTarget(boundary),
      reviewPackId,
      reviewActionability,
      sessionBoundary: boundary,
    };
  }

  if (input.publishHandoff || input.missionLinkage) {
    return {
      state: "ready",
      pathKind: "handoff",
      source: input.publishHandoff ? "publish_handoff" : "mission_linkage",
      summary:
        input.publishHandoff?.summary ??
        input.missionLinkage?.summary ??
        "Runtime published a canonical handoff path for this run.",
      detail: input.publishHandoff?.summary ?? input.missionLinkage?.summary ?? null,
      recommendedAction:
        "Use the runtime-published handoff or navigation target instead of rebuilding recovery locally.",
      target: resolveBoundaryTarget(boundary),
      reviewPackId,
      reviewActionability: null,
      sessionBoundary: boundary,
    };
  }

  if (input.checkpoint?.resumeReady) {
    return {
      state: "ready",
      pathKind: "resume",
      source: "checkpoint",
      summary:
        input.checkpoint.summary ??
        "Runtime published a canonical checkpoint path and this run is ready to resume.",
      detail: input.checkpoint.summary ?? null,
      recommendedAction: "Resume this run from its runtime-published checkpoint.",
      target: resolveBoundaryTarget(boundary),
      reviewPackId,
      reviewActionability: null,
      sessionBoundary: boundary,
    };
  }

  if (input.checkpoint) {
    return {
      state: input.checkpoint.recovered ? "blocked" : "attention",
      pathKind: "missing",
      source: "checkpoint",
      summary:
        input.checkpoint.summary ??
        "Runtime published checkpoint truth, but no canonical continuation path is ready yet.",
      detail: input.checkpoint.summary ?? null,
      recommendedAction:
        "Inspect runtime continuity truth and restore a canonical resume or handoff path before continuing.",
      target: resolveBoundaryTarget(boundary),
      reviewPackId,
      reviewActionability: null,
      sessionBoundary: boundary,
    };
  }

  return null;
}

function resolveReviewPackActionLabel(reviewStatus: HugeCodeReviewStatus | null | undefined) {
  if (reviewStatus === "incomplete_evidence") {
    return "Inspect evidence";
  }
  if (reviewStatus === "action_required") {
    return "Resolve review";
  }
  return "Open review";
}

export function resolveRuntimeNextOperatorAction(
  input: RuntimeTruthCompatInput
): HugeCodeNextOperatorAction | null {
  if (input.nextOperatorAction) {
    return input.nextOperatorAction;
  }

  const boundary = resolveRuntimeSessionBoundary(input);
  const continuation = resolveRuntimeContinuation(input);
  if (!boundary) {
    return null;
  }

  const reviewPackId = readOptionalText(input.reviewPackId) ?? boundary.reviewPackId ?? null;
  const reviewTarget = createReviewPackTarget(boundary, reviewPackId);
  const missionTarget = resolveBoundaryTarget(boundary);

  if (
    reviewPackId &&
    (input.reviewStatus === "ready" ||
      input.reviewStatus === "action_required" ||
      input.reviewStatus === "incomplete_evidence" ||
      input.reviewDecision?.status === "pending")
  ) {
    return {
      action: "open_review_pack",
      label: resolveReviewPackActionLabel(input.reviewStatus),
      detail:
        continuation?.detail ?? continuation?.summary ?? input.reviewDecision?.summary ?? null,
      source: "review_pack",
      target: reviewTarget ?? missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (input.approval?.status === "pending_decision") {
    return {
      action: "approve",
      label: "Open approval",
      detail: input.approval.summary,
      source: "approval",
      target: continuation?.target ?? missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (continuation?.pathKind === "review") {
    return {
      action: "open_review_pack",
      label:
        continuation.state === "blocked"
          ? "Resolve review"
          : continuation.state === "attention"
            ? "Inspect review"
            : "Open review",
      detail: continuation.detail ?? continuation.summary,
      source: "continuation",
      target: continuation.target ?? reviewTarget ?? missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (input.state === "failed" || input.state === "cancelled") {
    return {
      action: "view_failure",
      label: "View failure",
      detail: input.nextAction?.detail ?? continuation?.detail ?? continuation?.summary ?? null,
      source: "run_failure",
      target: continuation?.target ?? missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (continuation?.pathKind === "resume") {
    return {
      action: "resume",
      label: "Resume mission",
      detail: continuation.detail ?? continuation.summary,
      source: "continuation",
      target: continuation.target ?? missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (continuation?.pathKind === "handoff") {
    return {
      action: "open_handoff",
      label: "Open handoff",
      detail: continuation.detail ?? continuation.summary,
      source: "continuation",
      target: continuation.target ?? missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (
    input.state === "queued" ||
    input.state === "preparing" ||
    input.state === "running" ||
    input.state === "validating" ||
    input.state === "needs_input" ||
    input.state === "paused"
  ) {
    return {
      action: "open_mission",
      label: "Open mission",
      detail: input.nextAction?.detail ?? continuation?.detail ?? continuation?.summary ?? null,
      source: "run_activity",
      target: missionTarget,
      sessionBoundary: boundary,
    };
  }

  if (input.nextAction) {
    return {
      action: input.nextAction.action,
      label: input.nextAction.label,
      detail: input.nextAction.detail ?? null,
      source: "runtime_fallback",
      target: missionTarget,
      sessionBoundary: boundary,
    };
  }

  return {
    action: "inspect_runtime",
    label: "Inspect runtime",
    detail: continuation?.detail ?? continuation?.summary ?? null,
    source: "runtime_fallback",
    target: missionTarget,
    sessionBoundary: boundary,
  };
}

export function resolveCanonicalRuntimeTruth(
  input: RuntimeTruthCompatInput
): CanonicalRuntimeTruth {
  const sessionBoundary = resolveRuntimeSessionBoundary(input);
  const continuation = resolveRuntimeContinuation({
    ...input,
    sessionBoundary,
  });
  const nextOperatorAction = resolveRuntimeNextOperatorAction({
    ...input,
    sessionBoundary,
    continuation,
  });

  return {
    sessionBoundary,
    continuation,
    nextOperatorAction,
  };
}

export function buildRuntimeTruthCompatInputFromRunReviewPair(
  input: RuntimeTruthCompatRunReviewPairInput
): RuntimeTruthCompatInput {
  return {
    workspaceId: input.reviewPack?.workspaceId ?? input.run?.workspaceId ?? null,
    taskId: input.reviewPack?.taskId ?? input.run?.taskId ?? null,
    runId: input.reviewPack?.runId ?? input.run?.id ?? null,
    reviewPackId: input.reviewPack?.id ?? input.run?.reviewPackId ?? null,
    state: input.run?.state ?? (input.reviewPack ? "review_ready" : null),
    reviewStatus: input.reviewPack?.reviewStatus ?? null,
    approval: input.run?.approval ?? null,
    reviewDecision: input.reviewPack?.reviewDecision ?? input.run?.reviewDecision ?? null,
    nextAction: input.run?.nextAction ?? null,
    checkpoint: input.reviewPack?.checkpoint ?? input.run?.checkpoint ?? null,
    missionLinkage: input.reviewPack?.missionLinkage ?? input.run?.missionLinkage ?? null,
    actionability: input.reviewPack?.actionability ?? input.run?.actionability ?? null,
    publishHandoff: input.reviewPack?.publishHandoff ?? input.run?.publishHandoff ?? null,
    takeoverBundle: input.reviewPack?.takeoverBundle ?? input.run?.takeoverBundle ?? null,
    sessionBoundary: input.reviewPack?.sessionBoundary ?? input.run?.sessionBoundary ?? null,
    continuation: input.reviewPack?.continuation ?? input.run?.continuation ?? null,
    nextOperatorAction:
      input.reviewPack?.nextOperatorAction ?? input.run?.nextOperatorAction ?? null,
  };
}

export function resolveCanonicalRuntimeTruthFromRunReviewPair(
  input: RuntimeTruthCompatRunReviewPairInput
): CanonicalRuntimeTruth {
  return resolveCanonicalRuntimeTruth(buildRuntimeTruthCompatInputFromRunReviewPair(input));
}
