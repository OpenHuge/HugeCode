import type { HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import type { RuntimeAgentTaskResumeResult, RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import { readRuntimeErrorCode, readRuntimeErrorMessage } from "../ports/runtimeErrorClassifier";
import { resolveRuntimeErrorLabel } from "./runtimeMissionControlErrorPresentation";
import type { RuntimeResumeBatchOutcome } from "./runtimeMissionControlActions";

export function buildRuntimeTaskResumeFeedback(
  taskId: string,
  ack: RuntimeAgentTaskResumeResult
): { info: string | null; error: string | null } {
  if (ack.accepted) {
    const checkpointSuffix =
      typeof ack.checkpointId === "string" && ack.checkpointId.trim().length > 0
        ? ` (checkpoint ${ack.checkpointId})`
        : "";
    return {
      info: `Run ${taskId} resumed${checkpointSuffix}.`,
      error: null,
    };
  }
  return {
    info: null,
    error: ack.message || `Run ${taskId} could not be resumed.`,
  };
}

export function buildRuntimeResumeBatchOutcome(
  entry: PromiseSettledResult<RuntimeAgentTaskResumeResult>
): RuntimeResumeBatchOutcome {
  if (entry.status === "fulfilled") {
    if (entry.value.accepted) {
      return { status: "accepted" };
    }
    return {
      status: "rejected",
      errorLabel: resolveRuntimeErrorLabel(entry.value),
    };
  }
  const failureCode = readRuntimeErrorCode(entry.reason);
  const failureMessage = readRuntimeErrorMessage(entry.reason);
  return {
    status: "failed",
    errorLabel:
      failureCode ??
      failureMessage ??
      (typeof entry.reason === "string" && entry.reason.trim().length > 0
        ? entry.reason.trim()
        : null),
  };
}

export function buildRuntimeManagedTaskStartInfo(input: {
  dispatchPlanTaskCount: number | null;
  dispatchSessionId: string | null;
  executionProfileName: string;
  routedProvider: string | null;
  selectedProviderRouteLabel: string | null;
}) {
  if (
    typeof input.dispatchPlanTaskCount === "number" &&
    input.dispatchPlanTaskCount > 0 &&
    input.dispatchSessionId
  ) {
    return `Parallel dispatch ${input.dispatchSessionId} started with ${input.dispatchPlanTaskCount} chunk(s).`;
  }
  return `Mission run started with ${input.executionProfileName}${input.routedProvider ? ` via ${input.selectedProviderRouteLabel ?? input.routedProvider}` : ""}.`;
}

export function resolvePrepareRunLauncherProfileId(input: {
  taskId: string;
  profileId?: string | null;
  projectedRunsByTaskId: Map<string, HugeCodeRunSummary>;
}) {
  return (
    input.profileId?.trim() || input.projectedRunsByTaskId.get(input.taskId)?.executionProfile?.id
  );
}

export function readStalePendingApprovalInterruptInfo(
  tasks: RuntimeAgentTaskSummary[]
): string | null {
  if (tasks.length === 0) {
    return "No stale pending approvals to interrupt.";
  }
  return `Interrupted ${tasks.length} stale pending approval task(s).`;
}
