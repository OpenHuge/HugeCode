// @vitest-environment jsdom

import { lazy } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsShellFraming, WorkspaceClientBindings } from "../index";
import { WorkspaceClientApp } from "./WorkspaceClientApp";
import { WorkspaceClientBindingsProvider } from "./WorkspaceClientBindingsProvider";

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Appearance, projects, runtime, and Codex defaults for this app.",
};

function createBindings(
  runtimeMode: WorkspaceClientBindings["runtimeGateway"]["readRuntimeMode"] extends () => infer T
    ? T
    : never,
  discoverLocalRuntimeGatewayTargets = vi.fn(async () => []),
  hostPlatform: WorkspaceClientBindings["host"]["platform"] = "web"
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
      readRuntimeMode: () => runtimeMode,
      subscribeRuntimeMode: () => () => undefined,
      discoverLocalRuntimeGatewayTargets,
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
          source: "runtime_snapshot_v1",
          generatedAt: 0,
          workspaces: [],
          tasks: [],
          runs: [],
          reviewPacks: [],
        }),
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
      platform: hostPlatform,
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
      WorkspaceRuntimeShell: function RuntimeShell() {
        return <div data-testid="runtime-shell">Runtime shell</div>;
      },
      WorkspaceApp: function WorkspaceSurface() {
        return <div>Workspace surface</div>;
      },
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
  };
}

describe("WorkspaceClientApp", () => {
  it("renders the runtime shell when the runtime is already connected", async () => {
    render(
      <WorkspaceClientBindingsProvider bindings={createBindings("connected")}>
        <WorkspaceClientApp />
      </WorkspaceClientBindingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-shell")).toBeTruthy();
    });
  });

  it("renders the boot fallback while a lazy runtime shell is still loading", async () => {
    let resolveRuntimeShell: (() => void) | null = null;
    const LazyRuntimeShell = lazy(
      async () =>
        await new Promise<{
          default: WorkspaceClientBindings["platformUi"]["WorkspaceRuntimeShell"];
        }>((resolve) => {
          resolveRuntimeShell = () => {
            resolve({
              default: function RuntimeShell() {
                return <div data-testid="runtime-shell">Lazy runtime shell</div>;
              },
            });
          };
        })
    );

    const bindings = createBindings("connected");
    bindings.platformUi.WorkspaceRuntimeShell = LazyRuntimeShell;

    render(
      <WorkspaceClientBindingsProvider bindings={bindings}>
        <WorkspaceClientApp
          bootFallback={<div data-testid="boot-fallback">Loading runtime shell…</div>}
        />
      </WorkspaceClientBindingsProvider>
    );

    expect(screen.getByTestId("boot-fallback")).toBeTruthy();

    const runtimeShellResolver = resolveRuntimeShell as (() => void) | null;
    if (!runtimeShellResolver) {
      throw new Error("Lazy runtime shell resolver was not initialized.");
    }
    (runtimeShellResolver as () => void)();

    await waitFor(() => {
      expect(screen.getByTestId("runtime-shell")).toBeTruthy();
    });
  });

  it("treats discoverable runtimes as a pre-connect state and probes local targets", async () => {
    const discoverLocalRuntimeGatewayTargets = vi.fn(async () => []);

    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings("discoverable", discoverLocalRuntimeGatewayTargets)}
      >
        <WorkspaceClientApp />
      </WorkspaceClientBindingsProvider>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Connect a runtime to open the workspace.",
      })
    ).toBeTruthy();
    await waitFor(() => {
      expect(discoverLocalRuntimeGatewayTargets).toHaveBeenCalledTimes(1);
    });
  });

  it("renders the runtime shell for desktop hosts even before the runtime reconnects", async () => {
    render(
      <WorkspaceClientBindingsProvider
        bindings={createBindings(
          "unavailable",
          vi.fn(async () => []),
          "desktop"
        )}
      >
        <WorkspaceClientApp />
      </WorkspaceClientBindingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-shell")).toBeTruthy();
    });
    expect(
      screen.queryByRole("heading", {
        name: "Connect a runtime to open the workspace.",
      })
    ).toBeNull();
  });
});
