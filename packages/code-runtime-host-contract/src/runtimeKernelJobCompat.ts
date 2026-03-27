import type {
  KernelJob,
  RuntimeRunInterventionAck,
  RuntimeRunInterventionRequest,
  RuntimeRunRecordV2,
  RuntimeRunResumeAck,
  RuntimeRunSummary,
} from "./codeRuntimeRpc.js";
import {
  buildRuntimeContinuationDescriptor,
  resolvePreferredPublishHandoff,
  resolvePreferredReviewActionability,
} from "./runtimeContinuationFacade.js";

export type RuntimeKernelJobCompatCanonicalMethod =
  | "code_runtime_run_start_v2"
  | "code_runtime_run_get_v2"
  | "code_runtime_run_subscribe_v2"
  | "code_runtime_runs_list";

export function readRuntimeRunIdCompat(record: RuntimeRunRecordV2): string {
  const missionRunRecord = record.missionRun as { runId?: string | null };
  return (
    missionRunRecord.runId?.trim() ||
    record.missionRun.id?.trim() ||
    record.run.taskId?.trim() ||
    record.run.runSummary?.id?.trim() ||
    ""
  );
}

function projectRuntimeRunExecutionProfileCompat(
  run: Pick<RuntimeRunRecordV2["run"], "accessMode" | "executionMode">
): KernelJob["executionProfile"] {
  const distributed = run.executionMode === "distributed";
  return {
    placement: distributed ? "remote" : "local",
    interactivity: distributed ? "background" : "interactive",
    isolation: distributed ? "container_sandbox" : "host",
    network: run.accessMode === "read-only" ? "restricted" : "default",
    authority: distributed ? "service" : "user",
  };
}

function projectRuntimeRunSummaryExecutionProfileCompat(
  summary: Pick<RuntimeRunSummary, "accessMode" | "executionMode">
): KernelJob["executionProfile"] {
  const distributed = summary.executionMode === "distributed";
  return {
    placement: distributed ? "remote" : "local",
    interactivity: distributed ? "background" : "interactive",
    isolation: distributed ? "container_sandbox" : "host",
    network: summary.accessMode === "read-only" ? "restricted" : "default",
    authority: distributed ? "service" : "user",
  };
}

function projectRuntimeRunContinuationCompat(
  record: RuntimeRunRecordV2
): KernelJob["continuation"] {
  const continuation = record.missionRun.continuation ?? null;
  const reviewPack = record.reviewPack;
  const takeoverBundle = reviewPack?.takeoverBundle ?? record.missionRun.takeoverBundle ?? null;
  const missionLinkage = reviewPack?.missionLinkage ?? record.missionRun.missionLinkage ?? null;
  const reviewActionability = resolvePreferredReviewActionability({
    takeoverBundle,
    actionability: reviewPack?.actionability ?? record.missionRun.actionability ?? null,
  });
  const publishHandoff = resolvePreferredPublishHandoff({
    takeoverBundle,
    publishHandoff: reviewPack?.publishHandoff ?? record.missionRun.publishHandoff ?? null,
  });
  const continuationDescriptor = buildRuntimeContinuationDescriptor({
    runState: record.missionRun.state ?? null,
    checkpoint: record.missionRun.checkpoint ?? null,
    missionLinkage,
    actionability: reviewActionability,
    publishHandoff,
    takeoverBundle,
    nextAction: record.missionRun.nextAction ?? null,
    reviewPackId: reviewPack?.id ?? record.missionRun.reviewPackId ?? null,
  });
  const resumeSupported =
    record.run.checkpointState?.resumeReady === true ||
    continuation?.pathKind === "resume" ||
    continuationDescriptor?.pathKind === "resume";

  return {
    checkpointId: record.run.checkpointId ?? record.missionRun.checkpoint?.checkpointId ?? null,
    resumeSupported,
    recovered: record.run.recovered === true || record.missionRun.checkpoint?.recovered === true,
    reviewActionability,
    takeover: takeoverBundle,
    missionLinkage,
    publishHandoff,
    summary:
      continuation?.summary ??
      continuationDescriptor?.summary ??
      takeoverBundle?.summary ??
      publishHandoff?.summary ??
      null,
  };
}

export function projectRuntimeRunRecordToKernelJobCompat(
  record: RuntimeRunRecordV2,
  canonicalMethod: RuntimeKernelJobCompatCanonicalMethod
): KernelJob {
  return {
    id: readRuntimeRunIdCompat(record),
    workspaceId: record.run.workspaceId,
    threadId: record.run.threadId ?? record.missionRun.lineage?.threadId ?? null,
    title: record.run.title ?? record.missionRun.title ?? null,
    status: record.run.status,
    provider:
      record.run.provider ??
      record.run.routedProvider ??
      record.missionRun.routing?.provider ??
      null,
    modelId: record.run.modelId ?? record.run.routedModelId ?? null,
    backendId:
      record.run.backendId ??
      record.missionRun.routing?.backendId ??
      record.missionRun.placement?.resolvedBackendId ??
      null,
    preferredBackendIds:
      record.run.preferredBackendIds ?? record.missionRun.placement?.requestedBackendIds ?? null,
    executionProfile: projectRuntimeRunExecutionProfileCompat(record.run),
    createdAt: record.run.createdAt,
    updatedAt: record.run.updatedAt,
    startedAt: record.run.startedAt ?? record.missionRun.startedAt ?? null,
    completedAt: record.run.completedAt ?? record.missionRun.finishedAt ?? null,
    continuation: projectRuntimeRunContinuationCompat(record),
    metadata: {
      canonicalMethod,
      runId: record.missionRun.id ?? readRuntimeRunIdCompat(record),
      reviewPackId: record.reviewPack?.id ?? record.missionRun.reviewPackId ?? null,
    },
  };
}

export function projectRuntimeRunSummaryToKernelJobCompat(
  summary: RuntimeRunSummary,
  canonicalMethod: Extract<RuntimeKernelJobCompatCanonicalMethod, "code_runtime_runs_list">
): KernelJob {
  const takeoverBundle = summary.takeoverBundle ?? null;
  const reviewActionability = resolvePreferredReviewActionability({
    takeoverBundle,
    actionability: summary.reviewActionability ?? null,
  });
  const publishHandoff = resolvePreferredPublishHandoff({
    takeoverBundle,
    publishHandoff: summary.publishHandoff ?? null,
  });

  return {
    id: summary.taskId,
    workspaceId: summary.workspaceId,
    threadId: summary.threadId ?? null,
    title: summary.title ?? null,
    status: summary.status,
    provider: summary.provider ?? summary.routedProvider ?? null,
    modelId: summary.modelId ?? summary.routedModelId ?? null,
    backendId: summary.backendId ?? summary.routing?.backendId ?? null,
    preferredBackendIds: summary.preferredBackendIds ?? null,
    executionProfile: projectRuntimeRunSummaryExecutionProfileCompat(summary),
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    startedAt: summary.startedAt ?? null,
    completedAt: summary.completedAt ?? null,
    continuation: {
      checkpointId: summary.checkpointId ?? null,
      resumeSupported:
        summary.checkpointState?.resumeReady === true ||
        summary.continuation?.pathKind === "resume" ||
        (summary.checkpointId != null && summary.continuation != null),
      recovered: summary.recovered === true,
      reviewActionability,
      takeover: takeoverBundle,
      missionLinkage: summary.missionLinkage ?? null,
      publishHandoff,
      summary:
        summary.continuation?.summary ??
        reviewActionability?.summary ??
        takeoverBundle?.summary ??
        publishHandoff?.summary ??
        null,
    },
    metadata: {
      canonicalMethod,
      runId: summary.taskId,
      reviewPackId: summary.reviewPackId ?? null,
    },
  };
}

export function projectRuntimeRunSummariesToKernelJobsCompat(
  summaries: RuntimeRunSummary[],
  canonicalMethod: Extract<RuntimeKernelJobCompatCanonicalMethod, "code_runtime_runs_list">
): KernelJob[] {
  return summaries.map((summary) =>
    projectRuntimeRunSummaryToKernelJobCompat(summary, canonicalMethod)
  );
}

export function projectRuntimeRunRecordToResumeAckCompat(
  record: RuntimeRunRecordV2,
  options: { message: string }
): RuntimeRunResumeAck {
  return {
    accepted: true,
    runId: readRuntimeRunIdCompat(record),
    status: record.run.status,
    code: null,
    message: options.message,
    recovered: record.run.recovered ?? null,
    checkpointId: record.run.checkpointId ?? null,
    traceId: record.run.traceId ?? null,
    updatedAt: record.run.updatedAt ?? null,
  };
}

export function projectRuntimeRunRecordToInterventionAckCompat(
  request: RuntimeRunInterventionRequest,
  record: RuntimeRunRecordV2
): RuntimeRunInterventionAck {
  const runId = readRuntimeRunIdCompat(record);
  const spawnedRunId = runId !== request.runId ? runId : null;
  return {
    accepted: true,
    action: request.action,
    runId,
    status: record.run.status,
    outcome: spawnedRunId ? "spawned" : "submitted",
    spawnedRunId,
    checkpointId: record.run.checkpointId ?? null,
  };
}
