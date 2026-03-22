import type {
  AgentTaskStatus,
  AgentTaskSourceSummary,
  AgentTaskSummary,
  HugeCodeMissionLineage,
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
  HugeCodeSubAgentSummary,
  HugeCodeRunLedger,
  HugeCodeRunState,
  HugeCodeRunSummary,
  HugeCodeTaskSourceSummary,
  HugeCodeTaskMode,
  HugeCodeTaskModeSource,
  HugeCodeTaskStatus,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
// Mission Control projection facade only. Keep transport/event/schema-validation
// infrastructure in runtime ports or the runtime-client package instead of
// adding new low-level orchestration here.
import type { RuntimeGateway } from "./RuntimeGateway";
import { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";
import { type RunProjectionRoutingContext } from "./runtimeMissionControlRouting";
import { buildMissionRunCheckpoint } from "./runtimeMissionControlCheckpoint";
import {
  buildRunPublishHandoff,
  projectCompletedRunToReviewPackSummary as projectCompletedRunToReviewPackSummaryWithHelpers,
} from "./runtimeMissionControlReviewPackProjection";
import {
  buildRunWorkspaceEvidence,
  buildTaskAccountability,
} from "./runtimeMissionControlRuntimeTruth";
import { projectAgentTaskSummaryToRunSummary as projectAgentTaskSummaryToRunSummaryWithHelpers } from "./runtimeMissionControlRunProjection";
import {
  deriveRuntimeTaskSource,
  deriveThreadTaskSource,
  normalizeMissionTaskSource as normalizeTaskSource,
} from "./runtimeMissionControlTaskSourceSummary";

export { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";
export type { RunProjectionRoutingContext } from "./runtimeMissionControlRouting";

const RUNTIME_TASK_ENTITY_PREFIX = "runtime-task:";

type MissionControlWorkspaceSource = {
  id: string;
  name: string;
  rootPath: string;
  connected: boolean;
  defaultProfileId?: string | null;
};

type MissionControlThreadSource = {
  id: string;
  workspaceId: string;
  title: string;
  updatedAt: number;
  archived?: boolean;
  latestRunState?: HugeCodeRunState | null;
};

function deriveTaskMode(run: Pick<HugeCodeRunSummary, "executionProfile">): {
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

function mapRunStateToTaskStatus(state: HugeCodeRunState): HugeCodeTaskStatus {
  switch (state) {
    case "draft":
      return "draft";
    case "queued":
    case "preparing":
      return "queued";
    case "running":
    case "validating":
      return "running";
    case "paused":
      return "paused";
    case "needs_input":
      return "needs_input";
    case "review_ready":
      return "review_ready";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

function isTerminalRunState(state: HugeCodeRunState): boolean {
  return state === "review_ready" || state === "failed" || state === "cancelled";
}

function buildMissionLineage(input: {
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
    taskSource: normalizeTaskSource(input.taskSource) ?? null,
    threadId: input.threadId ?? null,
    requestId: input.requestId ?? null,
    rootTaskId: input.rootTaskId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    childTaskIds: input.childTaskIds ?? [],
    reviewDecisionState: input.reviewDecision?.status ?? null,
    reviewDecisionSummary: input.reviewDecision?.summary ?? null,
  };
}

function buildRunLedger(input: {
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

function normalizeSubAgentSessions(
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

function buildRuntimePublishedRunSummary(input: {
  task: AgentTaskSummary;
  taskId?: string | null;
  routingContext?: RunProjectionRoutingContext;
  subAgents?: HugeCodeSubAgentSummary[] | null;
  workspaceRoot?: string | null;
}): HugeCodeRunSummary {
  const runtimeRun = input.task.runSummary;
  if (!runtimeRun) {
    return projectAgentTaskSummaryToRunSummaryWithHelpers(
      input.task,
      {
        deriveTaskMode,
        buildMissionLineage,
        buildRunLedger,
        normalizeSubAgentSessions,
        projectAgentTaskStatusToRunState,
        isTerminalRunState,
        resolveMissionTaskId,
        buildRunPublishHandoff,
      },
      input
    );
  }

  const subAgents = normalizeSubAgentSessions(input.subAgents);
  const run = {
    ...runtimeRun,
    taskId: runtimeRun.taskId ?? resolveMissionTaskId(input.task.taskId, input.task.threadId),
    reviewPackId:
      runtimeRun.reviewPackId ??
      input.task.reviewPackId ??
      (isTerminalRunState(runtimeRun.state) ? `review-pack:${input.task.taskId}` : null),
    subAgents: subAgents.length > 0 ? subAgents : (runtimeRun.subAgents ?? []),
  } satisfies HugeCodeRunSummary;

  return {
    ...run,
    workspaceEvidence:
      run.workspaceEvidence ??
      buildRunWorkspaceEvidence({
        run,
      }),
  };
}

function buildRuntimePublishedReviewPackSummary(input: {
  task: AgentTaskSummary;
  run: HugeCodeRunSummary;
}): HugeCodeReviewPackSummary | null {
  const runtimeReviewPack = input.task.reviewPackSummary;
  if (!runtimeReviewPack) {
    return projectCompletedRunToReviewPackSummaryWithHelpers(input.run, {
      deriveTaskMode,
      buildMissionLineage,
      buildRunWorkspaceEvidence,
      isTerminalRunState,
    });
  }

  const reviewDecision =
    runtimeReviewPack.reviewDecision ??
    input.run.reviewDecision ??
    (runtimeReviewPack.id
      ? {
          status: "pending" as const,
          reviewPackId: runtimeReviewPack.id,
          label: "Decision pending",
          summary: "Accept or reject this result from the review surface.",
          decidedAt: null,
        }
      : null);
  const reviewPackSubAgents =
    (runtimeReviewPack.subAgentSummary?.length ?? 0) > 0
      ? runtimeReviewPack.subAgentSummary
      : (input.run.subAgents ?? []);

  return {
    ...runtimeReviewPack,
    runId: runtimeReviewPack.runId ?? input.run.id,
    taskId: runtimeReviewPack.taskId ?? input.run.taskId,
    workspaceId: runtimeReviewPack.workspaceId ?? input.run.workspaceId,
    taskSource: runtimeReviewPack.taskSource ?? input.run.taskSource ?? null,
    reviewDecision,
    createdAt: runtimeReviewPack.createdAt ?? input.run.finishedAt ?? input.run.updatedAt,
    lineage: runtimeReviewPack.lineage ?? input.run.lineage ?? null,
    ledger: runtimeReviewPack.ledger ?? input.run.ledger ?? null,
    checkpoint: runtimeReviewPack.checkpoint ?? input.run.checkpoint ?? null,
    missionLinkage: runtimeReviewPack.missionLinkage ?? input.run.missionLinkage ?? null,
    actionability: runtimeReviewPack.actionability ?? input.run.actionability ?? null,
    reviewProfileId: runtimeReviewPack.reviewProfileId ?? input.run.reviewProfileId ?? null,
    reviewGate: runtimeReviewPack.reviewGate ?? input.run.reviewGate ?? null,
    reviewFindings: runtimeReviewPack.reviewFindings ?? input.run.reviewFindings ?? [],
    reviewRunId: runtimeReviewPack.reviewRunId ?? input.run.reviewRunId ?? null,
    skillUsage: runtimeReviewPack.skillUsage ?? input.run.skillUsage ?? [],
    autofixCandidate: runtimeReviewPack.autofixCandidate ?? input.run.autofixCandidate ?? null,
    governance: runtimeReviewPack.governance ?? input.run.governance ?? null,
    placement: runtimeReviewPack.placement ?? input.run.placement ?? null,
    workspaceEvidence: runtimeReviewPack.workspaceEvidence ?? input.run.workspaceEvidence ?? null,
    subAgentSummary: reviewPackSubAgents,
    publishHandoff: runtimeReviewPack.publishHandoff ?? input.run.publishHandoff ?? null,
    takeoverBundle: runtimeReviewPack.takeoverBundle ?? input.run.takeoverBundle ?? null,
  };
}

export type MissionWorkspaceSummary = Required<MissionControlWorkspaceSource>;

export function projectWorkspaceSummaryToMissionWorkspace(
  workspace: MissionControlWorkspaceSource
): MissionWorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    rootPath: workspace.rootPath,
    connected: workspace.connected,
    defaultProfileId: workspace.defaultProfileId ?? null,
  };
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

export function projectThreadSummaryToTaskSummary(
  thread: MissionControlThreadSource,
  latestRun?: HugeCodeRunSummary | null
): HugeCodeTaskSummary {
  const normalizedTitle = thread.title.trim();
  const title = normalizedTitle.length > 0 ? normalizedTitle : "Untitled task";
  const taskMode = latestRun
    ? deriveTaskMode(latestRun)
    : { mode: null, modeSource: "missing" as const };
  const taskStatus = latestRun
    ? mapRunStateToTaskStatus(latestRun.state)
    : thread.archived
      ? "archived"
      : thread.latestRunState === "paused"
        ? "paused"
        : thread.latestRunState && !isTerminalRunState(thread.latestRunState)
          ? "running"
          : "ready";
  const accountability = buildTaskAccountability({
    run: latestRun ?? null,
    createdAt: thread.updatedAt,
  });
  const taskSource = deriveThreadTaskSource(thread, title);
  return {
    id: thread.id,
    workspaceId: thread.workspaceId,
    title,
    objective: title,
    origin: {
      kind: "thread",
      threadId: thread.id,
      runId: latestRun?.id ?? null,
      requestId: null,
    },
    taskSource,
    mode: taskMode.mode,
    modeSource: taskMode.modeSource,
    status: taskStatus,
    createdAt: thread.updatedAt,
    updatedAt: Math.max(thread.updatedAt, latestRun?.updatedAt ?? 0),
    currentRunId: latestRun && !isTerminalRunState(latestRun.state) ? latestRun.id : null,
    latestRunId: latestRun?.id ?? null,
    latestRunState: latestRun?.state ?? thread.latestRunState ?? null,
    nextAction: latestRun?.nextAction ?? null,
    lineage: buildMissionLineage({
      objective: title,
      taskSource,
      threadId: thread.id,
      requestId: null,
      executionProfileId: latestRun?.executionProfile?.id ?? null,
      taskMode: taskMode.mode,
      reviewDecision: latestRun?.reviewDecision ?? null,
      autoDrive: latestRun?.autoDrive ?? null,
    }),
    ...(accountability ? { accountability } : {}),
  };
}

export function projectAgentTaskSummaryToRunSummary(
  task: AgentTaskSummary,
  options?: {
    taskId?: string | null;
    routingContext?: RunProjectionRoutingContext;
    subAgents?: HugeCodeSubAgentSummary[] | null;
    workspaceRoot?: string | null;
  }
): HugeCodeRunSummary {
  return projectAgentTaskSummaryToRunSummaryWithHelpers(
    task,
    {
      deriveTaskMode,
      buildMissionLineage,
      buildRunLedger,
      normalizeSubAgentSessions,
      projectAgentTaskStatusToRunState,
      isTerminalRunState,
      resolveMissionTaskId,
      buildRunPublishHandoff,
    },
    options
  );
}

export function projectCompletedRunToReviewPackSummary(
  run: HugeCodeRunSummary
): HugeCodeReviewPackSummary | null {
  return projectCompletedRunToReviewPackSummaryWithHelpers(run, {
    deriveTaskMode,
    buildMissionLineage,
    buildRunWorkspaceEvidence,
    isTerminalRunState,
  });
}

export function projectRuntimeTaskToTaskSummary(task: AgentTaskSummary): HugeCodeTaskSummary {
  const run = buildRuntimePublishedRunSummary({ task });
  const summary =
    task.steps.map((step) => step.message?.trim() ?? "").find((entry) => entry.length > 0) ?? null;
  const title = task.title?.trim() || summary || "Runtime-managed mission";
  const taskMode = deriveTaskMode(run);
  const taskSource = run.taskSource ?? deriveRuntimeTaskSource(task, title);
  return {
    id: resolveMissionTaskId(task.taskId, task.threadId),
    workspaceId: task.workspaceId,
    title,
    objective: title,
    origin: {
      kind: "run",
      threadId: task.threadId ?? null,
      runId: run.id,
      requestId: task.requestId ?? null,
    },
    taskSource,
    mode: taskMode.mode,
    modeSource: taskMode.modeSource,
    status: mapRunStateToTaskStatus(run.state),
    createdAt: task.createdAt,
    updatedAt: run.updatedAt,
    currentRunId: isTerminalRunState(run.state) ? null : run.id,
    latestRunId: run.id,
    latestRunState: run.state,
    nextAction: run.nextAction ?? null,
    lineage: buildMissionLineage({
      objective: title,
      taskSource,
      threadId: task.threadId ?? null,
      requestId: task.requestId ?? null,
      executionProfileId: run.executionProfile?.id ?? task.executionProfileId ?? null,
      taskMode: taskMode.mode,
      rootTaskId: task.rootTaskId ?? null,
      parentTaskId: task.parentTaskId ?? null,
      childTaskIds: task.childTaskIds ?? [],
      autoDrive: task.autoDrive ?? null,
      reviewDecision: run.reviewDecision ?? null,
    }),
    accountability: buildTaskAccountability({
      run,
      createdAt: task.createdAt,
    }),
    executionGraph: run.executionGraph ?? null,
  };
}

function buildOrphanTaskSummary(
  run: HugeCodeRunSummary,
  task: AgentTaskSummary
): HugeCodeTaskSummary {
  const taskMode = deriveTaskMode(run);
  const title = run.title?.trim() || run.summary?.trim() || task.title?.trim() || "Untitled task";
  const taskSource = run.taskSource ?? deriveRuntimeTaskSource(task, title);
  return {
    id: resolveMissionTaskId(run.id, task.threadId),
    workspaceId: run.workspaceId,
    title,
    objective: title,
    origin: {
      kind: "run",
      threadId: task.threadId ?? null,
      runId: run.id,
      requestId: task.requestId ?? null,
    },
    taskSource,
    mode: taskMode.mode,
    modeSource: taskMode.modeSource,
    status: mapRunStateToTaskStatus(run.state),
    createdAt: task.createdAt,
    updatedAt: run.updatedAt,
    currentRunId: isTerminalRunState(run.state) ? null : run.id,
    latestRunId: run.id,
    latestRunState: run.state,
    nextAction: run.nextAction ?? null,
    lineage: buildMissionLineage({
      objective: title,
      taskSource,
      threadId: task.threadId ?? null,
      requestId: task.requestId ?? null,
      executionProfileId: run.executionProfile?.id ?? task.executionProfileId ?? null,
      taskMode: taskMode.mode,
      rootTaskId: task.rootTaskId ?? null,
      parentTaskId: task.parentTaskId ?? null,
      childTaskIds: task.childTaskIds ?? [],
      autoDrive: task.autoDrive ?? null,
      reviewDecision: run.reviewDecision ?? null,
    }),
    accountability: buildTaskAccountability({
      run,
      createdAt: task.createdAt,
    }),
    executionGraph: run.executionGraph ?? null,
  };
}

export type MissionControlProjection = HugeCodeMissionControlSnapshot;
export type RuntimeMissionRunSummary = HugeCodeRunSummary;
export type MissionControlWorkspaceMetadata = MissionControlWorkspaceSource;
export type MissionControlThreadMetadata = MissionControlThreadSource;

export async function resolveMissionControlSnapshot(input: {
  runtimeGateway: Pick<RuntimeGateway, "readMissionControlSnapshot">;
  workspaces: MissionControlWorkspaceSource[];
  threads: MissionControlThreadSource[];
  routingContext?: RunProjectionRoutingContext;
}): Promise<MissionControlProjection> {
  void input;
  return await input.runtimeGateway.readMissionControlSnapshot();
}

// Mission control projection is presentation data. Workspaces and threads contribute
// only stable metadata; runtime task summaries remain the sole source of run/review truth.
export function buildMissionControlProjection(input: {
  source?: MissionControlProjection["source"];
  workspaces: MissionControlWorkspaceSource[];
  threads: MissionControlThreadSource[];
  runtimeTasks: AgentTaskSummary[];
  routingContext?: RunProjectionRoutingContext;
  generatedAt?: number;
  subAgentSessions?: HugeCodeSubAgentSummary[] | null;
}): MissionControlProjection {
  const workspaces = input.workspaces.map(projectWorkspaceSummaryToMissionWorkspace);
  const workspaceRootById = new Map(
    workspaces.map((workspace) => [workspace.id, workspace.rootPath])
  );
  const taskByRunId = new Map(input.runtimeTasks.map((task) => [task.taskId, task]));
  const subAgentsByRunId = new Map<string, HugeCodeSubAgentSummary[]>();
  for (const subAgent of normalizeSubAgentSessions(input.subAgentSessions)) {
    const parentRunId = subAgent.parentRunId;
    if (!parentRunId) {
      continue;
    }
    const existing = subAgentsByRunId.get(parentRunId) ?? [];
    existing.push(subAgent);
    subAgentsByRunId.set(parentRunId, existing);
  }
  const runs = input.runtimeTasks.map((task) =>
    buildRuntimePublishedRunSummary({
      task,
      taskId: resolveMissionTaskId(task.taskId, task.threadId),
      routingContext: input.routingContext,
      subAgents: subAgentsByRunId.get(task.taskId) ?? [],
      workspaceRoot: workspaceRootById.get(task.workspaceId) ?? null,
    })
  );
  const runById = new Map(runs.map((run) => [run.id, run]));

  const latestRunByTaskId = new Map<string, HugeCodeRunSummary>();
  for (const run of runs) {
    const existing = latestRunByTaskId.get(run.taskId);
    if (!existing || run.updatedAt > existing.updatedAt) {
      latestRunByTaskId.set(run.taskId, run);
    }
  }

  const tasks = input.threads.map((thread) =>
    projectThreadSummaryToTaskSummary(thread, latestRunByTaskId.get(thread.id) ?? null)
  );

  const taskIds = new Set(tasks.map((task) => task.id));
  for (const run of runs) {
    if (taskIds.has(run.taskId)) {
      continue;
    }
    const rawTask = taskByRunId.get(run.id);
    if (!rawTask) {
      continue;
    }
    tasks.push(buildOrphanTaskSummary(run, rawTask));
    taskIds.add(run.taskId);
  }

  const reviewPacks = input.runtimeTasks
    .map((task) => {
      const run = runById.get(task.taskId);
      if (!run) {
        return null;
      }
      return buildRuntimePublishedReviewPackSummary({ task, run });
    })
    .filter((entry): entry is HugeCodeReviewPackSummary => entry !== null);

  return {
    source: input.source ?? "runtime_snapshot_v1",
    generatedAt: input.generatedAt ?? Date.now(),
    workspaces,
    tasks,
    runs,
    reviewPacks,
  };
}
