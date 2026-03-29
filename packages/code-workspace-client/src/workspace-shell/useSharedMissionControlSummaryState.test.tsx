// @vitest-environment jsdom
import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeTaskSummary,
  HugeCodeWorkspace,
} from "@ku0/code-runtime-host-contract";
import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceClientBindings } from "../workspace/bindings";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedMissionControlSummaryState } from "./useSharedMissionControlSummaryState";

function createSnapshot(
  overrides: Partial<HugeCodeMissionControlSnapshot> = {}
): HugeCodeMissionControlSnapshot {
  return {
    source: "runtime_snapshot_v1",
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
    ...overrides,
  };
}

function createWorkspace(overrides: Partial<HugeCodeWorkspace> = {}): HugeCodeWorkspace {
  return {
    id: "workspace-1",
    name: "Alpha",
    rootPath: "/alpha",
    connected: true,
    defaultProfileId: null,
    ...overrides,
  };
}

function createTask(overrides: Partial<HugeCodeTaskSummary> = {}): HugeCodeTaskSummary {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    title: "Task",
    objective: null,
    origin: {
      kind: "run",
      runId: "run-1",
      threadId: null,
      requestId: null,
    },
    taskSource: null,
    mode: null,
    modeSource: "missing",
    status: "queued",
    createdAt: 0,
    updatedAt: 0,
    currentRunId: null,
    latestRunId: null,
    latestRunState: null,
    ...overrides,
  };
}

function createBindings(
  readMissionControlSnapshot = vi.fn(async () => createSnapshot()),
  subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, _listener) => () => undefined),
  kernelProjection: WorkspaceClientBindings["runtime"]["kernelProjection"] = undefined
): WorkspaceClientBindings {
  return {
    navigation: {
      readRouteSelection: () => ({ kind: "home" as const }),
      subscribeRouteSelection: () => () => undefined,
      navigateToWorkspace: () => undefined,
      navigateToSection: () => undefined,
      navigateHome: () => undefined,
    },
    runtimeGateway: {
      readRuntimeMode: () => "connected",
      subscribeRuntimeMode: () => () => undefined,
      discoverLocalRuntimeGatewayTargets: async () => [],
      configureManualWebRuntimeGatewayTarget: () => undefined,
    },
    runtime: {
      surface: "shared-workspace-client",
      settings: {
        getAppSettings: async () => ({}),
        updateAppSettings: async (settings) => settings,
        syncRuntimeGatewayProfileFromAppSettings: () => undefined,
      },
      oauth: {
        listAccounts: async () => [],
        listPools: async () => [],
        listPoolMembers: async () => [],
        getPrimaryAccount: async () => null,
        setPrimaryAccount: async () => {
          throw new Error("not implemented");
        },
        applyPool: async () => undefined,
        bindPoolAccount: async () => undefined,
        runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
        getAccountInfo: async () => null,
        getProvidersCatalog: async () => [],
      },
      models: {
        getModelList: async () => [],
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: async () => [],
      },
      missionControl: {
        readMissionControlSnapshot,
      },
      kernelProjection,
      runtimeUpdated: {
        subscribeScopedRuntimeUpdatedEvents,
      },
      agentControl: {
        prepareRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        startRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        cancelRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        resumeRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        interveneRuntimeRun: async () => {
          throw new Error("not implemented");
        },
        submitRuntimeJobApprovalDecision: async () => {
          throw new Error("not implemented");
        },
      },
      threads: {
        listThreads: async () => [],
        createThread: async () => ({
          id: "thread-1",
          workspaceId: "workspace-1",
          title: "Thread",
          unread: false,
          running: false,
          createdAt: 0,
          updatedAt: 0,
          provider: "openai",
          modelId: null,
        }),
        resumeThread: async () => null,
        archiveThread: async () => true,
      },
      git: {
        listChanges: async () => ({ staged: [], unstaged: [] }),
        readDiff: async () => null,
        listBranches: async () => ({ currentBranch: "main", branches: [] }),
        createBranch: async () => ({ ok: true, error: null }),
        checkoutBranch: async () => ({ ok: true, error: null }),
        readLog: async () => ({
          total: 0,
          entries: [],
          ahead: 0,
          behind: 0,
          aheadEntries: [],
          behindEntries: [],
          upstream: null,
        }),
        stageChange: async () => ({ ok: true, error: null }),
        stageAll: async () => ({ ok: true, error: null }),
        unstageChange: async () => ({ ok: true, error: null }),
        revertChange: async () => ({ ok: true, error: null }),
        commit: async () => ({ committed: false, committedCount: 0, error: null }),
      },
      workspaceFiles: {
        listWorkspaceFileEntries: async () => [],
        readWorkspaceFile: async () => null,
      },
      review: {
        listReviewPacks: async () => [],
      },
    },
    host: {
      platform: "web",
      intents: {
        openOauthAuthorizationUrl: async () => undefined,
        createOauthPopupWindow: () => null,
        waitForOauthBinding: async () => false,
      },
      notifications: {
        testSound: () => undefined,
        testSystemNotification: () => undefined,
      },
      shell: {
        platformHint: "web",
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: () => null,
      WorkspaceApp: () => null,
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Web app",
        title: "Settings",
        subtitle: "Workspace settings",
      },
    },
  };
}

function wrapper(bindings: WorkspaceClientBindings) {
  return ({ children }: { children: ReactNode }) => (
    <WorkspaceClientBindingsProvider bindings={bindings}>
      {children}
    </WorkspaceClientBindingsProvider>
  );
}

describe("useSharedMissionControlSummaryState", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips the runtime snapshot read until the shell explicitly enables mission data", () => {
    const readMissionControlSnapshot = vi.fn(async () => ({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 0,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [],
    }));

    const { result } = renderHook(
      () => useSharedMissionControlSummaryState("workspace-1", { enabled: false }),
      {
        wrapper: wrapper(createBindings(readMissionControlSnapshot)),
      }
    );

    expect(readMissionControlSnapshot).not.toHaveBeenCalled();
    expect(result.current.loadState).toBe("idle");
    expect(result.current.summary.tasksCount).toBe(0);
    expect(result.current.summary.reviewPacksCount).toBe(0);
  });

  it("refreshes mission control snapshot when scoped runtime updates arrive", async () => {
    const readMissionControlSnapshot = vi
      .fn()
      .mockResolvedValueOnce(
        createSnapshot({
          workspaces: [createWorkspace()],
        })
      )
      .mockResolvedValueOnce(
        createSnapshot({
          generatedAt: 1,
          workspaces: [createWorkspace()],
          tasks: [
            createTask({
              status: "running",
              currentRunId: "run-1",
              latestRunId: "run-1",
              latestRunState: "running",
            }),
          ],
        })
      );

    let listener:
      | ((event: {
          scope: string[];
          reason: string;
          eventWorkspaceId: string;
          paramsWorkspaceId: string | null;
        }) => void)
      | undefined;
    const subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, nextListener) => {
      listener = nextListener;
      return () => {
        listener = undefined;
        return undefined;
      };
    });

    const { result } = renderHook(() => useSharedMissionControlSummaryState("workspace-1"), {
      wrapper: wrapper(
        createBindings(readMissionControlSnapshot, subscribeScopedRuntimeUpdatedEvents)
      ),
    });

    await waitFor(() => {
      expect(result.current.summary.tasksCount).toBe(0);
    });

    expect(subscribeScopedRuntimeUpdatedEvents).toHaveBeenCalledWith(
      { scopes: ["bootstrap", "workspaces", "agents"] },
      expect.any(Function)
    );

    const nextListener = listener;
    if (nextListener) {
      await act(async () => {
        nextListener({
          scope: ["agents"],
          reason: "runUpsert",
          eventWorkspaceId: "workspace-1",
          paramsWorkspaceId: "workspace-1",
        });
      });
    }

    await waitFor(() => {
      expect(result.current.summary.tasksCount).toBe(1);
    });
    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(2);
  });

  it("debounces repeated runtime-updated events into one shared refresh", async () => {
    vi.useFakeTimers();
    const readMissionControlSnapshot = vi
      .fn()
      .mockResolvedValueOnce(createSnapshot())
      .mockResolvedValueOnce(
        createSnapshot({
          generatedAt: 1,
          tasks: [
            createTask({
              status: "running",
              currentRunId: "run-1",
              latestRunId: "run-1",
              latestRunState: "running",
            }),
          ],
        })
      );

    let listener:
      | ((event: {
          scope: string[];
          reason: string;
          eventWorkspaceId: string;
          paramsWorkspaceId: string | null;
        }) => void)
      | undefined;
    const subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, nextListener) => {
      listener = nextListener;
      return () => {
        listener = undefined;
        return undefined;
      };
    });

    const { result } = renderHook(() => useSharedMissionControlSummaryState("workspace-1"), {
      wrapper: wrapper(
        createBindings(readMissionControlSnapshot, subscribeScopedRuntimeUpdatedEvents)
      ),
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.loadState).toBe("ready");
    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      listener?.({
        scope: ["agents"],
        reason: "runUpsert",
        eventWorkspaceId: "workspace-1",
        paramsWorkspaceId: "workspace-1",
      });
      listener?.({
        scope: ["agents"],
        reason: "runUpsert",
        eventWorkspaceId: "workspace-1",
        paramsWorkspaceId: "workspace-1",
      });
    });

    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(160);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.loadState).toBe("ready");
    expect(result.current.summary.tasksCount).toBe(1);
    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(2);
  });

  it("clears pending refresh timeouts when the active workspace changes", async () => {
    vi.useFakeTimers();
    const readMissionControlSnapshot = vi
      .fn(async () =>
        createSnapshot({
          workspaces: [createWorkspace()],
          tasks: [createTask({ title: "Task 1" })],
        })
      )
      .mockResolvedValueOnce(
        createSnapshot({
          workspaces: [createWorkspace()],
          tasks: [createTask({ title: "Task 1" })],
        })
      )
      .mockResolvedValueOnce(
        createSnapshot({
          workspaces: [
            createWorkspace({
              id: "workspace-2",
              name: "Beta",
              rootPath: "/beta",
            }),
          ],
          tasks: [
            createTask({
              workspaceId: "workspace-2",
              title: "Task 1",
            }),
            createTask({
              id: "task-2",
              workspaceId: "workspace-2",
              title: "Task 2",
              origin: {
                kind: "run",
                runId: "run-2",
                threadId: null,
                requestId: null,
              },
            }),
          ],
        })
      );

    let listener:
      | ((event: {
          scope: string[];
          reason: string;
          eventWorkspaceId: string;
          paramsWorkspaceId: string | null;
        }) => void)
      | undefined;
    const subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, nextListener) => {
      listener = nextListener;
      return () => {
        listener = undefined;
        return undefined;
      };
    });

    const { result, rerender } = renderHook(
      ({ activeWorkspaceId }) => useSharedMissionControlSummaryState(activeWorkspaceId),
      {
        initialProps: { activeWorkspaceId: "workspace-1" },
        wrapper: wrapper(
          createBindings(readMissionControlSnapshot, subscribeScopedRuntimeUpdatedEvents)
        ),
      }
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.summary.tasksCount).toBe(1);

    await act(async () => {
      listener?.({
        scope: ["agents"],
        reason: "runUpsert",
        eventWorkspaceId: "workspace-1",
        paramsWorkspaceId: "workspace-1",
      });
    });

    rerender({ activeWorkspaceId: "workspace-2" });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.summary.tasksCount).toBe(2);

    await act(async () => {
      vi.advanceTimersByTime(160);
      await Promise.resolve();
    });

    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(2);
    expect(result.current.summary.workspaceLabel).toBe("Beta");
    expect(result.current.summary.tasksCount).toBe(2);
  });

  it("derives summary from the full mission snapshot", async () => {
    const readMissionControlSnapshot = vi.fn(async () =>
      createSnapshot({
        workspaces: [createWorkspace()],
        tasks: [createTask({ title: "Task 1" })],
      })
    );
    const { result } = renderHook(() => useSharedMissionControlSummaryState("workspace-1"), {
      wrapper: wrapper(createBindings(readMissionControlSnapshot)),
    });

    await waitFor(() => {
      expect(result.current.summary.tasksCount).toBe(1);
    });

    expect(readMissionControlSnapshot).toHaveBeenCalledTimes(1);
  });
});
