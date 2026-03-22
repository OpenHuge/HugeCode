// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceClientBindings } from "../index";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedWorkspaceCatalogState } from "./useSharedWorkspaceCatalogState";
import type { SharedWorkspaceRouteSelection } from "./workspaceNavigation";

function createBindings(
  selection: SharedWorkspaceRouteSelection,
  listWorkspaces = vi.fn(async () => []),
  subscribeScopedRuntimeUpdatedEvents = vi.fn((_options, _listener) => () => undefined)
): WorkspaceClientBindings {
  return {
    navigation: {
      readRouteSelection: () => selection,
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
        startRuntimeJob: async () => {
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

describe("useSharedWorkspaceCatalogState", () => {
  it("refreshes workspace catalog from runtime-updated events and derives active workspace from route state", async () => {
    const listWorkspaces = vi
      .fn()
      .mockResolvedValueOnce([{ id: "workspace-1", name: "Alpha", connected: true }])
      .mockResolvedValueOnce([
        { id: "workspace-1", name: "Alpha", connected: true },
        { id: "workspace-2", name: "Beta", connected: false },
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
      expect(result.current.workspaces).toHaveLength(1);
    });
    expect(result.current.activeWorkspaceId).toBeNull();
    expect(subscribeScopedRuntimeUpdatedEvents).toHaveBeenCalledWith(
      { scopes: ["bootstrap", "workspaces"] },
      expect.any(Function)
    );

    const nextListener = listener;
    if (nextListener) {
      nextListener({
        scope: ["workspaces"],
        reason: "workspaceUpsert",
        eventWorkspaceId: "workspace-2",
        paramsWorkspaceId: "workspace-2",
      });
    }

    await waitFor(() => {
      expect(result.current.workspaces).toHaveLength(2);
      expect(result.current.activeWorkspaceId).toBe("workspace-2");
      expect(result.current.activeWorkspace?.name).toBe("Beta");
    });
  });
});
