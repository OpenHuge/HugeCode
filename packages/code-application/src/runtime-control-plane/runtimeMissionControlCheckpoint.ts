import type {
  AgentTaskSummary,
  HugeCodeCheckpointSummary,
  RuntimeCheckpointState,
} from "@ku0/code-runtime-host-contract";

function isRecoveryErrorCode(errorCode: string | null | undefined) {
  const normalized = errorCode?.trim().toLowerCase();
  return (
    normalized === "runtime_restart_recovery" ||
    normalized === "runtime.restart.recovery" ||
    normalized === "runtime.task.interrupt.recoverable" ||
    normalized === "runtime.task.interrupt.recovery"
  );
}

function toCheckpointWorkflowState(
  status: AgentTaskSummary["status"]
): RuntimeCheckpointState["state"] {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "paused":
      return "running";
    case "awaiting_approval":
      return "awaiting_approval";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "interrupted";
    case "interrupted":
      return "interrupted";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function buildFallbackCheckpointSummary(input: {
  status: AgentTaskSummary["status"];
  checkpointId: string | null;
  recovered: boolean;
  resumeReady: boolean;
}) {
  if (input.recovered) {
    return "Runtime recovered the run from a checkpoint. Resume to continue.";
  }
  if (input.resumeReady && input.status === "paused") {
    return "Run is paused and can continue from its latest checkpoint.";
  }
  if (input.resumeReady) {
    return "Run was interrupted and can resume from a checkpoint.";
  }
  if (input.checkpointId) {
    return `Checkpoint ${input.checkpointId} is the latest runtime recovery marker.`;
  }
  return null;
}

export function isTaskCheckpointResumeReady(
  task: Pick<AgentTaskSummary, "status" | "errorCode" | "recovered" | "checkpointState">
) {
  if (typeof task.checkpointState?.resumeReady === "boolean") {
    return task.checkpointState.resumeReady;
  }
  if (task.status === "paused") {
    return true;
  }
  return (
    task.status === "interrupted" &&
    (task.recovered === true || isRecoveryErrorCode(task.errorCode))
  );
}

export function buildTaskCheckpointState(
  task: Pick<
    AgentTaskSummary,
    | "taskId"
    | "status"
    | "updatedAt"
    | "errorCode"
    | "checkpointId"
    | "traceId"
    | "recovered"
    | "checkpointState"
  >
): RuntimeCheckpointState | null {
  const existing = task.checkpointState ?? null;
  const checkpointId = existing?.checkpointId ?? task.checkpointId ?? null;
  const traceId = existing?.traceId ?? task.traceId ?? null;
  const recovered = existing?.recovered ?? task.recovered === true;
  const resumeReady = existing?.resumeReady ?? isTaskCheckpointResumeReady(task);
  const updatedAt = existing?.updatedAt ?? task.updatedAt ?? null;
  const recoveredAt = existing?.recoveredAt ?? (recovered ? updatedAt : null);
  const summary =
    existing?.summary ??
    buildFallbackCheckpointSummary({
      status: task.status,
      checkpointId,
      recovered,
      resumeReady,
    });

  if (
    !existing &&
    checkpointId === null &&
    traceId === null &&
    recovered === false &&
    resumeReady === false &&
    summary === null
  ) {
    return null;
  }

  return {
    state: existing?.state ?? toCheckpointWorkflowState(task.status),
    lifecycleState: existing?.lifecycleState ?? task.status,
    checkpointId,
    traceId,
    recovered,
    updatedAt,
    resumeReady,
    recoveredAt,
    summary,
  };
}

export function buildMissionRunCheckpoint(
  task: Pick<
    AgentTaskSummary,
    | "taskId"
    | "status"
    | "updatedAt"
    | "errorCode"
    | "checkpointId"
    | "traceId"
    | "recovered"
    | "checkpointState"
  >
): HugeCodeCheckpointSummary | null {
  const checkpointState = buildTaskCheckpointState(task);
  if (!checkpointState) {
    return null;
  }
  return {
    state: checkpointState.state,
    lifecycleState: checkpointState.lifecycleState ?? null,
    checkpointId: checkpointState.checkpointId ?? null,
    traceId: checkpointState.traceId ?? null,
    recovered: checkpointState.recovered === true,
    updatedAt: checkpointState.updatedAt ?? null,
    resumeReady: checkpointState.resumeReady ?? null,
    recoveredAt: checkpointState.recoveredAt ?? null,
    summary: checkpointState.summary ?? null,
  };
}
