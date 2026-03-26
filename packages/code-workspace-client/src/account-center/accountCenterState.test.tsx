// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsShellFraming, WorkspaceClientBindings } from "../index";
import { WorkspaceClientBindingsProvider } from "../workspace/WorkspaceClientBindingsProvider";
import { useSharedAccountCenterState } from "./accountCenterState";

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Workspace settings",
};

const subscribeScopedRuntimeUpdatedEventsMock = vi.fn(() => () => undefined);

function createBindings(): WorkspaceClientBindings {
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
        listAccounts: vi.fn(async () => [
          {
            accountId: "codex-a1",
            provider: "codex" as const,
            externalAccountId: null,
            email: "codex-a1@example.com",
            displayName: "Codex One",
            status: "enabled" as const,
            disabledReason: null,
            metadata: { apiKeyConfigured: true },
            createdAt: 10,
            updatedAt: 100,
          },
        ]),
        listPools: vi.fn(async () => [
          {
            poolId: "pool-codex",
            provider: "codex" as const,
            name: "Codex Default",
            strategy: "round_robin" as const,
            stickyMode: "cache_first" as const,
            preferredAccountId: "codex-a1",
            enabled: true,
            metadata: {},
            createdAt: 10,
            updatedAt: 100,
          },
        ]),
        listPoolMembers: vi.fn(async () => []),
        getPrimaryAccount: vi.fn(async () => ({
          provider: "codex" as const,
          accountId: "codex-a1",
          account: null,
          defaultPoolId: "pool-codex",
          routeAccountId: "codex-a1",
          inSync: true,
          createdAt: 1,
          updatedAt: 1,
        })),
        setPrimaryAccount: vi.fn(async () => ({
          provider: "codex" as const,
          accountId: "codex-a2",
          account: null,
          defaultPoolId: "pool-codex",
          routeAccountId: "codex-a2",
          inSync: true,
          createdAt: 1,
          updatedAt: 2,
        })),
        applyPool: vi.fn(async () => undefined),
        bindPoolAccount: vi.fn(async () => undefined),
        runLogin: vi.fn(async () => ({ authUrl: "", immediateSuccess: true })),
        getAccountInfo: vi.fn(async () => ({ result: { requiresOpenaiAuth: false, plan: "Pro" } })),
        getProvidersCatalog: vi.fn(async () => []),
      },
      models: {
        getModelList: async () => [],
        getConfigModel: async () => null,
      },
      workspaceCatalog: {
        listWorkspaces: vi.fn(async () => [{ id: "w1", name: "Workspace 1", connected: true }]),
      },
      missionControl: {
        readMissionControlSnapshot: vi.fn(async () => ({
          source: "runtime_snapshot_v1" as const,
          generatedAt: 0,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        })),
      },
      agentControl: {
        prepareRuntimeRun: vi.fn(),
        startRuntimeRun: vi.fn(),
        cancelRuntimeJob: vi.fn(),
        resumeRuntimeJob: vi.fn(),
        interveneRuntimeJob: vi.fn(),
        subscribeRuntimeJob: vi.fn(async () => null),
        listRuntimeJobs: vi.fn(async () => []),
        submitRuntimeJobApprovalDecision: vi.fn(),
      },
      threads: {
        listThreads: vi.fn(async () => []),
        createThread: vi.fn(),
        resumeThread: vi.fn(async () => null),
        archiveThread: vi.fn(async () => true),
      },
      git: {
        listChanges: vi.fn(async () => ({ staged: [], unstaged: [] })),
        readDiff: vi.fn(async () => null),
        listBranches: vi.fn(async () => ({ currentBranch: "main", branches: [] })),
        createBranch: vi.fn(async () => ({ ok: true, error: null })),
        checkoutBranch: vi.fn(async () => ({ ok: true, error: null })),
        readLog: vi.fn(async () => ({
          total: 0,
          entries: [],
          ahead: 0,
          behind: 0,
          aheadEntries: [],
          behindEntries: [],
          upstream: null,
        })),
        stageChange: vi.fn(async () => ({ ok: true, error: null })),
        stageAll: vi.fn(async () => ({ ok: true, error: null })),
        unstageChange: vi.fn(async () => ({ ok: true, error: null })),
        revertChange: vi.fn(async () => ({ ok: true, error: null })),
        commit: vi.fn(async () => ({ committed: false, committedCount: 0, error: null })),
      },
      workspaceFiles: {
        listWorkspaceFileEntries: vi.fn(async () => []),
        readWorkspaceFile: vi.fn(async () => null),
      },
      review: {
        listReviewPacks: vi.fn(async () => []),
      },
      runtimeUpdated: {
        subscribeScopedRuntimeUpdatedEvents: subscribeScopedRuntimeUpdatedEventsMock,
      },
    },
    host: {
      platform: "desktop",
      intents: {
        openOauthAuthorizationUrl: async () => undefined,
        createOauthPopupWindow: () => null,
        waitForOauthBinding: async () => true,
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

describe("useSharedAccountCenterState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeScopedRuntimeUpdatedEventsMock.mockReturnValue(() => undefined);
  });

  it("builds provider and workspace summaries from runtime bindings", async () => {
    const bindings = createBindings();
    const { result } = renderHook(() => useSharedAccountCenterState(), {
      wrapper: wrapper(bindings),
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.codex.defaultRouteAccountLabel).toBe("codex-a1@example.com");
      expect(result.current.workspaceAccounts[0]?.planLabel).toBe("Pro");
    });
  });

  it("writes codex default-route updates through runtime oauth bindings", async () => {
    const bindings = createBindings();
    const { result } = renderHook(() => useSharedAccountCenterState(), {
      wrapper: wrapper(bindings),
    });

    await act(async () => {
      await result.current.refresh();
      await result.current.setCodexDefaultRouteAccount("codex-a2");
    });

    expect(bindings.runtime.oauth.setPrimaryAccount).toHaveBeenCalledWith({
      provider: "codex",
      accountId: "codex-a2",
    });
  });

  it("subscribes to oauth runtime updates and refreshes shared state", async () => {
    const bindings = createBindings();
    const { result } = renderHook(() => useSharedAccountCenterState(), {
      wrapper: wrapper(bindings),
    });

    await waitFor(() => {
      expect(subscribeScopedRuntimeUpdatedEventsMock).toHaveBeenCalledTimes(1);
    });

    const firstCall = subscribeScopedRuntimeUpdatedEventsMock.mock.calls[0] as unknown as
      | [{ workspaceId: () => string | null; scopes: string[] }, () => void]
      | undefined;
    const subscription = firstCall?.[0];
    const listener = firstCall?.[1];

    expect(subscription?.scopes).toEqual(["oauth"]);
    expect(subscription?.workspaceId()).toBeNull();
    expect(listener).toBeTypeOf("function");

    await act(async () => {
      listener?.();
      await Promise.resolve();
    });

    expect(bindings.runtime.oauth.listAccounts).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
  });
});
