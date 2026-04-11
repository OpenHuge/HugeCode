import type {
  AgentTaskSummary,
  HugeCodeCheckpointSummary,
  HugeCodeRunSummary,
  RuntimeContinuationAggregateCandidate,
  RuntimeContinuationAggregateItem,
  RuntimeContinuationReadinessSummary as SharedRuntimeContinuationReadinessSummary,
  RuntimeContinuationPathKind,
  RuntimeContinuationTruthSource,
} from "@ku0/code-runtime-host-contract";
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
  | "workspaceId"
  | "taskId"
  | "state"
  | "updatedAt"
  | "reviewPackId"
  | "checkpoint"
  | "executionGraph"
  | "continuation"
  | "missionLinkage"
  | "actionability"
  | "publishHandoff"
  | "takeoverBundle"
  | "nextAction"
>;

type RuntimeContinuityCandidateTask = Pick<AgentTaskSummary, "taskId"> | null;

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

function isCanonicalContinuationCandidate(input: {
  run: RuntimeContinuityCandidateRun;
  checkpoint: HugeCodeCheckpointSummary | null;
}) {
  return Boolean(
    input.run.state === "review_ready" ||
    input.run.continuation ||
    input.run.takeoverBundle ||
    input.run.publishHandoff ||
    input.run.missionLinkage ||
    input.run.actionability ||
    input.checkpoint
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
    const checkpoint = candidate.run.checkpoint ?? null;
    if (
      !isCanonicalContinuationCandidate({
        run: candidate.run,
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
      continuation: candidate.run.continuation ?? null,
      missionLinkage: candidate.run.missionLinkage ?? null,
      actionability: candidate.run.actionability ?? null,
      publishHandoff: candidate.run.publishHandoff ?? null,
      takeoverBundle: candidate.run.takeoverBundle ?? null,
      nextAction: candidate.run.nextAction ?? null,
      reviewPackId: candidate.run.reviewPackId ?? null,
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
