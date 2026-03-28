// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsShellFraming } from "../settings-shell/settingsShellTypes";
import type { WorkspaceClientBindings } from "../workspace/bindings";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedAppSettingsState } from "./useSharedAppSettingsState";

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Workspace settings",
};

function createBindings(overrides?: Partial<WorkspaceClientBindings["runtime"]["settings"]>) {
  const settings = {
    getAppSettings: vi.fn(async () => ({ theme: "dark", uiScale: 2 })),
    updateAppSettings: vi.fn(async (next: Record<string, unknown>) => next),
    syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
    ...overrides,
  };
  const bindings: WorkspaceClientBindings = {
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
      settings,
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
  return { bindings, settings };
}

function wrapper(bindings: WorkspaceClientBindings) {
  return ({ children }: { children: ReactNode }) => (
    <WorkspaceClientBindingsProvider bindings={bindings}>
      {children}
    </WorkspaceClientBindingsProvider>
  );
}

describe("useSharedAppSettingsState", () => {
  it("loads, normalizes, and saves settings through runtime bindings", async () => {
    const { bindings, settings } = createBindings();
    const buildDefaultSettings = () => ({ theme: "system", uiScale: 1 });
    const normalizeSettings = (next: { theme: unknown; uiScale: unknown }) => ({
      theme: next.theme === "dark" ? "dark" : "system",
      uiScale: Number(next.uiScale ?? 1),
    });
    const { result } = renderHook(
      () =>
        useSharedAppSettingsState({
          buildDefaultSettings,
          normalizeSettings,
        }),
      { wrapper: wrapper(bindings) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.settings.theme).toBe("dark");
      expect(result.current.settings.uiScale).toBe(2);
    });

    await act(async () => {
      await result.current.saveSettings({ theme: "dark", uiScale: 3 });
    });

    expect(settings.updateAppSettings).toHaveBeenCalledWith({ theme: "dark", uiScale: 3 });
    expect(settings.syncRuntimeGatewayProfileFromAppSettings).toHaveBeenCalled();
  });

  it("does not sync runtime gateway settings until persisted settings finish hydrating", async () => {
    let resolveSettings!: (value: Record<string, unknown>) => void;
    const pendingSettings = new Promise<Record<string, unknown>>((resolve) => {
      resolveSettings = resolve;
    });
    const { bindings, settings } = createBindings({
      getAppSettings: vi.fn(() => pendingSettings),
    });
    const buildDefaultSettings = () => ({ theme: "system", uiScale: 1 });
    const normalizeSettings = (next: { theme: unknown; uiScale: unknown }) => ({
      theme: next.theme === "dark" ? "dark" : "system",
      uiScale: Number(next.uiScale ?? 1),
    });
    const { result } = renderHook(
      () =>
        useSharedAppSettingsState({
          buildDefaultSettings,
          normalizeSettings,
        }),
      { wrapper: wrapper(bindings) }
    );

    expect(result.current.isLoading).toBe(true);
    expect(settings.syncRuntimeGatewayProfileFromAppSettings).not.toHaveBeenCalled();

    await act(async () => {
      resolveSettings({ theme: "dark", uiScale: 2 });
      await pendingSettings;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.settings).toEqual({ theme: "dark", uiScale: 2 });
    });

    expect(settings.syncRuntimeGatewayProfileFromAppSettings).toHaveBeenCalledTimes(1);
    expect(settings.syncRuntimeGatewayProfileFromAppSettings).toHaveBeenCalledWith({
      theme: "dark",
      uiScale: 2,
    });
  });

  it("syncs normalized defaults once hydration fails", async () => {
    const { bindings, settings } = createBindings({
      getAppSettings: vi.fn(async () => {
        throw new Error("settings unavailable");
      }),
    });
    const buildDefaultSettings = () => ({ theme: "system", uiScale: 1 });
    const normalizeSettings = (next: { theme: unknown; uiScale: unknown }) => ({
      theme: next.theme === "dark" ? "dark" : "system",
      uiScale: Number(next.uiScale ?? 1),
    });
    const { result } = renderHook(
      () =>
        useSharedAppSettingsState({
          buildDefaultSettings,
          normalizeSettings,
        }),
      { wrapper: wrapper(bindings) }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual({ theme: "system", uiScale: 1 });
    expect(settings.syncRuntimeGatewayProfileFromAppSettings).toHaveBeenCalledTimes(1);
    expect(settings.syncRuntimeGatewayProfileFromAppSettings).toHaveBeenCalledWith({
      theme: "system",
      uiScale: 1,
    });
  });
});
