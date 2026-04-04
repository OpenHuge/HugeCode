import type {
  AgentTaskSourceSummary,
  AgentTaskStatus,
  AgentTaskSummary,
  HugeCodeMissionLineage,
  HugeCodeRunLedger,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeSubAgentSummary,
  HugeCodeTaskMode,
  HugeCodeTaskModeSource,
  HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";
import { buildMissionRunCheckpoint } from "./runtimeMissionControlCheckpoint";
import { normalizeMissionTaskSource } from "./runtimeMissionControlTaskSourceSummary";

const RUNTIME_TASK_ENTITY_PREFIX = "runtime-task:";

export function deriveTaskMode(run: Pick<HugeCodeRunSummary, "executionProfile">): {
  mode: HugeCodeTaskMode | null;
  modeSource: HugeCodeTaskModeSource;
} {
  const autonomy = run.executionProfile?.autonomy;
  if (autonomy === "operator_review") {
    return { mode: "ask", modeSource: "execution_profile" };
  }
  if (autonomy === "bounded_delegate") {
    return { mode: "pair", modeSource: "execution_profile" };
  }
  if (autonomy === "autonomous_delegate") {
    return { mode: "delegate", modeSource: "execution_profile" };
  }
  if (run.executionProfile?.executionMode === "remote_sandbox") {
    return { mode: "delegate", modeSource: "execution_mode" };
  }
  if (run.executionProfile?.accessMode === "read-only") {
    return { mode: "ask", modeSource: "access_mode" };
  }
  if (run.executionProfile?.accessMode === "full-access") {
    return { mode: "delegate", modeSource: "access_mode" };
  }
  if (run.executionProfile?.accessMode === "on-request") {
    return { mode: "pair", modeSource: "access_mode" };
  }
  return { mode: null, modeSource: "missing" };
}

export function projectAgentTaskStatusToRunState(status: AgentTaskStatus): HugeCodeRunState {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "awaiting_approval":
      return "needs_input";
    case "completed":
      return "review_ready";
    case "failed":
      return "failed";
    case "cancelled":
    case "interrupted":
      return "cancelled";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

export function isTerminalRunState(state: HugeCodeRunState): boolean {
  return state === "review_ready" || state === "failed" || state === "cancelled";
}

export function buildMissionLineage(input: {
  objective: string | null;
  taskSource?: AgentTaskSourceSummary | HugeCodeTaskSourceSummary | null;
  threadId?: string | null;
  requestId?: string | null;
  executionProfileId?: string | null;
  taskMode?: HugeCodeTaskMode | null;
  rootTaskId?: string | null;
  parentTaskId?: string | null;
  childTaskIds?: string[] | null;
  autoDrive?: AgentTaskSummary["autoDrive"] | HugeCodeRunSummary["autoDrive"] | null;
  reviewDecision?: HugeCodeRunSummary["reviewDecision"] | null;
}): HugeCodeMissionLineage {
  return {
    objective: input.objective,
    desiredEndState: input.autoDrive?.destination.desiredEndState ?? [],
    hardBoundaries: input.autoDrive?.destination.hardBoundaries ?? [],
    doneDefinition: input.autoDrive?.destination.doneDefinition ?? null,
    riskPolicy: input.autoDrive?.riskPolicy ?? null,
    taskMode: input.taskMode ?? null,
    executionProfileId: input.executionProfileId ?? null,
    taskSource: normalizeMissionTaskSource(input.taskSource) ?? null,
    threadId: input.threadId ?? null,
    requestId: input.requestId ?? null,
    rootTaskId: input.rootTaskId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    childTaskIds: input.childTaskIds ?? [],
    reviewDecisionState: input.reviewDecision?.status ?? null,
    reviewDecisionSummary: input.reviewDecision?.summary ?? null,
  };
}

export function buildRunLedger(input: {
  task: AgentTaskSummary;
  warnings: string[];
  validations: HugeCodeRunSummary["validations"];
  artifacts: HugeCodeRunSummary["artifacts"];
  routing: HugeCodeRunSummary["routing"];
  completionReason: string | null;
}): HugeCodeRunLedger {
  const checkpoint = buildMissionRunCheckpoint(input.task);
  return {
    traceId: checkpoint?.traceId ?? input.task.traceId ?? null,
    checkpointId: checkpoint?.checkpointId ?? input.task.checkpointId ?? null,
    recovered: checkpoint?.recovered ?? input.task.recovered === true,
    stepCount: input.task.steps.length,
    completedStepCount: input.task.steps.filter((step) => step.status === "completed").length,
    warningCount: input.warnings.length,
    validationCount: input.validations?.length ?? 0,
    artifactCount: input.artifacts?.length ?? 0,
    evidenceState:
      (input.validations?.length ?? 0) > 0 ||
      input.warnings.length > 0 ||
      (input.artifacts?.length ?? 0) > 0
        ? "confirmed"
        : "incomplete",
    backendId: input.routing?.backendId ?? input.task.backendId ?? null,
    routeLabel: input.routing?.routeLabel ?? null,
    completionReason: input.completionReason,
    lastProgressAt: input.task.autoDrive?.navigation?.lastProgressAt ?? input.task.updatedAt,
  };
}

export function normalizeSubAgentSessions(
  subAgents: HugeCodeSubAgentSummary[] | null | undefined
): HugeCodeSubAgentSummary[] {
  return (subAgents ?? [])
    .filter(
      (subAgent) => typeof subAgent.sessionId === "string" && subAgent.sessionId.trim().length > 0
    )
    .map((subAgent) => ({
      ...subAgent,
      sessionId: subAgent.sessionId.trim(),
      parentRunId: subAgent.parentRunId?.trim() || null,
      scopeProfile: subAgent.scopeProfile?.trim() || null,
      summary: subAgent.summary?.trim() || null,
      timedOutReason: subAgent.timedOutReason?.trim() || null,
      interruptedReason: subAgent.interruptedReason?.trim() || null,
    }));
}

export function resolveMissionTaskId(taskId: string, threadId?: string | null): string {
  const normalizedThreadId = threadId?.trim();
  if (normalizedThreadId) {
    return normalizedThreadId;
  }
  return `${RUNTIME_TASK_ENTITY_PREFIX}${taskId}`;
}

export function isRuntimeManagedMissionTaskId(taskId: string): boolean {
  return taskId.startsWith(RUNTIME_TASK_ENTITY_PREFIX);
}
