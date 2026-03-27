import type {
  KernelJob,
  RuntimeRunInterventionAck,
  RuntimeRunInterventionRequest,
  RuntimeRunRecordV2,
  RuntimeRunResumeAck,
} from "./codeRuntimeRpc.js";
import {
  buildRuntimeContinuationDescriptor,
  resolvePreferredPublishHandoff,
  resolvePreferredReviewActionability,
} from "./runtimeContinuationFacade.js";

export type RuntimeKernelJobCompatCanonicalMethod =
  | "code_runtime_run_get_v2"
  | "code_runtime_run_subscribe_v2";

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
  record: RuntimeRunRecordV2
): KernelJob["executionProfile"] {
  const distributed = record.run.executionMode === "distributed";
  return {
    placement: distributed ? "remote" : "local",
    interactivity: distributed ? "background" : "interactive",
    isolation: distributed ? "container_sandbox" : "host",
    network: record.run.accessMode === "read-only" ? "restricted" : "default",
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
    executionProfile: projectRuntimeRunExecutionProfileCompat(record),
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
