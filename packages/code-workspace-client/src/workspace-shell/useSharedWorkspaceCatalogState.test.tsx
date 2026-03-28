// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceClientBindings } from "../index";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedWorkspaceCatalogState } from "./useSharedWorkspaceCatalogState";
import type { SharedWorkspaceRouteSelection } from "./workspaceNavigation";

function createBindings(
  selection: SharedWorkspaceRouteSelection,
  listWorkspaces: WorkspaceClientBindings["runtime"]["workspaceCatalog"]["listWorkspaces"] = vi.fn(
    async () => []
  ),
  subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, _listener) => () => undefined),
  navigationOverrides?: Partial<WorkspaceClientBindings["navigation"]>
): WorkspaceClientBindings {
  const listeners = new Set<() => void>();
  return {
    navigation: {
      readRouteSelection: () => selection,
      subscribeRouteSelection: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      navigateToWorkspace: (workspaceId, options) => {
        selection = { kind: "workspace", workspaceId };
        listeners.forEach((listener) => listener());
        return navigationOverrides?.navigateToWorkspace?.(workspaceId, options);
      },
      navigateToSection: (section, options) => {
        selection = { kind: section };
        listeners.forEach((listener) => listener());
        return navigationOverrides?.navigateToSection?.(section, options);
      },
      navigateHome: (options) => {
        selection = { kind: "home" };
        listeners.forEach((listener) => listener());
        return navigationOverrides?.navigateHome?.(options);
      },
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
        listWorkspaces,
      },
      missionControl: {
        readMissionControlSnapshot: async () => ({
          source: "runtime_snapshot_v1",
          generatedAt: 0,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        }),
      },
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

describe("useSharedWorkspaceCatalogState", () => {
  it("preserves an explicit workspace route while the catalog is still hydrating", async () => {
    let resolveCatalog:
      | ((value: { id: string; name: string; connected: boolean }[]) => void)
      | null = null;
    const listWorkspaces = vi.fn(
      () =>
        new Promise<{ id: string; name: string; connected: boolean }[]>((resolve) => {
          resolveCatalog = resolve;
        })
    );

    const { result } = renderHook(() => useSharedWorkspaceCatalogState(), {
      wrapper: wrapper(
        createBindings({ kind: "workspace", workspaceId: "workspace-2" }, listWorkspaces)
      ),
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("loading");
    });
    expect(result.current.activeWorkspaceId).toBe("workspace-2");
    expect(result.current.activeWorkspace).toBeNull();
    expect(result.current.hasPendingWorkspaceSelection).toBe(true);

    await act(async () => {
      resolveCatalog?.([{ id: "workspace-1", name: "Alpha", connected: true }]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });
    expect(result.current.activeWorkspaceId).toBeNull();
    expect(result.current.hasPendingWorkspaceSelection).toBe(false);
  });

  it("canonicalizes an invalid workspace route back to home once the catalog is ready", async () => {
    const navigateHome = vi.fn();
    const listWorkspaces = vi.fn(async () => [
      { id: "workspace-1", name: "Alpha", connected: true },
    ]);

    const { result } = renderHook(() => useSharedWorkspaceCatalogState(), {
      wrapper: wrapper(
        createBindings(
          { kind: "workspace", workspaceId: "workspace-2" },
          listWorkspaces,
          undefined,
          { navigateHome }
        )
      ),
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBeNull();
    });

    expect(navigateHome).toHaveBeenCalledWith({ replace: true });
  });

  it("refreshes workspace catalog from runtime-updated events and derives active workspace from route state", async () => {
    const listWorkspaces = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "workspace-1", name: "Alpha", connected: true },
        { id: "workspace-2", name: "Beta", connected: false },
      ])
      .mockResolvedValueOnce([
        { id: "workspace-1", name: "Alpha", connected: true },
        { id: "workspace-2", name: "Beta Prime", connected: true },
      ]);

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

    const { result } = renderHook(() => useSharedWorkspaceCatalogState(), {
      wrapper: wrapper(
        createBindings(
          { kind: "workspace", workspaceId: "workspace-2" },
          listWorkspaces,
          subscribeScopedRuntimeUpdatedEvents
        )
      ),
    });

    await waitFor(() => {
      expect(result.current.workspaces).toHaveLength(2);
      expect(result.current.activeWorkspaceId).toBe("workspace-2");
      expect(result.current.activeWorkspace?.name).toBe("Beta");
    });
    expect(result.current.hasPendingWorkspaceSelection).toBe(false);
    expect(subscribeScopedRuntimeUpdatedEvents).toHaveBeenCalledWith(
      { scopes: ["bootstrap", "workspaces"] },
      expect.any(Function)
    );

    const nextListener = listener;
    if (nextListener) {
      await act(async () => {
        nextListener({
          scope: ["workspaces"],
          reason: "workspaceUpsert",
          eventWorkspaceId: "workspace-2",
          paramsWorkspaceId: "workspace-2",
        });
      });
    }

    await waitFor(() => {
      expect(result.current.workspaces).toHaveLength(2);
      expect(result.current.activeWorkspaceId).toBe("workspace-2");
      expect(result.current.activeWorkspace?.name).toBe("Beta Prime");
      expect(result.current.hasPendingWorkspaceSelection).toBe(false);
    });
  });

  it("preserves the current workspace roster while a runtime-triggered refresh is in flight", async () => {
    let resolveRefresh:
      | ((value: { id: string; name: string; connected: boolean }[]) => void)
      | null = null;
    const listWorkspaces = vi
      .fn()
      .mockResolvedValueOnce([{ id: "workspace-1", name: "Alpha", connected: true }])
      .mockImplementationOnce(
        () =>
          new Promise<{ id: string; name: string; connected: boolean }[]>((resolve) => {
            resolveRefresh = resolve;
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

    const { result } = renderHook(() => useSharedWorkspaceCatalogState(), {
      wrapper: wrapper(
        createBindings({ kind: "home" }, listWorkspaces, subscribeScopedRuntimeUpdatedEvents)
      ),
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });
    expect(result.current.workspaces).toEqual([
      { id: "workspace-1", name: "Alpha", connected: true },
    ]);

    await act(async () => {
      listener?.({
        scope: ["workspaces"],
        reason: "workspaceUpsert",
        eventWorkspaceId: "workspace-2",
        paramsWorkspaceId: "workspace-2",
      });
      await Promise.resolve();
    });

    expect(result.current.loadState).toBe("refreshing");
    expect(result.current.workspaces).toEqual([
      { id: "workspace-1", name: "Alpha", connected: true },
    ]);

    await act(async () => {
      resolveRefresh?.([
        { id: "workspace-1", name: "Alpha", connected: true },
        { id: "workspace-2", name: "Beta", connected: false },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
      expect(result.current.workspaces).toHaveLength(2);
    });
  });
});
