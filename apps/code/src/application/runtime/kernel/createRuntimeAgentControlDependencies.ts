import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeReviewPackSummary,
  HugeCodeRunSummary,
  HugeCodeTaskSummary,
  KernelJob,
} from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeBindings } from "@ku0/code-workspace-client";
import {
  closeSubAgentSession,
  getSubAgentSessionStatus,
  interruptSubAgentSession,
  sendSubAgentInstruction,
  spawnSubAgentSession,
  waitSubAgentSession,
} from "../ports/tauriRuntimeSubAgents";
import { actionRequiredGetV2, actionRequiredSubmitV2 } from "../ports/tauriRuntimeActionRequired";
import {
  distributedTaskGraph,
  respondToServerRequest,
  respondToServerRequestResult,
  respondToUserInputRequest,
} from "../ports/tauriThreads";
import { getMissionControlSnapshot } from "../ports/tauriMissionControl";
import {
  cancelRuntimeJob,
  submitRuntimeJobApprovalDecision,
  interveneRuntimeJob,
  resumeRuntimeJob,
} from "../ports/tauriRuntimeJobs";
import {
  checkoutGitBranch,
  commitGit,
  createGitBranch,
  getGitDiffs,
  getGitStatus,
  listGitBranches,
  revertGitFile,
  stageGitAll,
  stageGitFile,
  unstageGitFile,
} from "../ports/tauriGit";
import {
  getRuntimeCapabilitiesSummary,
  getRuntimeHealth,
  getRuntimeTerminalStatus,
  runRuntimeLiveSkill,
} from "../ports/tauriRuntime";
import { listRuntimeLiveSkills } from "../ports/tauriRuntimeSkills";
import { runtimeToolGuardrailRead, runtimeToolMetricsRead } from "../ports/tauriRuntimeDiagnostics";
import { buildRuntimeDiscoveryControl } from "../facades/runtimeDiscoveryControl";
import { startRuntimeJobWithRemoteSelection } from "../facades/runtimeRemoteExecutionFacade";
import type { RuntimeAgentControlDependencies } from "../facades/runtimeAgentControlFacade";
import type { RuntimeAgentTaskStatus, RuntimeAgentTaskSummary } from "../types/webMcpBridge";
import type { RuntimeWorkspaceId } from "../types/runtimeIds";

const RUNTIME_TASK_ENTITY_PREFIX = "runtime-task:";
const RUNTIME_AGENT_TASK_STATUSES: RuntimeAgentTaskStatus[] = [
  "queued",
  "running",
  "paused",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
];

function mapMissionControlRunStateToTaskStatus(
  state: HugeCodeRunSummary["state"]
): RuntimeAgentTaskStatus {
  switch (state) {
    case "draft":
    case "queued":
    case "preparing":
      return "queued";
    case "running":
    case "validating":
      return "running";
    case "paused":
      return "paused";
    case "needs_input":
      return "awaiting_approval";
    case "review_ready":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

function resolveRuntimeTaskThreadId(task: HugeCodeTaskSummary | null): string | null {
  const missionTaskId = task?.id?.trim();
  if (!missionTaskId || missionTaskId.startsWith(RUNTIME_TASK_ENTITY_PREFIX)) {
    return null;
  }
  return missionTaskId;
}

function projectMissionControlRunToRuntimeTaskSummary(input: {
  run: HugeCodeRunSummary;
  task: HugeCodeTaskSummary | null;
  reviewPack: HugeCodeReviewPackSummary | null;
}): RuntimeAgentTaskSummary {
  const { run, task, reviewPack } = input;

  return {
    taskId: run.id,
    workspaceId: run.workspaceId,
    threadId: resolveRuntimeTaskThreadId(task),
    requestId: null,
    title: run.title ?? task?.title ?? null,
    taskSource: run.taskSource ?? task?.taskSource ?? null,
    status: mapMissionControlRunStateToTaskStatus(run.state),
    accessMode: run.executionProfile?.accessMode ?? "on-request",
    executionProfileId: run.executionProfile?.id ?? null,
    executionMode: null,
    provider: run.routing?.provider ?? null,
    modelId: null,
    reasonEffort: null,
    routedProvider: run.routing?.provider ?? null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    currentStep: run.currentStepIndex ?? null,
    createdAt: task?.createdAt ?? run.startedAt ?? run.updatedAt,
    updatedAt: run.updatedAt,
    startedAt: run.startedAt ?? null,
    completedAt: run.finishedAt ?? null,
    errorCode: null,
    errorMessage: run.completionReason ?? null,
    pendingApprovalId: run.approval?.approvalId ?? null,
    reviewPackId: run.reviewPackId ?? null,
    backendId: run.routing?.backendId ?? null,
    runSummary: run,
    reviewPackSummary: reviewPack,
    steps: [],
  };
}

function normalizeKernelJobStatus(status: KernelJob["status"]): RuntimeAgentTaskStatus {
  return RUNTIME_AGENT_TASK_STATUSES.includes(status as RuntimeAgentTaskStatus)
    ? (status as RuntimeAgentTaskStatus)
    : "queued";
}

function projectKernelJobToRuntimeTaskSummary(job: KernelJob): RuntimeAgentTaskSummary {
  return {
    taskId: job.id,
    workspaceId: job.workspaceId,
    threadId: job.threadId ?? null,
    requestId: null,
    title: job.title ?? null,
    taskSource: null,
    status: normalizeKernelJobStatus(job.status),
    accessMode: "on-request",
    executionProfileId: null,
    executionMode: null,
    provider: job.provider ?? null,
    modelId: job.modelId ?? null,
    reasonEffort: null,
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    currentStep: null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    backendId: job.backendId ?? null,
    preferredBackendIds: job.preferredBackendIds ?? null,
    steps: [],
  };
}

function readKernelProjectionJobsSlice(
  runtime: Pick<WorkspaceClientRuntimeBindings, "kernelProjection"> | null | undefined
) {
  if (!runtime?.kernelProjection) {
    return null;
  }
  return runtime.kernelProjection
    .bootstrap({
      scopes: ["mission_control", "jobs"],
    })
    .then((bootstrap) => {
      const missionControl = bootstrap.slices.mission_control;
      const jobs = bootstrap.slices.jobs;
      return {
        missionControl:
          missionControl && typeof missionControl === "object"
            ? (missionControl as HugeCodeMissionControlSnapshot)
            : null,
        jobs: Array.isArray(jobs) ? (jobs as KernelJob[]) : [],
      };
    })
    .catch(() => null);
}

function projectRuntimeTaskTruth(input: {
  workspaceId: string;
  snapshot: HugeCodeMissionControlSnapshot;
  jobs?: readonly KernelJob[] | null;
  status: RuntimeAgentTaskSummary["status"] | null | undefined;
  limit: number | null | undefined;
}) {
  const { workspaceId, snapshot, jobs: rawJobs = [], status, limit } = input;
  const jobs = rawJobs ?? [];
  const taskByMissionId = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const reviewPackByRunId = new Map(
    snapshot.reviewPacks.map((reviewPack) => [reviewPack.runId, reviewPack])
  );
  const projectedRuns = snapshot.runs
    .filter((run) => run.workspaceId === workspaceId)
    .map((run) =>
      projectMissionControlRunToRuntimeTaskSummary({
        run,
        task: taskByMissionId.get(run.taskId) ?? null,
        reviewPack: reviewPackByRunId.get(run.id) ?? null,
      })
    );
  const projectedRunIds = new Set(projectedRuns.map((task) => task.taskId));
  const projectedJobs = jobs
    .filter((job) => job.workspaceId === workspaceId && !projectedRunIds.has(job.id))
    .map(projectKernelJobToRuntimeTaskSummary);
  const projectedTasks = [...projectedRuns, ...projectedJobs]
    .filter((task) => (status ? task.status === status : true))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return projectedTasks.slice(0, limit);
  }
  return projectedTasks;
}

async function readRuntimeTaskTruth(
  workspaceId: string,
  status: RuntimeAgentTaskSummary["status"] | null | undefined,
  limit: number | null | undefined,
  runtime?: Pick<WorkspaceClientRuntimeBindings, "missionControl" | "kernelProjection"> | null
): Promise<RuntimeAgentTaskSummary[]> {
  const projectionTruth = await readKernelProjectionJobsSlice(runtime);
  if (projectionTruth?.missionControl) {
    const projectedTasks = projectRuntimeTaskTruth({
      workspaceId,
      snapshot: projectionTruth.missionControl,
      jobs: projectionTruth.jobs,
      status,
      limit,
    });
    if (projectedTasks.length > 0) {
      return projectedTasks;
    }
  }

  const snapshot = runtime?.missionControl
    ? await runtime.missionControl.readMissionControlSnapshot()
    : ((await getMissionControlSnapshot()) satisfies HugeCodeMissionControlSnapshot);
  const projectedTasks = projectRuntimeTaskTruth({
    workspaceId,
    snapshot,
    status,
    limit,
  });
  return projectedTasks;
}

type CreateRuntimeAgentControlDependenciesOptions = {
  workspaceClientRuntime?: Pick<
    WorkspaceClientRuntimeBindings,
    "missionControl" | "kernelProjection"
  > | null;
};

export function createRuntimeAgentControlDependencies(
  workspaceId: RuntimeWorkspaceId,
  options?: CreateRuntimeAgentControlDependenciesOptions
): RuntimeAgentControlDependencies {
  const workspaceClientRuntime = options?.workspaceClientRuntime ?? null;

  return {
    listTasks: async (input) =>
      readRuntimeTaskTruth(
        input.workspaceId ?? workspaceId,
        input.status ?? null,
        input.limit ?? null,
        workspaceClientRuntime
      ),
    getTaskStatus: async (taskId) =>
      readRuntimeTaskTruth(workspaceId, null, null, workspaceClientRuntime).then(
        (tasks) => tasks.find((task) => task.taskId === taskId) ?? null
      ),
    startTask: async (input) =>
      startRuntimeJobWithRemoteSelection({
        workspaceId: input.workspaceId,
        ...(input.threadId !== undefined ? { threadId: input.threadId } : {}),
        ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.taskSource !== undefined ? { taskSource: input.taskSource } : {}),
        ...(input.executionProfileId !== undefined && input.executionProfileId !== null
          ? { executionProfileId: input.executionProfileId }
          : {}),
        ...(input.reviewProfileId !== undefined && input.reviewProfileId !== null
          ? { reviewProfileId: input.reviewProfileId }
          : {}),
        ...(input.validationPresetId !== undefined && input.validationPresetId !== null
          ? { validationPresetId: input.validationPresetId }
          : {}),
        ...(input.accessMode !== undefined ? { accessMode: input.accessMode } : {}),
        ...(input.executionMode !== undefined ? { executionMode: input.executionMode } : {}),
        ...(input.reasonEffort !== undefined && input.reasonEffort !== null
          ? { reasonEffort: input.reasonEffort }
          : {}),
        ...(input.provider !== undefined && input.provider !== null
          ? { provider: input.provider }
          : {}),
        ...(input.modelId !== undefined && input.modelId !== null
          ? { modelId: input.modelId }
          : {}),
        ...(input.requiredCapabilities !== undefined
          ? { requiredCapabilities: input.requiredCapabilities }
          : {}),
        ...(input.preferredBackendIds !== undefined
          ? { preferredBackendIds: input.preferredBackendIds }
          : {}),
        ...(input.missionBrief !== undefined ? { missionBrief: input.missionBrief } : {}),
        ...(input.relaunchContext !== undefined ? { relaunchContext: input.relaunchContext } : {}),
        ...(input.autoDrive !== undefined ? { autoDrive: input.autoDrive } : {}),
        steps: [
          {
            kind: input.stepKind ?? "read",
            input: input.instruction,
            ...(input.requiresApproval !== undefined
              ? { requiresApproval: input.requiresApproval }
              : {}),
            ...(input.approvalReason !== undefined && input.approvalReason !== null
              ? { approvalReason: input.approvalReason }
              : {}),
          },
        ],
      }).then((job) => ({
        taskId: job.id,
        workspaceId: job.workspaceId,
        threadId: job.threadId ?? null,
        requestId: null,
        title: job.title ?? null,
        status: typeof job.status === "string" ? (job.status as RuntimeAgentTaskStatus) : "queued",
        accessMode: "on-request",
        provider: job.provider ?? null,
        modelId: job.modelId ?? null,
        routedProvider: null,
        routedModelId: null,
        routedPool: null,
        routedSource: null,
        currentStep: null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt ?? null,
        completedAt: job.completedAt ?? null,
        errorCode: null,
        errorMessage: null,
        pendingApprovalId: null,
        backendId: job.backendId ?? null,
        preferredBackendIds: job.preferredBackendIds ?? null,
        steps: [],
      })),
    interruptTask: async (input) =>
      cancelRuntimeJob({
        runId: input.taskId,
        ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      }).then((ack) => ({
        accepted: ack.accepted,
        taskId: ack.runId,
        status: ack.status,
        message: ack.message,
      })),
    interveneTask: async (input) =>
      interveneRuntimeJob({
        runId: input.taskId,
        action: input.action,
        ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
        ...(input.instructionPatch !== undefined && input.instructionPatch !== null
          ? { instructionPatch: input.instructionPatch }
          : {}),
        ...(input.executionProfileId !== undefined && input.executionProfileId !== null
          ? { executionProfileId: input.executionProfileId }
          : {}),
        ...(input.reviewProfileId !== undefined && input.reviewProfileId !== null
          ? { reviewProfileId: input.reviewProfileId }
          : {}),
        ...(input.preferredBackendIds !== undefined
          ? { preferredBackendIds: input.preferredBackendIds }
          : {}),
        ...(input.relaunchContext !== undefined ? { relaunchContext: input.relaunchContext } : {}),
      }).then((ack) => ({
        accepted: ack.accepted,
        action: ack.action,
        taskId: ack.runId,
        status: ack.status ?? "queued",
        outcome: ack.outcome,
        spawnedTaskId: ack.spawnedRunId ?? null,
        checkpointId: ack.checkpointId ?? null,
      })),
    resumeTask: async (input) =>
      resumeRuntimeJob({
        runId: input.taskId,
        ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      }).then((ack) => ({
        accepted: ack.accepted,
        taskId: ack.runId,
        status: ack.status,
        code: ack.code ?? null,
        message: ack.message,
        recovered: ack.recovered ?? null,
        checkpointId: ack.checkpointId ?? null,
        traceId: ack.traceId ?? null,
        updatedAt: ack.updatedAt ?? null,
      })),
    submitTaskApprovalDecision: async (input) =>
      submitRuntimeJobApprovalDecision({
        approvalId: input.approvalId,
        decision: input.decision,
        ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      }).then((ack) => ({
        recorded: ack.recorded,
        approvalId: ack.approvalId,
        taskId: ack.runId,
        status: ack.status,
        message: ack.message,
      })),
    actionRequiredGetV2: async (requestId) => actionRequiredGetV2(requestId),
    actionRequiredSubmitV2: async (input) => actionRequiredSubmitV2(input),
    respondToServerRequest: async (targetWorkspaceId, requestId, decision) =>
      respondToServerRequest(targetWorkspaceId, requestId, decision),
    respondToUserInputRequest: async (targetWorkspaceId, requestId, answers) =>
      respondToUserInputRequest(targetWorkspaceId, requestId, answers),
    respondToServerRequestResult: async (targetWorkspaceId, requestId, result) =>
      respondToServerRequestResult(targetWorkspaceId, requestId, result),
    listLiveSkills: async () => listRuntimeLiveSkills(),
    runLiveSkill: async (request) => runRuntimeLiveSkill(request),
    getGitStatus: async (targetWorkspaceId) => getGitStatus(targetWorkspaceId),
    getGitDiffs: async (targetWorkspaceId) => getGitDiffs(targetWorkspaceId),
    listGitBranches: async (targetWorkspaceId) => listGitBranches(targetWorkspaceId),
    stageGitFile: async (targetWorkspaceId, path) => stageGitFile(targetWorkspaceId, path),
    stageGitAll: async (targetWorkspaceId) => stageGitAll(targetWorkspaceId),
    unstageGitFile: async (targetWorkspaceId, path) => unstageGitFile(targetWorkspaceId, path),
    revertGitFile: async (targetWorkspaceId, path) => revertGitFile(targetWorkspaceId, path),
    commitGit: async (targetWorkspaceId, message) => commitGit(targetWorkspaceId, message),
    createGitBranch: async (targetWorkspaceId, name) => createGitBranch(targetWorkspaceId, name),
    checkoutGitBranch: async (targetWorkspaceId, name) =>
      checkoutGitBranch(targetWorkspaceId, name),
    distributedTaskGraph: async (input) =>
      distributedTaskGraph({
        taskId: typeof input?.taskId === "string" ? input.taskId : undefined,
        limit: typeof input?.limit === "number" ? input.limit : undefined,
        includeDiagnostics:
          typeof input?.includeDiagnostics === "boolean" ? input.includeDiagnostics : undefined,
      }),
    getRuntimeCapabilitiesSummary: async () => getRuntimeCapabilitiesSummary(),
    getRuntimeHealth: async () => getRuntimeHealth(),
    getRuntimeTerminalStatus: async () => getRuntimeTerminalStatus(),
    runtimeToolMetricsRead: async () => runtimeToolMetricsRead(),
    runtimeToolGuardrailRead: async () => runtimeToolGuardrailRead(),
    spawnSubAgentSession: async (input) =>
      spawnSubAgentSession({
        workspaceId: input.workspaceId,
        threadId: input.threadId ?? null,
        title: input.title ?? null,
        accessMode: input.accessMode,
        reasonEffort: input.reasonEffort ?? null,
        provider: input.provider ?? null,
        modelId: input.modelId ?? null,
        scopeProfile: input.scopeProfile ?? null,
        allowedSkillIds: input.allowedSkillIds ?? null,
        allowNetwork: input.allowNetwork ?? null,
        workspaceReadPaths: input.workspaceReadPaths ?? null,
        parentRunId: input.parentRunId ?? null,
      }),
    sendSubAgentInstruction: async (input) =>
      sendSubAgentInstruction({
        sessionId: input.sessionId,
        instruction: input.instruction,
        requestId: input.requestId,
        requiresApproval: input.requiresApproval,
        approvalReason: input.approvalReason ?? null,
      }),
    waitSubAgentSession: async (input) =>
      waitSubAgentSession({
        sessionId: input.sessionId,
        timeoutMs: input.timeoutMs ?? null,
        pollIntervalMs: input.pollIntervalMs ?? null,
      }),
    getSubAgentSessionStatus: async (input) =>
      getSubAgentSessionStatus({ sessionId: input.sessionId }),
    interruptSubAgentSession: async (input) =>
      interruptSubAgentSession({
        sessionId: input.sessionId,
        reason: input.reason ?? null,
      }),
    closeSubAgentSession: async (input) =>
      closeSubAgentSession({
        sessionId: input.sessionId,
        reason: input.reason ?? null,
        force: input.force,
      }),
    runtimeDiscoveryControl: buildRuntimeDiscoveryControl(workspaceId),
  };
}
