import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { KernelProjectionBootstrapResponse } from "@ku0/code-runtime-host-contract";
import {
  createRuntimeAgentControlFacade,
  type RuntimeAgentControlDependencies,
} from "./runtimeAgentControlFacade";
import type { WorkspaceClientRuntimeBindings } from "@ku0/code-workspace-client";
import { getMissionControlSnapshot } from "../ports/tauriMissionControl";
import {
  cancelRuntimeJob,
  submitRuntimeJobApprovalDecision,
  getRuntimeJob,
  interveneRuntimeJob,
  listRuntimeJobs,
  resumeRuntimeJob,
} from "../ports/tauriRuntimeJobs";
import { startRuntimeJobWithRemoteSelection } from "./runtimeRemoteExecutionFacade";
import { createRuntimeAgentControlDependencies } from "../kernel/createRuntimeAgentControlDependencies";

vi.mock("./runtimeRemoteExecutionFacade", () => ({
  startRuntimeJobWithRemoteSelection: vi.fn(),
}));

vi.mock("../ports/tauriMissionControl", () => ({
  getMissionControlSnapshot: vi.fn(),
}));

vi.mock("../ports/tauriRuntimeJobs", () => ({
  cancelRuntimeJob: vi.fn(),
  submitRuntimeJobApprovalDecision: vi.fn(),
  getRuntimeJob: vi.fn(),
  interveneRuntimeJob: vi.fn(),
  listRuntimeJobs: vi.fn(),
  resumeRuntimeJob: vi.fn(),
}));

const startRuntimeJobWithRemoteSelectionMock = vi.mocked(startRuntimeJobWithRemoteSelection);
const getMissionControlSnapshotMock = vi.mocked(getMissionControlSnapshot);
const cancelRuntimeJobMock = vi.mocked(cancelRuntimeJob);
const submitRuntimeJobApprovalDecisionMock = vi.mocked(submitRuntimeJobApprovalDecision);
const getRuntimeJobMock = vi.mocked(getRuntimeJob);
const interveneRuntimeJobMock = vi.mocked(interveneRuntimeJob);
const listRuntimeJobsMock = vi.mocked(listRuntimeJobs);
const resumeRuntimeJobMock = vi.mocked(resumeRuntimeJob);

function createProjectionBootstrapResponse(
  overrides?: Partial<KernelProjectionBootstrapResponse>
): KernelProjectionBootstrapResponse {
  return {
    revision: 1,
    sliceRevisions: {
      mission_control: 1,
      jobs: 1,
    },
    slices: {
      mission_control: {
        source: "runtime_snapshot_v1",
        generatedAt: 1,
        workspaces: [],
        tasks: [],
        runs: [],
        reviewPacks: [],
      },
      jobs: [],
    },
    ...overrides,
  };
}

function createWorkspaceClientRuntimeBindings(
  bootstrap: KernelProjectionBootstrapResponse
): WorkspaceClientRuntimeBindings {
  return {
    surface: "shared-workspace-client",
    settings: {
      getAppSettings: vi.fn(async () => ({})),
      updateAppSettings: vi.fn(async () => ({})),
      syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
    },
    oauth: {
      listAccounts: vi.fn(async () => []),
      listPools: vi.fn(async () => []),
      listPoolMembers: vi.fn(async () => []),
      getPrimaryAccount: vi.fn(async () => null),
      setPrimaryAccount: vi.fn(async () => null),
      applyPool: vi.fn(async () => null),
      bindPoolAccount: vi.fn(async () => null),
      runLogin: vi.fn(async () => null),
      getAccountInfo: vi.fn(async () => null),
      getProvidersCatalog: vi.fn(async () => []),
    },
    models: {
      getModelList: vi.fn(async () => []),
      getConfigModel: vi.fn(async () => null),
    },
    workspaceCatalog: {
      listWorkspaces: vi.fn(async () => []),
    },
    missionControl: {
      readMissionControlSnapshot: vi.fn(async () => bootstrap.slices.mission_control as never),
    },
    kernelProjection: {
      bootstrap: vi.fn(async () => bootstrap),
      subscribe: vi.fn(() => () => undefined),
    },
    runtimeUpdated: {
      subscribeScopedRuntimeUpdatedEvents: vi.fn(() => () => undefined),
    },
    agentControl: {
      startRuntimeJob: vi.fn(async () => null),
      cancelRuntimeJob: vi.fn(async () => null),
      resumeRuntimeJob: vi.fn(async () => null),
      interveneRuntimeJob: vi.fn(async () => null),
      subscribeRuntimeJob: vi.fn(async () => null),
      listRuntimeJobs: vi.fn(async () => []),
      submitRuntimeJobApprovalDecision: vi.fn(async () => null),
    },
    threads: {
      listThreads: vi.fn(async () => []),
      createThread: vi.fn(async () => null),
      resumeThread: vi.fn(async () => null),
      archiveThread: vi.fn(async () => false),
    },
    git: {
      listChanges: vi.fn(async () => ({ files: [] })),
      readDiff: vi.fn(async () => ({ diff: "" })),
      listBranches: vi.fn(async () => ({ currentBranch: null, branches: [] })),
      createBranch: vi.fn(async () => undefined),
      checkoutBranch: vi.fn(async () => undefined),
      readLog: vi.fn(async () => ({ commits: [] })),
      stageChange: vi.fn(async () => undefined),
      stageAll: vi.fn(async () => undefined),
      unstageChange: vi.fn(async () => undefined),
      revertChange: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
    },
    workspaceFiles: {
      listWorkspaceFileEntries: vi.fn(async () => []),
      readWorkspaceFile: vi.fn(async () => null),
    },
    review: {
      listReviewPacks: vi.fn(async () => []),
    },
  } as unknown as WorkspaceClientRuntimeBindings;
}

function createDeps(): RuntimeAgentControlDependencies {
  return {
    listTasks: vi.fn(),
    getTaskStatus: vi.fn(),
    startTask: vi.fn(),
    interruptTask: vi.fn(),
    interveneTask: vi.fn(),
    resumeTask: vi.fn(),
    submitTaskApprovalDecision: vi.fn(),
    actionRequiredGetV2: vi.fn(),
    actionRequiredSubmitV2: vi.fn(),
    respondToServerRequest: vi.fn(),
    respondToUserInputRequest: vi.fn(),
    respondToServerRequestResult: vi.fn(),
    listLiveSkills: vi.fn(),
    runLiveSkill: vi.fn(),
    getGitStatus: vi.fn(),
    getGitDiffs: vi.fn(),
    listGitBranches: vi.fn(),
    stageGitFile: vi.fn(),
    stageGitAll: vi.fn(),
    unstageGitFile: vi.fn(),
    revertGitFile: vi.fn(),
    commitGit: vi.fn(),
    createGitBranch: vi.fn(),
    checkoutGitBranch: vi.fn(),
    distributedTaskGraph: vi.fn(),
    getRuntimeCapabilitiesSummary: vi.fn(),
    getRuntimeHealth: vi.fn(),
    getRuntimeTerminalStatus: vi.fn(),
    runtimeToolMetricsRead: vi.fn(),
    runtimeToolGuardrailRead: vi.fn(),
    spawnSubAgentSession: vi.fn(),
    sendSubAgentInstruction: vi.fn(),
    waitSubAgentSession: vi.fn(),
    getSubAgentSessionStatus: vi.fn(),
    interruptSubAgentSession: vi.fn(),
    closeSubAgentSession: vi.fn(),
    runtimeDiscoveryControl: {} as never,
  };
}

describe("runtimeAgentControlFacade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the facade thin and forwards startTask input to injected dependencies", async () => {
    const deps = createDeps();
    const startTaskMock = deps.startTask as Mock;
    startTaskMock.mockResolvedValue({
      taskId: "task-1",
    } as never);

    const facade = createRuntimeAgentControlFacade("ws-1", deps);
    const input = {
      workspaceId: "ws-1",
      title: "Delegate issue #42",
      instruction: "Resolve the linked GitHub issue.",
      reviewProfileId: "issue-review",
      validationPresetId: "review-first",
      accessMode: "on-request",
      executionMode: "single",
    } as never;

    await facade.startTask(input);

    expect(deps.startTask).toHaveBeenCalledWith(input);
  });

  it("normalizes startTask launch payloads in kernel-owned dependencies", async () => {
    startRuntimeJobWithRemoteSelectionMock.mockResolvedValue({
      taskId: "task-1",
    } as never);

    const deps = createRuntimeAgentControlDependencies("ws-1");
    await deps.startTask({
      workspaceId: "ws-1",
      title: "Delegate issue #42",
      instruction: "Resolve the linked GitHub issue.",
      reviewProfileId: "issue-review",
      validationPresetId: "review-first",
      accessMode: "on-request",
      executionMode: "single",
      taskSource: {
        kind: "github_issue",
        label: "GitHub issue #42",
        title: "Delegate issue #42",
        externalId: "openai/hugecode#42",
        canonicalUrl: "https://github.com/openai/hugecode/issues/42",
        sourceTaskId: "issue-42",
        sourceRunId: "run-42",
      },
    } as never);

    expect(startRuntimeJobWithRemoteSelectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        reviewProfileId: "issue-review",
        validationPresetId: "review-first",
        taskSource: expect.objectContaining({
          kind: "github_issue",
          externalId: "openai/hugecode#42",
        }),
        steps: [
          expect.objectContaining({
            kind: "read",
            input: "Resolve the linked GitHub issue.",
          }),
        ],
      })
    );
  });

  it("reads rich task truth from mission-control projection instead of the legacy run list", async () => {
    getMissionControlSnapshotMock.mockResolvedValue({
      source: "runtime_snapshot_v1",
      generatedAt: 1,
      workspaces: [],
      tasks: [
        {
          id: "runtime-task:run-1",
          workspaceId: "ws-1",
          title: "Projection-backed task",
          objective: "Projection-backed task",
          origin: {
            kind: "run",
            threadId: null,
            runId: "run-1",
            requestId: null,
          },
          taskSource: null,
          mode: null,
          modeSource: "missing",
          status: "running",
          createdAt: 1,
          updatedAt: 1,
          currentRunId: "run-1",
          latestRunId: "run-1",
          latestRunState: "running",
          nextAction: null,
          lineage: null,
          accountability: null,
          executionGraph: null,
        },
      ],
      runs: [
        {
          id: "run-1",
          taskId: "runtime-task:run-1",
          workspaceId: "ws-1",
          state: "running",
          title: "Projection-backed task",
          summary: null,
          taskSource: null,
          startedAt: 1,
          finishedAt: null,
          updatedAt: 1,
          currentStepIndex: 0,
          pendingIntervention: null,
          executionProfile: null,
          reviewProfileId: null,
          profileReadiness: null,
          routing: null,
          approval: null,
          reviewDecision: null,
          intervention: null,
          operatorState: null,
          nextAction: null,
          warnings: [],
          validations: [],
          artifacts: [],
          changedPaths: [],
          autoDrive: null,
          completionReason: null,
          reviewPackId: null,
          lineage: null,
          ledger: null,
          checkpoint: null,
          missionLinkage: null,
          actionability: null,
          reviewGate: null,
          reviewFindings: null,
          reviewRunId: null,
          skillUsage: null,
          autofixCandidate: null,
          governance: null,
          placement: null,
          operatorSnapshot: null,
          workspaceEvidence: null,
          missionBrief: null,
          relaunchContext: null,
          subAgents: [],
          publishHandoff: null,
          takeoverBundle: null,
          executionGraph: null,
        },
      ],
      reviewPacks: [],
    });

    const deps = createRuntimeAgentControlDependencies("ws-1");
    await deps.listTasks({ workspaceId: "ws-1", status: null, limit: 50 } as never);

    expect(getMissionControlSnapshotMock).toHaveBeenCalledOnce();
    expect(listRuntimeJobsMock).not.toHaveBeenCalled();
    expect(getRuntimeJobMock).not.toHaveBeenCalled();
  });

  it("prefers kernel projection job truth before legacy runtime job listing", async () => {
    const workspaceClientRuntime = createWorkspaceClientRuntimeBindings(
      createProjectionBootstrapResponse({
        slices: {
          mission_control: {
            source: "runtime_snapshot_v1",
            generatedAt: 1,
            workspaces: [],
            tasks: [],
            runs: [],
            reviewPacks: [],
          },
          jobs: [
            {
              id: "job-1",
              workspaceId: "ws-1",
              threadId: "thread-1",
              title: "Projection job",
              status: "running",
              provider: "openai",
              modelId: "gpt-5.4",
              createdAt: 10,
              updatedAt: 20,
              startedAt: 15,
              completedAt: null,
              backendId: "backend-a",
              preferredBackendIds: ["backend-a"],
            },
          ],
        },
      })
    );

    const deps = createRuntimeAgentControlDependencies("ws-1", {
      workspaceClientRuntime,
    });
    const tasks = await deps.listTasks({ workspaceId: "ws-1", status: null, limit: 50 } as never);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskId: "job-1",
      threadId: "thread-1",
      title: "Projection job",
      status: "running",
      backendId: "backend-a",
      preferredBackendIds: ["backend-a"],
    });
    expect(workspaceClientRuntime.kernelProjection?.bootstrap).toHaveBeenCalledWith({
      scopes: ["mission_control", "jobs"],
    });
    expect(listRuntimeJobsMock).not.toHaveBeenCalled();
    expect(getMissionControlSnapshotMock).not.toHaveBeenCalled();
  });

  it("uses projection-backed job truth for getTaskStatus before legacy kernel job get", async () => {
    const workspaceClientRuntime = createWorkspaceClientRuntimeBindings(
      createProjectionBootstrapResponse({
        slices: {
          mission_control: {
            source: "runtime_snapshot_v1",
            generatedAt: 1,
            workspaces: [],
            tasks: [],
            runs: [],
            reviewPacks: [],
          },
          jobs: [
            {
              id: "job-2",
              workspaceId: "ws-1",
              title: "Projection status",
              status: "paused",
              provider: "openai",
              modelId: "gpt-5.4",
              createdAt: 10,
              updatedAt: 30,
              startedAt: 15,
              completedAt: null,
              backendId: "backend-a",
              preferredBackendIds: ["backend-a"],
            },
          ],
        },
      })
    );

    const deps = createRuntimeAgentControlDependencies("ws-1", {
      workspaceClientRuntime,
    });
    const task = await deps.getTaskStatus("job-2");

    expect(task).toMatchObject({
      taskId: "job-2",
      title: "Projection status",
      status: "paused",
    });
    expect(getRuntimeJobMock).not.toHaveBeenCalled();
  });

  it("routes control-plane mutations through kernel jobs v3 ports", async () => {
    cancelRuntimeJobMock.mockResolvedValue({
      accepted: true,
      runId: "job-1",
      status: "cancelled",
      message: null,
    } as never);
    interveneRuntimeJobMock.mockResolvedValue({
      accepted: true,
      action: "retry",
      runId: "job-1",
      status: "queued",
      outcome: "submitted",
      spawnedRunId: null,
      checkpointId: null,
    } as never);
    resumeRuntimeJobMock.mockResolvedValue({
      accepted: true,
      runId: "job-1",
      status: "running",
      code: null,
      message: null,
      recovered: false,
      checkpointId: null,
      traceId: null,
      updatedAt: 1,
    } as never);
    submitRuntimeJobApprovalDecisionMock.mockResolvedValue({
      recorded: true,
      approvalId: "approval-1",
      runId: "job-1",
      status: "approved",
      message: null,
    } as never);

    const deps = createRuntimeAgentControlDependencies("ws-1");
    await deps.interruptTask({ taskId: "job-1", reason: "Stop" } as never);
    expect(deps.interveneTask).toBeDefined();
    expect(deps.resumeTask).toBeDefined();
    await deps.interveneTask!({ taskId: "job-1", action: "retry" } as never);
    await deps.resumeTask!({ taskId: "job-1", reason: "Retry" } as never);
    await deps.submitTaskApprovalDecision({
      approvalId: "approval-1",
      decision: "approved",
    } as never);

    expect(cancelRuntimeJobMock).toHaveBeenCalledWith({ runId: "job-1", reason: "Stop" });
    expect(interveneRuntimeJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "job-1", action: "retry" })
    );
    expect(resumeRuntimeJobMock).toHaveBeenCalledWith({ runId: "job-1", reason: "Retry" });
    expect(submitRuntimeJobApprovalDecisionMock).toHaveBeenCalledWith({
      approvalId: "approval-1",
      decision: "approved",
    });
  });
});
