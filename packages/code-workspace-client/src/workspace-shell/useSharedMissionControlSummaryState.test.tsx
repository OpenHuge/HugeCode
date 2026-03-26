// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceClientBindings } from "../index";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedMissionControlSummaryState } from "./useSharedMissionControlSummaryState";

function createBindings(
  readMissionControlSnapshot = vi.fn(async () => ({
    source: "runtime_snapshot_v1" as const,
    generatedAt: 0,
    workspaces: [],
    tasks: [],
    runs: [],
    reviewPacks: [],
  })),
  subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, _listener) => () => undefined),
  kernelProjection: WorkspaceClientBindings["runtime"]["kernelProjection"] = undefined,
  readMissionControlSummary?: WorkspaceClientBindings["runtime"]["missionControl"]["readMissionControlSummary"]
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
        readMissionControlSummary,
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
        cancelRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        resumeRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        interveneRuntimeJob: async () => {
          throw new Error("not implemented");
        },
        subscribeRuntimeJob: async () => null,
        listRuntimeJobs: async () => [],
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
      .mockResolvedValueOnce({
        source: "runtime_snapshot_v1" as const,
        generatedAt: 0,
        workspaces: [
          {
            id: "workspace-1",
            name: "Alpha",
            rootPath: "/alpha",
            connected: true,
            defaultProfileId: null,
          },
        ],
        tasks: [],
        runs: [],
        reviewPacks: [],
      })
      .mockResolvedValueOnce({
        source: "runtime_snapshot_v1" as const,
        generatedAt: 1,
        workspaces: [
          {
            id: "workspace-1",
            name: "Alpha",
            rootPath: "/alpha",
            connected: true,
            defaultProfileId: null,
          },
        ],
        tasks: [
          {
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Task",
            objective: null,
            origin: { kind: "run", runId: "run-1", threadId: null, requestId: null },
            taskSource: null,
            mode: null,
            modeSource: "missing",
            status: "running",
            createdAt: 0,
            updatedAt: 0,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "running",
          },
        ],
        runs: [],
        reviewPacks: [],
      });

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
      .mockResolvedValueOnce({
        source: "runtime_snapshot_v1" as const,
        generatedAt: 0,
        workspaces: [],
        tasks: [],
        runs: [],
        reviewPacks: [],
      })
      .mockResolvedValueOnce({
        source: "runtime_snapshot_v1" as const,
        generatedAt: 1,
        workspaces: [],
        tasks: [
          {
            id: "task-1",
            workspaceId: "workspace-1",
            title: "Task",
            objective: null,
            origin: { kind: "run", runId: "run-1", threadId: null, requestId: null },
            taskSource: null,
            mode: null,
            modeSource: "missing",
            status: "running",
            createdAt: 0,
            updatedAt: 0,
            currentRunId: "run-1",
            latestRunId: "run-1",
            latestRunState: "running",
          },
        ],
        runs: [],
        reviewPacks: [],
      });

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
    const readMissionControlSummary = vi.fn(async (workspaceId: string | null) => ({
      workspaceLabel: workspaceId === "workspace-2" ? "Beta" : "Alpha",
      tasksCount: workspaceId === "workspace-2" ? 2 : 1,
      runsCount: 0,
      approvalCount: 0,
      reviewPacksCount: 0,
      connectedWorkspaceCount: 1,
      launchReadiness: {
        tone: "ready" as const,
        label: "Launch readiness",
        detail: "Ready",
      },
      continuityReadiness: {
        tone: "ready" as const,
        label: "Continuity readiness",
        detail: "Ready",
      },
      missionItems: [],
      reviewItems: [],
    }));

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
          createBindings(
            vi.fn(async () => ({
              source: "runtime_snapshot_v1" as const,
              generatedAt: 0,
              workspaces: [],
              tasks: [],
              runs: [],
              reviewPacks: [],
            })),
            subscribeScopedRuntimeUpdatedEvents,
            undefined,
            readMissionControlSummary
          )
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

    expect(readMissionControlSummary.mock.calls).toEqual([["workspace-1"], ["workspace-2"]]);
    expect(result.current.summary.workspaceLabel).toBe("Beta");
    expect(result.current.summary.tasksCount).toBe(2);
  });

  it("prefers the lightweight mission summary binding over the full mission snapshot", async () => {
    const readMissionControlSnapshot = vi.fn(async () => ({
      source: "runtime_snapshot_v1" as const,
      generatedAt: 0,
      workspaces: [],
      tasks: [],
      runs: [],
      reviewPacks: [],
    }));
    const readMissionControlSummary = vi.fn(async () => ({
      workspaceLabel: "Alpha",
      tasksCount: 1,
      runsCount: 2,
      approvalCount: 1,
      reviewPacksCount: 1,
      connectedWorkspaceCount: 1,
      launchReadiness: {
        tone: "ready" as const,
        label: "Launch readiness",
        detail: "Connected routing is healthy for the current workspace slice.",
      },
      continuityReadiness: {
        tone: "attention" as const,
        label: "Continuity readiness",
        detail: "1 review path ready; 1 review pack published",
      },
      missionItems: [],
      reviewItems: [],
    }));

    const { result } = renderHook(() => useSharedMissionControlSummaryState("workspace-1"), {
      wrapper: wrapper(
        (() => {
          const bindings = createBindings(readMissionControlSnapshot);
          bindings.runtime.missionControl.readMissionControlSummary = readMissionControlSummary;
          return bindings;
        })()
      ),
    });

    await waitFor(() => {
      expect(result.current.summary.tasksCount).toBe(1);
    });

    expect(readMissionControlSummary).toHaveBeenCalledWith("workspace-1");
    expect(readMissionControlSnapshot).not.toHaveBeenCalled();
  });
});
