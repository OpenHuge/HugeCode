import type {
  HugeCodeCheckpointSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodeReviewActionabilitySummary,
  HugeCodeRunSummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";
import { resolveRuntimeContinuation as resolvePublishedRuntimeContinuation } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { buildMissionRunCheckpoint } from "./runtimeMissionControlCheckpoint";
import {
  formatRuntimeContinuationTruthSourceLabel,
  projectTakeoverBundleToContinuation,
  resolveContinuationTruthSource,
  resolvePreferredReviewActionability,
  type RuntimeContinuationTruthSource,
} from "./runtimeContinuationTruth";

export type RuntimeContinuityReadinessState = "ready" | "attention" | "blocked";
export type RuntimeContinuityPathKind = "approval" | "resume" | "handoff" | "review" | "missing";

export type RuntimeContinuityReadinessItem = {
  runId: string;
  taskId: string;
  state: RuntimeContinuityReadinessState;
  pathKind: RuntimeContinuityPathKind;
  detail: string;
  recommendedAction: string;
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
};

export type RuntimeContinuityReadinessSummary = {
  state: RuntimeContinuityReadinessState;
  headline: string;
  blockingReason: string | null;
  recommendedAction: string;
  recoverableRunCount: number;
  handoffReadyCount: number;
  reviewBlockedCount: number;
  missingPathCount: number;
  durabilityDegraded: boolean;
  items: RuntimeContinuityReadinessItem[];
};

type RuntimeContinuityCandidateRun = Pick<
  HugeCodeRunSummary,
  | "id"
  | "workspaceId"
  | "taskId"
  | "state"
  | "updatedAt"
  | "checkpoint"
  | "executionGraph"
  | "continuation"
  | "missionLinkage"
  | "actionability"
  | "publishHandoff"
  | "takeoverBundle"
>;

type RuntimeContinuityCandidateTask = Pick<
  RuntimeAgentTaskSummary,
  | "taskId"
  | "status"
  | "updatedAt"
  | "checkpointId"
  | "traceId"
  | "errorCode"
  | "recovered"
  | "checkpointState"
> | null;

type RuntimeContinuityCandidate = {
  run: RuntimeContinuityCandidateRun;
  task?: RuntimeContinuityCandidateTask;
};

type RuntimeContinuityDurability = {
  degraded: boolean | null;
} | null;

type BuildRuntimeContinuityReadinessOptions = {
  candidates: RuntimeContinuityCandidate[];
  durabilityWarning?: RuntimeContinuityDurability;
};

function maxState(
  left: RuntimeContinuityReadinessState,
  right: RuntimeContinuityReadinessState
): RuntimeContinuityReadinessState {
  if (left === "blocked" || right === "blocked") {
    return "blocked";
  }
  if (left === "attention" || right === "attention") {
    return "attention";
  }
  return "ready";
}

function sortState(state: RuntimeContinuityReadinessState): number {
  return state === "blocked" ? 3 : state === "attention" ? 2 : 1;
}

function hasNavigationTarget(linkage: HugeCodeMissionLinkageSummary | null | undefined): boolean {
  return Boolean(linkage?.navigationTarget);
}

function hasRecoveryPath(linkage: HugeCodeMissionLinkageSummary | null | undefined): boolean {
  return Boolean(linkage?.recoveryPath) && hasNavigationTarget(linkage);
}

function resolveCheckpoint(
  run: RuntimeContinuityCandidateRun,
  task: RuntimeContinuityCandidateTask
): HugeCodeCheckpointSummary | null {
  if (run.checkpoint) {
    return run.checkpoint;
  }
  if (!task) {
    return null;
  }
  return buildMissionRunCheckpoint(task);
}

function isRecoverableTaskStatus(
  status: RuntimeAgentTaskSummary["status"] | null | undefined
): boolean {
  return status === "paused" || status === "interrupted";
}

function isCandidate(input: {
  run: RuntimeContinuityCandidateRun;
  task: RuntimeContinuityCandidateTask;
  checkpoint: HugeCodeCheckpointSummary | null;
}) {
  return Boolean(
    input.run.state === "review_ready" ||
    input.run.takeoverBundle ||
    input.run.publishHandoff ||
    input.run.missionLinkage ||
    input.run.actionability ||
    input.checkpoint ||
    input.task?.recovered === true ||
    isRecoverableTaskStatus(input.task?.status)
  );
}

function buildReviewItem(
  run: RuntimeContinuityCandidateRun,
  taskId: string,
  actionability: HugeCodeReviewActionabilitySummary | null,
  takeoverBundle: HugeCodeTakeoverBundle | null | undefined
): RuntimeContinuityReadinessItem {
  const takeoverProjection = projectTakeoverBundleToContinuation(takeoverBundle);
  if (takeoverProjection?.pathKind === "review") {
    return {
      runId: run.id,
      taskId,
      state: takeoverProjection.state === "missing" ? "attention" : takeoverProjection.state,
      pathKind: "review",
      detail: takeoverProjection.detail,
      recommendedAction: takeoverProjection.recommendedAction,
      truthSource: takeoverProjection.truthSource,
      truthSourceLabel: takeoverProjection.truthSourceLabel,
    };
  }
  if (actionability?.state === "blocked") {
    return {
      runId: run.id,
      taskId,
      state: "blocked",
      pathKind: "review",
      detail: actionability.summary,
      recommendedAction:
        "Open Review Pack and resolve the runtime-blocked follow-up before continuing.",
      truthSource: "review_actionability",
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("review_actionability"),
    };
  }
  if (actionability?.state === "degraded") {
    return {
      runId: run.id,
      taskId,
      state: "attention",
      pathKind: "review",
      detail: actionability.summary,
      recommendedAction:
        "Open Review Pack and inspect the degraded runtime follow-up guidance before continuing.",
      truthSource: "review_actionability",
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("review_actionability"),
    };
  }
  if (actionability?.state === "ready") {
    return {
      runId: run.id,
      taskId,
      state: "ready",
      pathKind: "review",
      detail: actionability.summary,
      recommendedAction: "Continue from Review Pack using the runtime-published follow-up actions.",
      truthSource: "review_actionability",
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("review_actionability"),
    };
  }
  return {
    runId: run.id,
    taskId,
    state: "attention",
    pathKind: "missing",
    detail: "Runtime marked this run review-ready, but review actionability was not published.",
    recommendedAction: "Inspect runtime review truth before continuing from this review-ready run.",
    truthSource: "missing",
    truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("missing"),
  };
}

function buildResumeOrHandoffItem(input: {
  run: RuntimeContinuityCandidateRun;
  taskId: string;
  task: RuntimeContinuityCandidateTask;
  checkpoint: HugeCodeCheckpointSummary | null;
  missionLinkage: HugeCodeMissionLinkageSummary | null | undefined;
}) {
  const { run, taskId, task, checkpoint, missionLinkage } = input;
  const takeoverProjection = projectTakeoverBundleToContinuation(run.takeoverBundle);
  if (takeoverProjection && takeoverProjection.pathKind !== "review") {
    return {
      runId: run.id,
      taskId,
      state: takeoverProjection.state === "missing" ? "attention" : takeoverProjection.state,
      pathKind: takeoverProjection.pathKind,
      detail: takeoverProjection.detail,
      recommendedAction: takeoverProjection.recommendedAction,
      truthSource: takeoverProjection.truthSource,
      truthSourceLabel: takeoverProjection.truthSourceLabel,
    };
  }
  const hasResume = checkpoint?.resumeReady === true;
  const hasHandoff = Boolean(run.publishHandoff) || hasRecoveryPath(missionLinkage);
  const recoverable =
    hasResume ||
    checkpoint?.recovered === true ||
    task?.recovered === true ||
    isRecoverableTaskStatus(task?.status);

  if (hasResume) {
    return {
      runId: run.id,
      taskId,
      state: "ready" as const,
      pathKind: "resume" as const,
      detail:
        checkpoint?.summary ??
        "Runtime published a canonical checkpoint path and this run is ready to resume.",
      recommendedAction: "Resume this run from its runtime-published checkpoint.",
      truthSource: "checkpoint" as const,
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel("checkpoint"),
    };
  }

  if (hasHandoff) {
    const truthSource = resolveContinuationTruthSource({
      missionLinkage: missionLinkage ?? null,
      publishHandoff: run.publishHandoff ?? null,
    });
    const detail =
      run.publishHandoff?.summary ??
      missionLinkage?.summary ??
      "Runtime published a canonical handoff path for this run.";
    return {
      runId: run.id,
      taskId,
      state: recoverable ? ("ready" as const) : ("attention" as const),
      pathKind: "handoff" as const,
      detail,
      recommendedAction:
        "Use the runtime-published handoff or navigation target instead of rebuilding recovery locally.",
      truthSource,
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel(truthSource),
    };
  }

  if (recoverable) {
    const truthSource: RuntimeContinuationTruthSource = checkpoint ? "checkpoint" : "missing";
    return {
      runId: run.id,
      taskId,
      state: "blocked" as const,
      pathKind: "missing" as const,
      detail:
        checkpoint?.summary ??
        "This run looks recoverable, but runtime did not publish a canonical continue path.",
      recommendedAction:
        "Inspect runtime continuity truth and restore a canonical resume or handoff path before continuing.",
      truthSource,
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel(truthSource),
    };
  }

  const truthSource: RuntimeContinuationTruthSource = checkpoint ? "checkpoint" : "missing";
  return {
    runId: run.id,
    taskId,
    state: "attention" as const,
    pathKind: "missing" as const,
    detail:
      checkpoint?.summary ??
      "Continuity signals are incomplete for this run even though runtime published partial recovery truth.",
    recommendedAction:
      "Inspect runtime continuity truth before relying on this checkpoint or handoff state.",
    truthSource,
    truthSourceLabel: formatRuntimeContinuationTruthSourceLabel(truthSource),
  };
}

function buildCandidateItem(
  input: RuntimeContinuityCandidate
): RuntimeContinuityReadinessItem | null {
  const runtimeTaskId = input.task?.taskId ?? input.run.taskId;
  const publishedContinuation = resolvePublishedRuntimeContinuation({
    workspaceId: input.run.workspaceId ?? null,
    taskId: input.run.taskId,
    runId: input.run.id,
    reviewPackId: null,
    state: input.run.state,
    checkpoint: input.run.checkpoint ?? null,
    missionLinkage: input.run.missionLinkage ?? null,
    actionability: input.run.actionability ?? null,
    publishHandoff: input.run.publishHandoff ?? null,
    takeoverBundle: input.run.takeoverBundle ?? null,
    continuation: input.run.continuation ?? null,
    sessionBoundary: null,
  });
  if (publishedContinuation) {
    return {
      runId: input.run.id,
      taskId: runtimeTaskId,
      state:
        publishedContinuation.state === "missing" ? "attention" : publishedContinuation.state,
      pathKind: publishedContinuation.pathKind,
      detail: publishedContinuation.detail ?? publishedContinuation.summary,
      recommendedAction: publishedContinuation.recommendedAction,
      truthSource: publishedContinuation.source,
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel(publishedContinuation.source),
    };
  }
  const checkpoint = resolveCheckpoint(input.run, input.task ?? null);
  const actionability = resolvePreferredReviewActionability({
    takeoverBundle: input.run.takeoverBundle ?? null,
    actionability: input.run.actionability ?? null,
  });
  if (!isCandidate({ run: input.run, task: input.task ?? null, checkpoint })) {
    return null;
  }
  if (input.run.state === "review_ready") {
    return buildReviewItem(input.run, runtimeTaskId, actionability, input.run.takeoverBundle);
  }
  return buildResumeOrHandoffItem({
    run: input.run,
    taskId: runtimeTaskId,
    task: input.task ?? null,
    checkpoint,
    missionLinkage: input.run.missionLinkage ?? null,
  });
}

export function buildRuntimeContinuityReadiness({
  candidates,
  durabilityWarning = null,
}: BuildRuntimeContinuityReadinessOptions): RuntimeContinuityReadinessSummary {
  const items = candidates
    .map((candidate) => buildCandidateItem(candidate))
    .filter((item): item is RuntimeContinuityReadinessItem => item !== null)
    .sort((left, right) => sortState(right.state) - sortState(left.state));

  const recoverableRunCount = items.filter((item) => item.pathKind === "resume").length;
  const handoffReadyCount = items.filter((item) => item.pathKind === "handoff").length;
  const reviewBlockedCount = items.filter(
    (item) => item.pathKind === "review" && item.state === "blocked"
  ).length;
  const missingPathCount = items.filter((item) => item.pathKind === "missing").length;
  const durabilityDegraded = durabilityWarning?.degraded === true;

  let state: RuntimeContinuityReadinessState = "ready";
  for (const item of items) {
    state = maxState(state, item.state);
  }
  if (state === "ready" && durabilityDegraded) {
    state = "attention";
  }

  const topProblem = items.find((item) => item.state !== "ready") ?? null;
  const blockingReason = topProblem?.state === "blocked" ? topProblem.detail : null;
  const recommendedAction =
    topProblem?.recommendedAction ??
    (durabilityDegraded
      ? "Inspect checkpoint durability before relying on recovery or handoff."
      : "Runtime continuity truth is ready for resume, handoff, or review follow-up.");

  return {
    state,
    headline:
      state === "ready"
        ? "Continuity readiness confirmed"
        : state === "blocked"
          ? "Continuity readiness blocked"
          : "Continuity readiness needs attention",
    blockingReason,
    recommendedAction,
    recoverableRunCount,
    handoffReadyCount,
    reviewBlockedCount,
    missingPathCount,
    durabilityDegraded,
    items,
  };
}
