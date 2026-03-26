import type {
  HugeCodeCheckpointSummary,
  HugeCodeMissionLinkageSummary,
  HugeCodeReviewActionabilitySummary,
  HugeCodeRunSummary,
  HugeCodeTakeoverBundle,
} from "@ku0/code-runtime-host-contract";
import { resolveRuntimeContinuation as resolvePublishedRuntimeContinuation } from "@ku0/code-runtime-host-contract";
import { summarizeHugeCodeOperatorContinuation } from "@ku0/code-runtime-host-contract/hugeCodeOperatorLoop";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { buildMissionRunCheckpoint } from "./runtimeMissionControlCheckpoint";
import {
  formatRuntimeContinuationTruthSourceLabel,
  projectTakeoverBundleToContinuation,
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

function mapSharedContinuationState(
  state: "ready" | "degraded" | "blocked" | "missing"
): RuntimeContinuityReadinessState {
  if (state === "blocked") {
    return "blocked";
  }
  if (state === "ready") {
    return "ready";
  }
  return "attention";
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
  const shared = summarizeHugeCodeOperatorContinuation({
    runState: run.state,
    takeoverBundle: takeoverBundle ?? null,
    reviewActionability: actionability ?? null,
    missionLinkage: run.missionLinkage ?? null,
    publishHandoff: run.publishHandoff ?? null,
  });
  return {
    runId: run.id,
    taskId,
    state: mapSharedContinuationState(shared.state),
    pathKind: shared.pathKind,
    detail: shared.summary,
    recommendedAction: shared.recommendedAction,
    truthSource: shared.truthSource,
    truthSourceLabel: shared.truthSourceLabel,
  };
}

function buildTakeoverItem(input: {
  run: RuntimeContinuityCandidateRun;
  taskId: string;
}): RuntimeContinuityReadinessItem | null {
  const takeoverProjection = projectTakeoverBundleToContinuation(input.run.takeoverBundle);
  if (!takeoverProjection) {
    return null;
  }
  return {
    runId: input.run.id,
    taskId: input.taskId,
    state: takeoverProjection.state === "missing" ? "attention" : takeoverProjection.state,
    pathKind: takeoverProjection.pathKind,
    detail: takeoverProjection.detail,
    recommendedAction: takeoverProjection.recommendedAction,
    truthSource: takeoverProjection.truthSource,
    truthSourceLabel: takeoverProjection.truthSourceLabel,
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
  const shared = summarizeHugeCodeOperatorContinuation({
    runState: run.state,
    checkpoint,
    takeoverBundle: run.takeoverBundle ?? null,
    reviewActionability: run.actionability ?? null,
    missionLinkage: missionLinkage ?? null,
    publishHandoff: run.publishHandoff ?? null,
    fallbackDetail:
      checkpoint?.summary ??
      (task?.recovered === true || isRecoverableTaskStatus(task?.status)
        ? "This run looks recoverable, but runtime did not publish a canonical continue path."
        : null),
  });
  return {
    runId: run.id,
    taskId,
    state: mapSharedContinuationState(shared.state),
    pathKind: shared.pathKind,
    detail: shared.summary,
    recommendedAction: shared.recommendedAction,
    truthSource: shared.truthSource,
    truthSourceLabel: shared.truthSourceLabel,
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
      state: publishedContinuation.state === "missing" ? "attention" : publishedContinuation.state,
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
  const takeoverItem = buildTakeoverItem({
    run: input.run,
    taskId: runtimeTaskId,
  });
  if (takeoverItem) {
    return takeoverItem;
  }
  if (input.run.state === "review_ready" || actionability !== null) {
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
