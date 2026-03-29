import type {
  HugeCodeCheckpointSummary,
  HugeCodeRunSummary,
  RuntimeContinuationAggregateCandidate,
  RuntimeContinuationAggregateItem,
  RuntimeContinuationReadinessSummary as SharedRuntimeContinuationReadinessSummary,
  RuntimeContinuationPathKind,
  RuntimeContinuationTruthSource,
} from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { buildMissionRunCheckpoint } from "./runtimeMissionControlCheckpoint";
import {
  buildRuntimeContinuationAggregate,
  buildRuntimeContinuationReadinessSummary,
} from "./runtimeContinuationTruth";

export type RuntimeContinuityReadinessState = "ready" | "attention" | "blocked";

export type RuntimeContinuityReadinessItem = {
  runId: string;
  taskId: string;
  state: RuntimeContinuityReadinessState;
  pathKind: RuntimeContinuationPathKind;
  detail: string;
  recommendedAction: string;
  truthSource: RuntimeContinuationTruthSource;
  truthSourceLabel: string;
};

export type RuntimeContinuityReadinessSummary = Omit<
  SharedRuntimeContinuationReadinessSummary,
  "state"
> & {
  state: RuntimeContinuityReadinessState;
  items: RuntimeContinuityReadinessItem[];
};

type RuntimeContinuityCandidateRun = Pick<
  HugeCodeRunSummary,
  | "id"
  | "taskId"
  | "state"
  | "updatedAt"
  | "checkpoint"
  | "executionGraph"
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

function isCanonicalContinuationCandidate(input: {
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

function toReadinessItem(item: RuntimeContinuationAggregateItem): RuntimeContinuityReadinessItem {
  return {
    runId: item.runId,
    taskId: item.taskId,
    state: item.state === "missing" ? "attention" : item.state,
    pathKind: item.pathKind,
    detail: item.summary,
    recommendedAction: item.recommendedAction,
    truthSource: item.truthSource,
    truthSourceLabel: item.truthSourceLabel,
  };
}

export function buildRuntimeContinuityReadiness({
  candidates,
  durabilityWarning = null,
}: BuildRuntimeContinuityReadinessOptions): RuntimeContinuityReadinessSummary {
  const aggregateCandidates = candidates.flatMap((candidate) => {
    const checkpoint = resolveCheckpoint(candidate.run, candidate.task ?? null);
    if (
      !isCanonicalContinuationCandidate({
        run: candidate.run,
        task: candidate.task ?? null,
        checkpoint,
      })
    ) {
      return [];
    }
    const aggregateCandidate: RuntimeContinuationAggregateCandidate = {
      runId: candidate.run.id,
      taskId: candidate.task?.taskId ?? candidate.run.id,
      runState: candidate.run.state,
      checkpoint,
      missionLinkage: candidate.run.missionLinkage ?? null,
      actionability: candidate.run.actionability ?? null,
      publishHandoff: candidate.run.publishHandoff ?? null,
      takeoverBundle: candidate.run.takeoverBundle ?? null,
      nextAction: null,
    };
    return [aggregateCandidate];
  });

  const aggregate = buildRuntimeContinuationAggregate({
    candidates: aggregateCandidates,
    durabilityDegraded: durabilityWarning?.degraded === true,
  });
  const readiness = buildRuntimeContinuationReadinessSummary({
    candidates: aggregateCandidates,
    durabilityDegraded: durabilityWarning?.degraded === true,
  });
  const items = aggregate.items.map(toReadinessItem);

  return {
    ...readiness,
    items,
  };
}
