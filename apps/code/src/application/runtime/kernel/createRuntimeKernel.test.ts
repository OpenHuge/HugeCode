import { afterEach, describe, expect, it, vi } from "vitest";
import { createRuntimeKernel } from "./createRuntimeKernel";
import { RUNTIME_KERNEL_CAPABILITY_KEYS } from "./runtimeKernelCapabilities";
import { createWorkspaceRuntimeScope } from "./createWorkspaceRuntimeScope";
import type { ConfiguredWebRuntimeGatewayProfile } from "../../../services/runtimeWebGatewayConfig";
import { setConfiguredWebRuntimeGatewayProfile } from "../../../services/runtimeWebGatewayConfig";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeClient: vi.fn(() => {
    throw new Error("createRuntimeKernel should not access getRuntimeClient directly");
  }),
  prepareRuntimeRun: vi.fn(async () => ({
    preparedAt: 1,
  })),
  startRuntimeRun: vi.fn(async (input) => ({
    run: {
      taskId: "run-1",
      workspaceId: input.workspaceId,
      threadId: input.threadId ?? null,
      requestId: input.requestId ?? null,
      title: input.title ?? null,
      status: "queued",
      accessMode: input.accessMode ?? "on-request",
      currentStep: null,
      createdAt: 1,
      updatedAt: 1,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
    },
    missionRun: {} as never,
    reviewPack: null,
  })),
  cancelRuntimeRun: vi.fn(async (input) => ({
    accepted: true,
    runId: input.runId,
    status: "cancelled",
    message: null,
  })),
  resumeRuntimeRun: vi.fn(async (input) => ({
    run: {
      taskId: input.runId,
      workspaceId: "workspace-1",
      threadId: null,
      requestId: null,
      title: null,
      status: "running",
      accessMode: "on-request",
      currentStep: null,
      createdAt: 1,
      updatedAt: 1,
      startedAt: 1,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      checkpointId: null,
      traceId: null,
      recovered: false,
    },
    missionRun: {} as never,
    reviewPack: null,
  })),
  interveneRuntimeRun: vi.fn(async (input) => ({
    run: {
      taskId: input.runId,
      workspaceId: "workspace-1",
      threadId: null,
      requestId: null,
      title: null,
      status: "queued",
      accessMode: "on-request",
      currentStep: null,
      createdAt: 1,
      updatedAt: 1,
      startedAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      pendingApprovalId: null,
      checkpointId: null,
      traceId: null,
      recovered: false,
    },
    missionRun: {} as never,
    reviewPack: null,
  })),
  submitRuntimeJobApprovalDecision: vi.fn(async (input) => ({
    recorded: true,
    approvalId: input.approvalId,
    runId: "run-1",
    status: "approved",
    message: null,
  })),
  listThreads: vi.fn(async () => [{ id: "thread-1" }]),
  createThread: vi.fn(async (input) => ({ id: "thread-new", ...input })),
  resumeThread: vi.fn(async (workspaceId, threadId) => ({ id: threadId, workspaceId })),
  archiveThread: vi.fn(async () => true),
  getGitStatus: vi.fn(async () => ({ branchName: "main", files: [] })),
  readGitDiff: vi.fn(async () => ({ path: "src/a.ts", diff: "diff" })),
  listGitBranches: vi.fn(async () => ({
    currentBranch: "main",
    branches: [{ name: "main", lastUsedAt: 1 }],
  })),
  createGitBranch: vi.fn(async () => undefined),
  checkoutGitBranch: vi.fn(async () => undefined),
  getGitLog: vi.fn(async () => ({ commits: [] })),
  stageGitFile: vi.fn(async () => undefined),
  stageGitAll: vi.fn(async () => undefined),
  unstageGitFile: vi.fn(async () => undefined),
  revertGitFile: vi.fn(async () => undefined),
  commitGit: vi.fn(async () => undefined),
  listWorkspaceFileEntries: vi.fn(async () => [{ id: "file-1", path: "src/a.ts" }]),
  readWorkspaceFile: vi.fn(async () => ({ content: "hello", truncated: false })),
  runRuntimeLiveSkill: vi.fn(async () => ({
    runId: "skill-run-1",
    skillId: "review-agent",
    output: "done",
    metadata: {},
  })),
  listRuntimeExtensionTools: vi.fn(async () => []),
  invokeRuntimeExtensionTool: vi.fn(async () => ({ ok: true })),
  listRuntimePrompts: vi.fn(async () => []),
}));

vi.mock("../ports/runtimeClient", () => ({
  detectRuntimeMode: vi.fn(() => "runtime-gateway-web"),
  getRuntimeClient: runtimeMocks.getRuntimeClient,
  readRuntimeCapabilitiesSummary: vi.fn(async () => ({})),
}));

vi.mock("../ports/runtimeWebGatewayConfig", async () => {
  const actual = await vi.importActual<typeof import("../ports/runtimeWebGatewayConfig")>(
    "../ports/runtimeWebGatewayConfig"
  );
  return {
    ...actual,
    discoverLocalRuntimeGatewayTargets: vi.fn(async () => []),
  };
});

vi.mock("../ports/missionControl", () => ({
  getMissionControlSnapshot: vi.fn(async () => ({
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
  })),
}));

vi.mock("../ports/desktopAppSettings", () => ({
  getAppSettings: vi.fn(async () => ({})),
  updateAppSettings: vi.fn(async () => ({})),
  syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
}));

vi.mock("../ports/oauth", () => ({
  applyOAuthPool: vi.fn(),
  bindOAuthPoolAccount: vi.fn(),
  getAccountInfo: vi.fn(),
  getOAuthPrimaryAccount: vi.fn(),
  getProvidersCatalog: vi.fn(),
  listOAuthAccounts: vi.fn(),
  listOAuthPoolMembers: vi.fn(),
  listOAuthPools: vi.fn(),
  runCodexLogin: vi.fn(),
  setOAuthPrimaryAccount: vi.fn(),
}));

vi.mock("../ports/models", () => ({
  getConfigModel: vi.fn(),
  getModelList: vi.fn(),
}));

vi.mock("../ports/workspaceCatalog", () => ({
  listWorkspaces: vi.fn(async () => []),
}));

vi.mock("../ports/runtimeUpdatedEvents", () => ({
  subscribeScopedRuntimeUpdatedEvents: vi.fn(() => () => undefined),
}));

vi.mock("../ports/runtimeJobs", () => ({
  prepareRuntimeRunV2: runtimeMocks.prepareRuntimeRun,
  startRuntimeRunV2: runtimeMocks.startRuntimeRun,
  cancelRuntimeRun: runtimeMocks.cancelRuntimeRun,
  resumeRuntimeRun: runtimeMocks.resumeRuntimeRun,
  interveneRuntimeRun: runtimeMocks.interveneRuntimeRun,
  submitRuntimeJobApprovalDecision: runtimeMocks.submitRuntimeJobApprovalDecision,
}));

vi.mock("../ports/runtimeThreads", () => ({
  listRuntimeThreads: runtimeMocks.listThreads,
  createRuntimeThread: runtimeMocks.createThread,
  resumeRuntimeThread: runtimeMocks.resumeThread,
  archiveRuntimeThread: runtimeMocks.archiveThread,
}));

vi.mock("../ports/runtimeGit", () => ({
  listRuntimeGitChanges: runtimeMocks.getGitStatus,
  readRuntimeGitDiff: runtimeMocks.readGitDiff,
  listRuntimeGitBranches: runtimeMocks.listGitBranches,
  createRuntimeGitBranch: runtimeMocks.createGitBranch,
  checkoutRuntimeGitBranch: runtimeMocks.checkoutGitBranch,
  readRuntimeGitLog: runtimeMocks.getGitLog,
  stageRuntimeGitChange: runtimeMocks.stageGitFile,
  stageAllRuntimeGitChanges: runtimeMocks.stageGitAll,
  unstageRuntimeGitChange: runtimeMocks.unstageGitFile,
  revertRuntimeGitChange: runtimeMocks.revertGitFile,
  commitRuntimeGit: runtimeMocks.commitGit,
}));

vi.mock("../ports/runtimeWorkspaceFiles", () => ({
  listRuntimeWorkspaceFileEntries: runtimeMocks.listWorkspaceFileEntries,
  readRuntimeWorkspaceFile: runtimeMocks.readWorkspaceFile,
}));

vi.mock("../ports/runtime", () => ({
  runRuntimeLiveSkill: runtimeMocks.runRuntimeLiveSkill,
}));

vi.mock("../ports/runtimeExtensions", () => ({
  listRuntimeExtensionTools: runtimeMocks.listRuntimeExtensionTools,
  invokeRuntimeExtensionTool: runtimeMocks.invokeRuntimeExtensionTool,
}));

vi.mock("../ports/runtimePrompts", () => ({
  listRuntimePrompts: runtimeMocks.listRuntimePrompts,
}));

vi.mock("./createWorkspaceRuntimeScope", () => ({
  createWorkspaceRuntimeScope: vi.fn(),
}));

vi.mock("./createRuntimeAgentControlDependencies", () => ({
  createRuntimeAgentControlDependencies: vi.fn(),
}));

describe("createRuntimeKernel", () => {
  afterEach(() => {
    vi.clearAllMocks();
    setConfiguredWebRuntimeGatewayProfile(null);
  });

  it("notifies runtime mode subscribers when configured gateway profile changes", () => {
    const kernel = createRuntimeKernel();
    const listener = vi.fn();
    const unsubscribe = kernel.workspaceClientRuntimeGateway.subscribeRuntimeMode(listener);

    setConfiguredWebRuntimeGatewayProfile({
      httpBaseUrl: "https://runtime.example.com/rpc",
      wsBaseUrl: "wss://runtime.example.com/ws",
      authToken: null,
      enabled: true,
    } satisfies ConfiguredWebRuntimeGatewayProfile);

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setConfiguredWebRuntimeGatewayProfile(null);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("assembles workspace client runtime bindings from narrow runtime ports", async () => {
    const kernel = createRuntimeKernel();

    await expect(
      kernel.workspaceClientRuntime.agentControl.prepareRuntimeRun({
        workspaceId: "workspace-1",
        steps: [],
      })
    ).resolves.toMatchObject({ preparedAt: 1 });
    await expect(
      kernel.workspaceClientRuntime.agentControl.startRuntimeRun({
        workspaceId: "workspace-1",
        steps: [],
      })
    ).resolves.toMatchObject({ run: { taskId: "run-1" } });
    await expect(
      kernel.workspaceClientRuntime.agentControl.cancelRuntimeRun({ runId: "run-1" })
    ).resolves.toMatchObject({ runId: "run-1", accepted: true });
    await expect(
      kernel.workspaceClientRuntime.agentControl.resumeRuntimeRun({ runId: "run-1" })
    ).resolves.toMatchObject({ run: { taskId: "run-1" } });
    await expect(
      kernel.workspaceClientRuntime.agentControl.interveneRuntimeRun({
        runId: "run-1",
        action: "retry",
      })
    ).resolves.toMatchObject({ run: { taskId: "run-1" } });
    await expect(
      kernel.workspaceClientRuntime.agentControl.submitRuntimeJobApprovalDecision({
        runId: "run-1",
        approvalId: "approval-1",
        decision: "approved",
      })
    ).resolves.toMatchObject({ approvalId: "approval-1", recorded: true });

    await expect(
      kernel.workspaceClientRuntime.threads.listThreads({ workspaceId: "workspace-1" })
    ).resolves.toEqual([{ id: "thread-1" }]);
    await expect(
      kernel.workspaceClientRuntime.threads.createThread({
        workspaceId: "workspace-1",
        title: "New thread",
      })
    ).resolves.toMatchObject({ id: "thread-new" });
    await expect(
      kernel.workspaceClientRuntime.threads.resumeThread({
        workspaceId: "workspace-1",
        threadId: "thread-1",
      })
    ).resolves.toMatchObject({ id: "thread-1" });
    await expect(
      kernel.workspaceClientRuntime.threads.archiveThread({
        workspaceId: "workspace-1",
        threadId: "thread-1",
      })
    ).resolves.toBe(true);

    await expect(
      kernel.workspaceClientRuntime.git.listChanges({ workspaceId: "workspace-1" })
    ).resolves.toMatchObject({ branchName: "main" });
    await expect(
      kernel.workspaceClientRuntime.git.readDiff({
        workspaceId: "workspace-1",
        changeId: "src/a.ts",
      })
    ).resolves.toMatchObject({ path: "src/a.ts", diff: "diff" });
    await expect(
      kernel.workspaceClientRuntime.git.listBranches({ workspaceId: "workspace-1" })
    ).resolves.toMatchObject({ currentBranch: "main" });
    await expect(
      kernel.workspaceClientRuntime.git.createBranch({
        workspaceId: "workspace-1",
        branchName: "feature/x",
      })
    ).resolves.toBeUndefined();
    await expect(
      kernel.workspaceClientRuntime.git.checkoutBranch({
        workspaceId: "workspace-1",
        branchName: "main",
      })
    ).resolves.toBeUndefined();
    await expect(
      kernel.workspaceClientRuntime.git.readLog({ workspaceId: "workspace-1" })
    ).resolves.toMatchObject({ commits: [] });
    await expect(
      kernel.workspaceClientRuntime.git.stageChange({
        workspaceId: "workspace-1",
        changeId: "src/a.ts",
      })
    ).resolves.toBeUndefined();
    await expect(
      kernel.workspaceClientRuntime.git.stageAll({ workspaceId: "workspace-1" })
    ).resolves.toBeUndefined();
    await expect(
      kernel.workspaceClientRuntime.git.unstageChange({
        workspaceId: "workspace-1",
        changeId: "src/a.ts",
      })
    ).resolves.toBeUndefined();
    await expect(
      kernel.workspaceClientRuntime.git.revertChange({
        workspaceId: "workspace-1",
        changeId: "src/a.ts",
      })
    ).resolves.toBeUndefined();
    await expect(
      kernel.workspaceClientRuntime.git.commit({
        workspaceId: "workspace-1",
        message: "commit",
      })
    ).resolves.toBeUndefined();

    await expect(
      kernel.workspaceClientRuntime.workspaceFiles.listWorkspaceFileEntries({
        workspaceId: "workspace-1",
      })
    ).resolves.toEqual([{ id: "file-1", path: "src/a.ts" }]);
    await expect(
      kernel.workspaceClientRuntime.workspaceFiles.readWorkspaceFile({
        workspaceId: "workspace-1",
        fileId: "src/a.ts",
      })
    ).resolves.toMatchObject({ content: "hello" });

    expect(runtimeMocks.getRuntimeClient).not.toHaveBeenCalled();
    expect(runtimeMocks.prepareRuntimeRun).toHaveBeenCalledOnce();
    expect(runtimeMocks.startRuntimeRun).toHaveBeenCalledOnce();
    expect(runtimeMocks.listThreads).toHaveBeenCalledOnce();
    expect(runtimeMocks.getGitStatus).toHaveBeenCalledOnce();
    expect(runtimeMocks.listWorkspaceFileEntries).toHaveBeenCalledOnce();
  });

  it("wires the invocation execute capability into each workspace scope", () => {
    vi.mocked(createWorkspaceRuntimeScope).mockReturnValue({
      getCapability: vi.fn(),
    } as never);
    const kernel = createRuntimeKernel();
    kernel.getWorkspaceScope("workspace-1");

    expect(createWorkspaceRuntimeScope).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        capabilityProviders: expect.arrayContaining([
          expect.objectContaining({
            key: RUNTIME_KERNEL_CAPABILITY_KEYS.invocationExecute,
          }),
          expect.objectContaining({
            key: RUNTIME_KERNEL_CAPABILITY_KEYS.invocationPlane,
          }),
        ]),
      })
    );
  });
});
