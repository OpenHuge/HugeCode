import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDesktopWorkspaceBootstrap } from "./desktopWorkspaceBootstrap";

const { workspaceRuntimeShellMock } = vi.hoisted(() => ({
  workspaceRuntimeShellMock: () => null,
}));

vi.mock("@ku0/code-workspace-client/runtime-shell", () => ({
  WorkspaceRuntimeShell: workspaceRuntimeShellMock,
}));

const navigation = {
  readRouteSelection: vi.fn(() => ({ kind: "home" as const })),
  subscribeRouteSelection: vi.fn(() => () => undefined),
  navigateToWorkspace: vi.fn(),
  navigateToSection: vi.fn(),
  navigateHome: vi.fn(),
};

describe("desktopWorkspaceBootstrap", () => {
  it("hydrates desktop workspace bindings from a runtime kernel and host adapters", async () => {
    const openExternalUrl = vi.fn();
    const waitForOauthBinding = vi.fn(async () => true);
    const testSystemNotification = vi.fn();
    const readShellStartupStatus = vi.fn(async () => ({
      tone: "ready" as const,
      label: "Desktop ready",
      detail: "Startup checks passed.",
    }));
    const WorkspaceApp = () => null;
    const Provider = ({ children }: PropsWithChildren) =>
      createElement("main", { "data-provider": "desktop-bootstrap" }, children);
    const Effect = () => createElement("span", { "data-effect": "desktop-bootstrap" });
    const runtimeKernel = {
      workspaceClientRuntimeGateway: {
        readRuntimeMode: vi.fn(() => "connected" as const),
        subscribeRuntimeMode: vi.fn(() => () => undefined),
        discoverLocalRuntimeGatewayTargets: vi.fn(async () => []),
        configureManualWebRuntimeGatewayTarget: vi.fn(),
      },
      workspaceClientRuntime: {
        surface: "shared-workspace-client" as const,
        settings: {
          getAppSettings: vi.fn(async () => ({})),
          updateAppSettings: vi.fn(async () => ({})),
          syncRuntimeGatewayProfileFromAppSettings: vi.fn(),
        },
        oauth: {
          listAccounts: vi.fn(async () => []),
          listPools: vi.fn(async () => []),
          listPoolMembers: vi.fn(async () => []),
          getPrimaryAccount: vi.fn(async () => null),
          setPrimaryAccount: vi.fn(),
          applyPool: vi.fn(),
          bindPoolAccount: vi.fn(),
          runLogin: vi.fn(),
          getAccountInfo: vi.fn(),
          getProvidersCatalog: vi.fn(),
        },
        models: {
          getModelList: vi.fn(async () => []),
          getConfigModel: vi.fn(),
        },
        workspaceCatalog: {
          listWorkspaces: vi.fn(async () => []),
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
          subscribeRuntimeJob: vi.fn(),
          listRuntimeJobs: vi.fn(),
          submitRuntimeJobApprovalDecision: vi.fn(),
        },
        threads: {
          listThreads: vi.fn(async () => []),
          createThread: vi.fn(),
          resumeThread: vi.fn(),
          archiveThread: vi.fn(),
        },
        git: {
          listChanges: vi.fn(),
          readDiff: vi.fn(),
          listBranches: vi.fn(),
          createBranch: vi.fn(),
          checkoutBranch: vi.fn(),
          readLog: vi.fn(),
          stageChange: vi.fn(),
          stageAll: vi.fn(),
          unstageChange: vi.fn(),
          revertChange: vi.fn(),
          commit: vi.fn(),
        },
        workspaceFiles: {
          listWorkspaceFileEntries: vi.fn(async () => []),
          readWorkspaceFile: vi.fn(async () => null),
        },
        review: {
          listReviewPacks: vi.fn(async () => []),
        },
      },
    };

    const bindings = createDesktopWorkspaceBootstrap({
      navigation,
      runtimeKernel,
      openExternalUrl,
      waitForOauthBinding,
      testSystemNotification,
      readShellStartupStatus,
      WorkspaceApp,
      settingsShellFraming: {
        kickerLabel: "Desktop",
        contextLabel: "Workspace",
        title: "Workspace settings",
        subtitle: "Desktop defaults",
      },
      hostProviders: [Provider],
      hostEffects: [Effect],
      platformHint: "electron",
    });

    expect(bindings.navigation).toBe(navigation);
    expect(bindings.runtimeGateway).toBe(runtimeKernel.workspaceClientRuntimeGateway);
    expect(bindings.runtime).toBe(runtimeKernel.workspaceClientRuntime);
    expect(bindings.platformUi.WorkspaceApp).toBe(WorkspaceApp);
    expect(bindings.host.shell.platformHint).toBe("electron");

    await bindings.host.intents.openOauthAuthorizationUrl("https://example.com", null);
    await expect(bindings.host.intents.waitForOauthBinding("workspace-a", 11)).resolves.toBe(true);
    await expect(bindings.host.shell.readStartupStatus?.()).resolves.toEqual({
      tone: "ready",
      label: "Desktop ready",
      detail: "Startup checks passed.",
    });

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(waitForOauthBinding).toHaveBeenCalledWith("workspace-a", 11);
    expect(testSystemNotification).not.toHaveBeenCalled();

    const markup = renderToStaticMarkup(
      bindings.platformUi.renderWorkspaceHost(createElement("div", null, "workspace-host"))
    );

    expect(markup).toContain('data-provider="desktop-bootstrap"');
    expect(markup).toContain('data-effect="desktop-bootstrap"');
    expect(markup).toContain("workspace-host");
  });
});
