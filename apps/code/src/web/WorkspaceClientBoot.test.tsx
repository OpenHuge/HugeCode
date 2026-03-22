import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ManualWebRuntimeGatewayTarget,
  SettingsShellFraming,
  WorkspaceClientBindings,
} from "@ku0/code-workspace-client";
import { WorkspaceClientBoot } from "@ku0/code-workspace-client";

const workspaceClientEntrySource = readFileSync(
  resolve(import.meta.dirname, "./WorkspaceClientEntry.css.ts"),
  "utf8"
);

const desktopSettingsShellFraming: SettingsShellFraming = {
  kickerLabel: "Preferences",
  contextLabel: "Desktop app",
  title: "Settings",
  subtitle: "Appearance, projects, runtime, and Codex defaults for this app.",
};

function createBindings(overrides: Partial<WorkspaceClientBindings> = {}): WorkspaceClientBindings {
  const readRuntimeMode = vi.fn(() => "connected" as const);
  const discoverLocalRuntimeGatewayTargets = vi.fn(async () => []);
  const configureManualWebRuntimeGatewayTarget = vi.fn(
    (_target: ManualWebRuntimeGatewayTarget) => undefined
  );
  const RuntimeShell = () => <div data-testid="workspace-runtime-shell">Workspace shell</div>;

  return {
    navigation: {
      readRouteSelection: () => ({ kind: "home" }),
      subscribeRouteSelection: () => () => undefined,
      navigateToWorkspace: () => undefined,
      navigateToSection: () => undefined,
      navigateHome: () => undefined,
    },
    runtimeGateway: {
      readRuntimeMode,
      subscribeRuntimeMode: () => () => undefined,
      discoverLocalRuntimeGatewayTargets,
      configureManualWebRuntimeGatewayTarget,
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
      WorkspaceRuntimeShell: RuntimeShell,
      WorkspaceApp: () => null,
      renderWorkspaceHost: (children) => children,
      settingsShellFraming: desktopSettingsShellFraming,
    },
    ...overrides,
  };
}

describe("WorkspaceClientBoot", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads the runtime shell from injected bindings when a runtime target is available", async () => {
    render(<WorkspaceClientBoot bindings={createBindings()} />);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-runtime-shell")).toBeTruthy();
    });
  });

  it("renders the runtime shell for the desktop host while the runtime is unavailable", async () => {
    render(
      <WorkspaceClientBoot
        bindings={createBindings({
          runtimeGateway: {
            readRuntimeMode: () => "unavailable",
            subscribeRuntimeMode: () => () => undefined,
            discoverLocalRuntimeGatewayTargets: async () => [],
            configureManualWebRuntimeGatewayTarget: vi.fn(),
          },
        })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("workspace-runtime-shell")).toBeTruthy();
    });
    expect(
      screen.queryByRole("heading", {
        name: "Connect a runtime to open the workspace.",
      })
    ).toBeNull();
  });

  it("keeps the boot shell background neutral", () => {
    expect(workspaceClientEntrySource).not.toContain("radial-gradient(circle at top");
  });
});
