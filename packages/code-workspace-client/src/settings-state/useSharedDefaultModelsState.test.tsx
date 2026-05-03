// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SettingsShellFraming } from "../settings-shell/settingsShellTypes";
import type { WorkspaceClientBindings } from "../workspace/bindings";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedDefaultModelsState } from "./useSharedDefaultModelsState";

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Workspace settings",
};

function createBindings(
  getModelList: WorkspaceClientBindings["runtime"]["models"]["getModelList"] = vi.fn(async () => [])
): WorkspaceClientBindings {
  return {
    navigation: {
      readRouteSelection: () => ({ kind: "home" }),
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
        importCodexAuthJson: async () => ({
          accountId: null,
          displayName: null,
          email: null,
          imported: false,
          updated: false,
          sourceLabel: null,
          formats: [],
          message: null,
        }),
        runLogin: async () => ({ authUrl: "", immediateSuccess: false }),
        getAccountInfo: async () => null,
        getProvidersCatalog: async () => [],
      },
      models: {
        getModelList,
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: async () => [],
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
      platform: "desktop",
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
        platformHint: "desktop",
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: function TestRuntimeShell() {
        return null;
      },
      WorkspaceApp: function TestWorkspaceApp() {
        return null;
      },
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useSharedDefaultModelsState", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requests models from one representative connected workspace", async () => {
    const getModelList = vi.fn(async () => [{ model: "gpt-5.4" }]);
    const { result } = renderHook(
      () =>
        useSharedDefaultModelsState(
          [
            { id: "w1", name: "Workspace 1", connected: true },
            { id: "w2", name: "Workspace 2", connected: true },
          ],
          {
            parseModelListResponse: (response) => response as never,
            mapModel: (model) => model,
            compareModels: (left, right) => left.model.localeCompare(right.model),
          }
        ),
      { wrapper: wrapper(createBindings(getModelList)) }
    );

    await waitFor(() => {
      expect(getModelList).toHaveBeenCalledWith("w1");
      expect(result.current.models[0]?.model).toBe("gpt-5.4");
    });
  });

  it("drops stale in-flight results after connected workspaces disappear", async () => {
    const pending = deferred<Array<{ model: string }>>();
    const getModelList = vi.fn(() => pending.promise);
    const bindings = createBindings(getModelList);
    const { result, rerender } = renderHook(
      ({ projects }: { projects: Array<{ id: string; name: string; connected: boolean }> }) =>
        useSharedDefaultModelsState(projects, {
          parseModelListResponse: (response) => response as never,
          mapModel: (model) => model,
          compareModels: () => 0,
        }),
      {
        initialProps: {
          projects: [{ id: "w1", name: "Workspace 1", connected: true }],
        },
        wrapper: wrapper(bindings),
      }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    rerender({
      projects: [{ id: "w1", name: "Workspace 1", connected: false }],
    });

    await waitFor(() => {
      expect(result.current.connectedWorkspaceCount).toBe(0);
      expect(result.current.models).toEqual([]);
    });

    await act(async () => {
      pending.resolve([{ model: "gpt-5.3" }]);
      await Promise.resolve();
    });

    expect(result.current.models).toEqual([]);
  });
});
