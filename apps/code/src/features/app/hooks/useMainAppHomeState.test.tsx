// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { WorkspaceClientRuntimeMode } from "@ku0/code-workspace-client";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RuntimeKernelProvider } from "../../../application/runtime/kernel/RuntimeKernelContext";
import type { RuntimeKernel } from "../../../application/runtime/kernel/runtimeKernelTypes";
import type { RuntimeClientMode } from "../../../application/runtime/ports/runtimeClient";
import { getRuntimeCapabilitiesSummary } from "../../../application/runtime/ports/tauriRuntime";
import type { TurnPlan, WorkspaceInfo } from "../../../types";
import { useLocalUsage } from "../../home/hooks/useLocalUsage";
import type { ThreadStatusSummary } from "../../threads/utils/threadExecutionState";
import { useMainAppHomeState } from "./useMainAppHomeState";

vi.mock("../../../application/runtime/ports/tauriRuntime", () => ({
  getRuntimeCapabilitiesSummary: vi.fn(),
}));
vi.mock("../../home/hooks/useLocalUsage", () => ({
  useLocalUsage: vi.fn(),
}));

const mockedGetRuntimeCapabilitiesSummary = vi.mocked(getRuntimeCapabilitiesSummary);
const mockedUseLocalUsage = vi.mocked(useLocalUsage);

function createRuntimeKernelValue(input?: {
  missionControlSnapshot?: HugeCodeMissionControlSnapshot;
  missionControlError?: Error;
}): RuntimeKernel {
  const readMissionControlSnapshot = input?.missionControlError
    ? vi.fn().mockRejectedValue(input.missionControlError)
    : vi.fn().mockResolvedValue(input?.missionControlSnapshot ?? createMissionControlSnapshot());

  return {
    runtimeGateway: {
      detectMode: vi.fn<() => RuntimeClientMode>(() => "runtime-gateway-web"),
      discoverLocalTargets: vi.fn(),
      configureManualWebTarget: vi.fn(),
      readCapabilitiesSummary: vi.fn(),
      readMissionControlSnapshot: vi.fn(),
    },
    workspaceClientRuntimeGateway: {
      readRuntimeMode: vi.fn<() => WorkspaceClientRuntimeMode>(() => "connected"),
      subscribeRuntimeMode: vi.fn(() => vi.fn()),
      discoverLocalRuntimeGatewayTargets: vi.fn(),
      configureManualWebRuntimeGatewayTarget: vi.fn(),
    },
    workspaceClientRuntime: {
      surface: "shared-workspace-client",
      settings: {
        getAppSettings: vi.fn(),
        updateAppSettings: vi.fn(),
        syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
      },
      oauth: {
        listAccounts: vi.fn(),
        listPools: vi.fn(),
        listPoolMembers: vi.fn(),
        getPrimaryAccount: vi.fn(),
        setPrimaryAccount: vi.fn(),
        applyPool: vi.fn(),
        bindPoolAccount: vi.fn(),
        runLogin: vi.fn(),
        getAccountInfo: vi.fn(),
        getProvidersCatalog: vi.fn(),
      },
      models: {
        getModelList: vi.fn(),
        getConfigModel: vi.fn(),
      },
      workspaceCatalog: {
        listWorkspaces: vi.fn(),
      },
      missionControl: {
        readMissionControlSnapshot,
      },
      agentControl: {
        prepareRuntimeRun: vi.fn(),
        startRuntimeRun: vi.fn(),
        cancelRuntimeRun: vi.fn(),
        resumeRuntimeRun: vi.fn(),
        interveneRuntimeRun: vi.fn(),
        submitRuntimeJobApprovalDecision: vi.fn(),
      },
      threads: {
        listThreads: vi.fn(),
        createThread: vi.fn(),
        resumeThread: vi.fn(),
        archiveThread: vi.fn(),
      },
      git: {
        listChanges: vi.fn(),
        readDiff: vi.fn(),
        listBranches: vi.fn(),
        createBranch: vi.fn(),
        checkoutBranch: vi.fn(),
        readLog: vi.fn(),
        stageChange: vi.fn(),
        stageAll: vi.fn(),
        unstageChange: vi.fn(),
        revertChange: vi.fn(),
        commit: vi.fn(),
      },
      workspaceFiles: {
        listWorkspaceFileEntries: vi.fn(),
        readWorkspaceFile: vi.fn(),
      },
      review: {
        listReviewPacks: vi.fn(),
      },
    },
    desktopHost: {
      getAppSettings: vi.fn(),
      isMobileRuntime: vi.fn(),
      updateAppSettings: vi.fn(),
      orbitConnectTest: vi.fn(),
      orbitSignInStart: vi.fn(),
      orbitSignInPoll: vi.fn(),
      orbitSignOut: vi.fn(),
      orbitRunnerStart: vi.fn(),
      orbitRunnerStop: vi.fn(),
      orbitRunnerStatus: vi.fn(),
      tailscaleStatus: vi.fn(),
      tailscaleDaemonCommandPreview: vi.fn(),
      tailscaleDaemonStart: vi.fn(),
      tailscaleDaemonStop: vi.fn(),
      tailscaleDaemonStatus: vi.fn(),
    },
    getWorkspaceScope: vi.fn(),
  };
}

function createWrapper(kernel = createRuntimeKernelValue()) {
  return function RuntimeKernelTestWrapper({ children }: { children: ReactNode }) {
    return <RuntimeKernelProvider value={kernel}>{children}</RuntimeKernelProvider>;
  };
}

function createWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: "ws-1",
    name: "Workspace One",
    path: "/tmp/workspace-one",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
    ...overrides,
  };
}

function createMissionControlSnapshot(
  overrides: Partial<HugeCodeMissionControlSnapshot> = {}
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1" as const,
    generatedAt: 1,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
    ...overrides,
  };
}

function createParams(
  overrides: {
    activeWorkspaceId?: string | null;
    activeThreadId?: string | null;
    hasWorkspaceRouteSelection?: boolean;
    showMissionHomeRoute?: boolean;
    planByThread?: Record<string, TurnPlan | null>;
    startingDraftThreadWorkspaceId?: string | null;
    hasPendingDraftUserMessages?: boolean;
    workspaces?: WorkspaceInfo[];
    workspacesById?: Map<string, WorkspaceInfo>;
    threadsByWorkspace?: Record<string, { id: string; name: string; updatedAt: number }[]>;
    lastAgentMessageByThread?: Record<string, { text: string; timestamp: number } | undefined>;
    threadStatusById?: Record<string, ThreadStatusSummary | undefined>;
  } = {}
) {
  const workspace = overrides.workspaces?.[0] ?? createWorkspace();
  const workspaces = overrides.workspaces ?? [workspace];
  const activeWorkspaceId = Object.hasOwn(overrides, "activeWorkspaceId")
    ? (overrides.activeWorkspaceId ?? null)
    : workspace.id;
  const activeThreadId = Object.hasOwn(overrides, "activeThreadId")
    ? (overrides.activeThreadId ?? null)
    : "thread-1";
  return {
    activeWorkspace: activeWorkspaceId
      ? (workspaces.find((item) => item.id === activeWorkspaceId) ?? null)
      : null,
    activeWorkspaceId,
    activeThreadId,
    hasWorkspaceRouteSelection: overrides.hasWorkspaceRouteSelection ?? Boolean(activeWorkspaceId),
    showMissionHomeRoute: overrides.showMissionHomeRoute ?? false,
    startingDraftThreadWorkspaceId: overrides.startingDraftThreadWorkspaceId ?? null,
    hasPendingDraftUserMessages: overrides.hasPendingDraftUserMessages ?? false,
    hasLoaded: true,
    isCompact: false,
    isNewAgentDraftMode: false,
    activeTab: "missions" as const,
    centerMode: "chat" as const,
    getWorkspaceGroupName: () => null,
    workspaces,
    workspacesById:
      overrides.workspacesById ?? new Map(workspaces.map((item) => [item.id, item] as const)),
    threadsByWorkspace:
      overrides.threadsByWorkspace ??
      (workspaces.length > 0
        ? {
            [workspace.id]: [
              {
                id: "thread-1",
                name: "Thread One",
                updatedAt: 100,
              },
            ],
          }
        : {}),
    threadListLoadingByWorkspace: {},
    lastAgentMessageByThread: overrides.lastAgentMessageByThread ?? {},
    threadStatusById: overrides.threadStatusById ?? {},
    rateLimitsByWorkspace: {},
    tokenUsageByThread: {},
    planByThread:
      overrides.planByThread ??
      (activeThreadId
        ? {
            [activeThreadId]: null,
          }
        : {}),
  };
}

function mockHomeStateDefaults(input?: {
  capabilities?: Awaited<ReturnType<typeof getRuntimeCapabilitiesSummary>>;
}) {
  mockedUseLocalUsage.mockReturnValue({
    snapshot: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockedGetRuntimeCapabilitiesSummary.mockResolvedValue(
    input?.capabilities ?? {
      mode: "runtime-gateway-web",
      methods: [],
      features: [],
      wsEndpointPath: "/ws",
      error: null,
    }
  );
}

async function renderMainAppHomeState(overrides: Parameters<typeof createParams>[0] = {}) {
  const params = createParams(overrides);
  const kernel = createRuntimeKernelValue();
  const hook = renderHook(() => useMainAppHomeState(params), {
    wrapper: createWrapper(kernel),
  });
  await waitFor(() => {
    expect(hook.result.current.missionControlFreshness.status).toBe("ready");
  });
  await waitFor(() => {
    expect(mockedGetRuntimeCapabilitiesSummary).toHaveBeenCalledTimes(1);
  });
  return { ...hook, kernel };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function waitForStartupEffects() {
  await waitFor(() => {
    expect(mockedGetRuntimeCapabilitiesSummary).toHaveBeenCalled();
  });
}

describe("useMainAppHomeState", () => {
  it("keeps plan panel collapsed when no active plan and no distributed capability", async () => {
    mockHomeStateDefaults();

    const { result } = await renderMainAppHomeState();

    await waitFor(() => {
      expect(result.current.hasActivePlan).toBe(false);
    });
  });

  it("does not restart mission-control startup effects on hook re-renders", async () => {
    mockHomeStateDefaults();

    const { kernel } = await renderMainAppHomeState();

    expect(
      kernel.workspaceClientRuntime.missionControl.readMissionControlSnapshot
    ).toHaveBeenCalledTimes(1);
    expect(mockedGetRuntimeCapabilitiesSummary).toHaveBeenCalledTimes(1);
  });

  it("keeps plan panel expanded when distributed graph capability is available", async () => {
    mockHomeStateDefaults({
      capabilities: {
        mode: "runtime-gateway-web",
        methods: ["code_distributed_task_graph"],
        features: ["distributed_subtask_graph_v1"],
        wsEndpointPath: "/ws",
        error: null,
      },
    });

    const { result } = await renderMainAppHomeState();

    await waitFor(() => {
      expect(result.current.hasActivePlan).toBe(true);
    });
  });

  it("keeps plan panel expanded even without an active thread when distributed graph is available", async () => {
    mockHomeStateDefaults({
      capabilities: {
        mode: "runtime-gateway-web",
        methods: ["code_distributed_task_graph"],
        features: ["distributed_subtask_graph_v1"],
        wsEndpointPath: "/ws",
        error: null,
      },
    });

    const { result } = await renderMainAppHomeState({ activeThreadId: null });

    await waitFor(() => {
      expect(result.current.hasActivePlan).toBe(true);
    });
    expect(mockedGetRuntimeCapabilitiesSummary).toHaveBeenCalledTimes(1);
  });

  it("hides home while creating the first thread for the active workspace", async () => {
    mockHomeStateDefaults();

    const { result } = await renderMainAppHomeState({
      activeThreadId: null,
      startingDraftThreadWorkspaceId: "ws-1",
    });

    await waitForStartupEffects();

    expect(result.current.isStartingDraftThread).toBe(true);
    expect(result.current.showHome).toBe(false);
    expect(result.current.showComposer).toBe(true);
  });

  it("clears starting-draft mode once the active workspace has a thread", async () => {
    mockHomeStateDefaults();

    const { result } = await renderMainAppHomeState({
      activeThreadId: "thread-1",
      startingDraftThreadWorkspaceId: "ws-1",
    });

    await waitForStartupEffects();

    expect(result.current.isStartingDraftThread).toBe(false);
  });

  it("hides home while pending draft user messages are waiting for thread activation", async () => {
    mockHomeStateDefaults();

    const { result } = await renderMainAppHomeState({
      activeThreadId: null,
      hasPendingDraftUserMessages: true,
    });

    await waitForStartupEffects();

    expect(result.current.showHome).toBe(false);
    expect(result.current.showComposer).toBe(true);
  });

  it("keeps the workspace shell active when no thread is selected", async () => {
    mockHomeStateDefaults();

    const { result } = await renderMainAppHomeState({ activeThreadId: null });

    await waitForStartupEffects();

    expect(result.current.showHome).toBe(false);
    expect(result.current.showComposer).toBe(true);
  });

  it("keeps the workspace shell active when no workspace is selected on desktop", async () => {
    mockHomeStateDefaults();
    const params = createParams({
      activeWorkspaceId: null,
      activeThreadId: null,
      workspaces: [],
      workspacesById: new Map(),
      threadsByWorkspace: {},
      planByThread: {},
    });

    const { result } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.missionControlFreshness.status).toBe("idle");
    });

    expect(result.current.showHome).toBe(false);
    expect(result.current.showComposer).toBe(false);
  });

  it("shows home when the desktop mission route is selected", async () => {
    mockHomeStateDefaults();
    const params = createParams({
      activeWorkspaceId: null,
      activeThreadId: null,
      showMissionHomeRoute: true,
      workspaces: [],
      workspacesById: new Map(),
      threadsByWorkspace: {},
      planByThread: {},
    });

    const { result } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.missionControlFreshness.status).toBe("idle");
    });

    expect(result.current.showHome).toBe(true);
    expect(result.current.showComposer).toBe(false);
  });

  it("keeps the workspace shell active when the current route still targets a workspace", async () => {
    mockHomeStateDefaults();
    const params = createParams({
      activeWorkspaceId: null,
      activeThreadId: null,
      hasWorkspaceRouteSelection: true,
      workspaces: [],
      workspacesById: new Map(),
      threadsByWorkspace: {},
      planByThread: {},
    });

    const { result } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.missionControlFreshness.status).toBe("idle");
    });

    expect(result.current.showHome).toBe(false);
    expect(result.current.showComposer).toBe(false);
  });

  it("prefers runtime-backed mission-control snapshot when available", async () => {
    mockHomeStateDefaults();
    const kernel = createRuntimeKernelValue({
      missionControlSnapshot: createMissionControlSnapshot({
        workspaces: [
          {
            id: "ws-1",
            name: "Workspace One",
            rootPath: "/tmp/workspace-one",
            connected: true,
            defaultProfileId: null,
          },
        ],
        tasks: [
          {
            id: "thread-1",
            workspaceId: "ws-1",
            title: "Stabilize mission panel",
            objective: "Stabilize mission panel",
            origin: {
              kind: "thread",
              threadId: "thread-1",
              runId: "run-1",
              requestId: null,
            },
            mode: "pair",
            modeSource: "access_mode",
            status: "review_ready",
            createdAt: 1000,
            updatedAt: 3000,
            currentRunId: null,
            latestRunId: "run-1",
            latestRunState: "review_ready",
            nextAction: {
              label: "Review the result",
              action: "review",
              detail: null,
            },
          },
        ],
        runs: [
          {
            id: "run-1",
            taskId: "thread-1",
            workspaceId: "ws-1",
            state: "review_ready",
            title: "Stabilize mission panel",
            summary: "Validation passed and review is ready.",
            startedAt: 1500,
            finishedAt: 3000,
            updatedAt: 3000,
            currentStepIndex: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            reviewPackId: "review-pack:run-1",
          },
        ],
        reviewPacks: [
          {
            id: "review-pack:run-1",
            runId: "run-1",
            taskId: "thread-1",
            workspaceId: "ws-1",
            summary: "Validation passed and review is ready.",
            reviewStatus: "ready",
            evidenceState: "confirmed",
            validationOutcome: "passed",
            warningCount: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            checksPerformed: [],
            recommendedNextAction: "Review the result",
            createdAt: 3000,
          },
        ],
      }),
    });
    const params = createParams();
    const { result } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(kernel),
    });

    await waitFor(() => {
      expect(result.current.latestAgentRuns).toHaveLength(1);
    });
    expect(result.current.latestAgentRuns[0]).toMatchObject({
      threadId: "thread-1",
      runId: "run-1",
      taskId: "thread-1",
      workspaceId: "ws-1",
      projectName: "Workspace One",
      message: "Validation passed and review is ready.",
      statusLabel: "Review ready",
      statusKind: "review_ready",
      source: "runtime_snapshot_v1",
      navigationTarget: {
        kind: "mission",
        workspaceId: "ws-1",
        taskId: "thread-1",
        runId: "run-1",
        reviewPackId: "review-pack:run-1",
        threadId: "thread-1",
        limitation: null,
      },
    });
    expect(result.current.missionControlProjection?.reviewPacks).toHaveLength(1);
  });

  it("falls back to legacy latest agent activity when mission control refresh fails", async () => {
    mockHomeStateDefaults();
    const kernel = createRuntimeKernelValue({
      missionControlError: new Error("gateway offline"),
    });

    const params = createParams({
      lastAgentMessageByThread: {
        "thread-1": {
          text: "Legacy fallback message",
          timestamp: 50,
        },
      },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
        },
      },
    });

    const { result } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(kernel),
    });

    await waitFor(() => {
      expect(result.current.missionControlFreshness.status).toBe("error");
    });
    expect(result.current.missionControlFreshness.error).toBe("gateway offline");
    expect(result.current.latestAgentRuns).toEqual([]);
  });

  it("limits recent thread instances to the most recent eight entries in descending order", async () => {
    mockHomeStateDefaults();
    const workspace = createWorkspace();
    const threads = Array.from({ length: 10 }, (_, index) => ({
      id: `thread-${index + 1}`,
      name: `Thread ${index + 1}`,
      updatedAt: 190 - index * 10,
    }));

    const { result } = await renderMainAppHomeState({
      workspaces: [workspace],
      workspacesById: new Map([[workspace.id, workspace]]),
      activeWorkspaceId: workspace.id,
      activeThreadId: "thread-1",
      threadsByWorkspace: {
        [workspace.id]: threads,
      },
      planByThread: {
        "thread-1": null,
      },
    });

    expect(result.current.recentThreadInstances).toHaveLength(8);
    expect(result.current.recentThreadInstances.map((item) => item.threadId)).toEqual([
      "thread-1",
      "thread-2",
      "thread-3",
      "thread-4",
      "thread-5",
      "thread-6",
      "thread-7",
      "thread-8",
    ]);
    expect(result.current.recentThreadsUpdatedAt).toBe(190);
  });

  it("clears the selected usage workspace when that workspace disappears", async () => {
    mockHomeStateDefaults();

    let params = createParams();
    const { result, rerender } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.missionControlFreshness.status).toBe("ready");
    });

    act(() => {
      result.current.setUsageWorkspaceId("ws-1");
    });
    expect(result.current.usageWorkspaceId).toBe("ws-1");

    params = createParams({
      activeWorkspaceId: null,
      activeThreadId: null,
      workspaces: [],
      workspacesById: new Map(),
      threadsByWorkspace: {},
      planByThread: {},
    });
    rerender();

    await waitFor(() => {
      expect(result.current.usageWorkspaceId).toBe(null);
    });
  });

  it("returns to idle freshness immediately when there are no workspaces", async () => {
    mockHomeStateDefaults();
    const params = createParams({
      activeWorkspaceId: null,
      activeThreadId: null,
      workspaces: [],
      workspacesById: new Map(),
      threadsByWorkspace: {},
      planByThread: {},
    });

    const { result } = renderHook(() => useMainAppHomeState(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.missionControlFreshness.status).toBe("idle");
    });
    expect(mockedGetRuntimeCapabilitiesSummary).toHaveBeenCalledTimes(1);
  });
});
