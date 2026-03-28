// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceClientBindings } from "../index";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedHostStartupStatusState } from "./useSharedHostStartupStatusState";

function createBindings(
  readStartupStatus: WorkspaceClientBindings["host"]["shell"]["readStartupStatus"] = vi.fn(
    async () => ({
      tone: "ready" as const,
      label: "Desktop host ready",
      detail: "Automatic desktop updates are available.",
    })
  )
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
        readMissionControlSnapshot: async () => ({
          source: "runtime_snapshot_v1" as const,
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
        readStartupStatus,
      },
    },
    platformUi: {
      WorkspaceRuntimeShell: () => null,
      WorkspaceApp: () => null,
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: {
        kickerLabel: "Preferences",
        contextLabel: "Desktop app",
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

describe("useSharedHostStartupStatusState", () => {
  it("stays idle when host startup status is disabled", () => {
    const readStartupStatus = vi.fn(async () => ({
      tone: "ready" as const,
      label: "Desktop host ready",
      detail: "Automatic desktop updates are available.",
    }));

    const { result } = renderHook(() =>
      useSharedHostStartupStatusState(createBindings(readStartupStatus).host, { enabled: false })
    );

    expect(readStartupStatus).not.toHaveBeenCalled();
    expect(result.current.loadState).toBe("idle");
    expect(result.current.status).toBeNull();
  });

  it("loads and exposes the desktop host startup status", async () => {
    const readStartupStatus = vi.fn(async () => ({
      tone: "attention" as const,
      label: "Electron updates need attention",
      detail: "Manual updates are required for this build.",
    }));

    const bindings = createBindings(readStartupStatus);
    const { result } = renderHook(() => useSharedHostStartupStatusState(bindings.host), {
      wrapper: wrapper(bindings),
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    expect(result.current.status).toEqual({
      tone: "attention",
      label: "Electron updates need attention",
      detail: "Manual updates are required for this build.",
    });
    expect(readStartupStatus).toHaveBeenCalledTimes(1);
  });

  it("keeps the current desktop status visible while a manual refresh is in flight", async () => {
    let resolveRefresh: ((value: { tone: "ready"; label: string; detail: string }) => void) | null =
      null;
    const readStartupStatus = vi
      .fn()
      .mockResolvedValueOnce({
        tone: "ready" as const,
        label: "Desktop host ready",
        detail: "Automatic desktop updates are available.",
      })
      .mockImplementationOnce(
        () =>
          new Promise<{
            tone: "ready";
            label: string;
            detail: string;
          }>((resolve) => {
            resolveRefresh = resolve;
          })
      );

    const bindings = createBindings(readStartupStatus);
    const { result } = renderHook(() => useSharedHostStartupStatusState(bindings.host), {
      wrapper: wrapper(bindings),
    });

    await waitFor(() => {
      expect(result.current.loadState).toBe("ready");
    });

    expect(result.current.status?.label).toBe("Desktop host ready");

    await act(async () => {
      void result.current.refresh();
      await Promise.resolve();
    });

    expect(result.current.loadState).toBe("refreshing");
    expect(result.current.status?.label).toBe("Desktop host ready");

    await act(async () => {
      resolveRefresh?.({
        tone: "ready",
        label: "Desktop host refreshed",
        detail: "Refresh completed without blocking the shared shell.",
      });
      await Promise.resolve();
    });

    expect(result.current.loadState).toBe("ready");
    expect(result.current.status?.label).toBe("Desktop host refreshed");
    expect(readStartupStatus).toHaveBeenCalledTimes(2);
  });
});
