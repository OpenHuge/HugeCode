import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  createDesktopWorkspaceClientBindings,
  createDesktopWorkspaceClientHostBindings,
  createWebWorkspaceClientBindings,
  createWorkspaceClientBindings,
} from "./workspaceClientBindings";

const { workspaceRuntimeShellMock } = vi.hoisted(() => ({
  workspaceRuntimeShellMock: () => null,
}));

vi.mock("@ku0/code-workspace-client/runtime-shell", () => ({
  WorkspaceRuntimeShell: workspaceRuntimeShellMock,
}));

describe("workspaceClientBindings", () => {
  it("creates web workspace bindings with shared browser defaults and injected shell UI", () => {
    const navigation = {
      readRouteSelection: vi.fn(() => ({ kind: "home" as const })),
      subscribeRouteSelection: vi.fn(() => () => undefined),
      navigateToWorkspace: vi.fn(),
      navigateToSection: vi.fn(),
      navigateHome: vi.fn(),
    };
    const WorkspaceApp = () => null;
    const Provider = ({ children }: PropsWithChildren) =>
      createElement("section", { "data-provider": "web" }, children);
    const Effect = () => createElement("span", { "data-effect": "web" });

    const bindings = createWebWorkspaceClientBindings({
      navigation,
      WorkspaceApp,
      settingsShellFraming: {
        kickerLabel: "Gateway session",
        contextLabel: "Web workspace",
        title: "Workspace settings",
        subtitle: "Browser defaults for the connected runtime session.",
      },
      hostProviders: [Provider],
      hostEffects: [Effect],
    });

    expect(bindings.navigation).toBe(navigation);
    expect(bindings.host.platform).toBe("web");
    expect(bindings.host.shell.platformHint).toBe("web");
    expect(bindings.platformUi.WorkspaceApp).toBe(WorkspaceApp);
    expect(bindings.platformUi.WorkspaceRuntimeShell).toBe(workspaceRuntimeShellMock);

    const markup = renderToStaticMarkup(
      bindings.platformUi.renderWorkspaceHost(createElement("div", null, "workspace-host"))
    );

    expect(markup).toContain('data-provider="web"');
    expect(markup).toContain('data-effect="web"');
    expect(markup).toContain("workspace-host");
  });

  it("creates host bindings that delegate desktop intents and notifications", async () => {
    const openExternalUrl = vi.fn();
    const waitForOauthBinding = vi.fn(async () => true);
    const testSystemNotification = vi.fn();
    const createOauthPopupWindow = vi.fn(() => null);
    const testSound = vi.fn();

    const bindings = createDesktopWorkspaceClientHostBindings({
      openExternalUrl,
      waitForOauthBinding,
      testSystemNotification,
      createOauthPopupWindow,
      testSound,
      platformHint: "electron",
    });

    await bindings.intents.openOauthAuthorizationUrl("https://example.com", null);
    await expect(bindings.intents.waitForOauthBinding("workspace-a", 42)).resolves.toBe(true);
    bindings.intents.createOauthPopupWindow();
    bindings.notifications.testSound();
    bindings.notifications.testSystemNotification();

    expect(bindings.platform).toBe("desktop");
    expect(bindings.shell.platformHint).toBe("electron");
    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(waitForOauthBinding).toHaveBeenCalledWith("workspace-a", 42);
    expect(createOauthPopupWindow).toHaveBeenCalledTimes(1);
    expect(testSound).toHaveBeenCalledTimes(1);
    expect(testSystemNotification).toHaveBeenCalledTimes(1);
  });

  it("creates desktop workspace bindings with shared host rendering and desktop intents", async () => {
    const openExternalUrl = vi.fn();
    const waitForOauthBinding = vi.fn(async () => true);
    const testSystemNotification = vi.fn();
    const WorkspaceApp = () => null;
    const DesktopRuntimeShell = () => null;
    const Provider = ({ children }: PropsWithChildren) =>
      createElement("main", { "data-provider": "desktop" }, children);
    const Effect = () => createElement("span", { "data-effect": "desktop" });
    const navigation = {
      readRouteSelection: vi.fn(() => ({ kind: "home" as const })),
      subscribeRouteSelection: vi.fn(() => () => undefined),
      navigateToWorkspace: vi.fn(),
      navigateToSection: vi.fn(),
      navigateHome: vi.fn(),
    };
    const runtimeGateway = {
      readRuntimeMode: vi.fn(() => "connected" as const),
      subscribeRuntimeMode: vi.fn(() => () => undefined),
      discoverLocalRuntimeGatewayTargets: vi.fn(async () => []),
      configureManualWebRuntimeGatewayTarget: vi.fn(),
    };
    const runtime = {
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
    };

    const bindings = createDesktopWorkspaceClientBindings({
      navigation,
      runtimeGateway,
      runtime,
      openExternalUrl,
      waitForOauthBinding,
      testSystemNotification,
      WorkspaceApp,
      WorkspaceRuntimeShell: DesktopRuntimeShell,
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
    expect(bindings.runtimeGateway).toBe(runtimeGateway);
    expect(bindings.runtime).toBe(runtime);
    expect(bindings.host.platform).toBe("desktop");
    expect(bindings.host.shell.platformHint).toBe("electron");
    expect(bindings.platformUi.WorkspaceApp).toBe(WorkspaceApp);
    expect(bindings.platformUi.WorkspaceRuntimeShell).toBe(DesktopRuntimeShell);

    await bindings.host.intents.openOauthAuthorizationUrl("https://example.com", null);
    await expect(bindings.host.intents.waitForOauthBinding("workspace-a", 7)).resolves.toBe(true);
    bindings.host.notifications.testSystemNotification();

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(waitForOauthBinding).toHaveBeenCalledWith("workspace-a", 7);
    expect(testSystemNotification).toHaveBeenCalledTimes(1);

    const markup = renderToStaticMarkup(
      bindings.platformUi.renderWorkspaceHost(createElement("div", null, "desktop-host"))
    );

    expect(markup).toContain('data-provider="desktop"');
    expect(markup).toContain('data-effect="desktop"');
    expect(markup).toContain("desktop-host");
  });

  it("creates workspace client bindings without reshaping the runtime surfaces", () => {
    const navigation = {
      navigateToSettings: vi.fn(),
      replaceWorkspaceSelection: vi.fn(),
    };
    const runtimeGateway = {
      readRuntimeMode: vi.fn(() => "connected"),
      subscribeRuntimeMode: vi.fn(() => () => undefined),
      discoverLocalRuntimeGatewayTargets: vi.fn(async () => []),
      configureManualWebRuntimeGatewayTarget: vi.fn(),
    };
    const runtime = {
      missionControl: { readMissionControlSnapshot: vi.fn(async () => null) },
      kernelProjection: undefined,
      settings: {
        getAppSettings: vi.fn(async () => ({})),
        updateAppSettings: vi.fn(async () => ({})),
      },
      models: { getModelList: vi.fn(async () => []) },
    };
    const host = createDesktopWorkspaceClientHostBindings({
      openExternalUrl: vi.fn(),
      waitForOauthBinding: vi.fn(async () => false),
      testSystemNotification: vi.fn(),
    });
    const platformUi = {
      WorkspaceRuntimeShell: () => null,
      WorkspaceApp: () => null,
      renderWorkspaceHost: (children: unknown) => children,
      settingsShellFraming: {
        kickerLabel: "Desktop",
        contextLabel: "Workspace",
        title: "Workspace settings",
        subtitle: "Desktop defaults",
      },
    };

    const bindings = createWorkspaceClientBindings({
      navigation,
      runtimeGateway,
      runtime,
      host,
      platformUi,
    });

    expect(bindings.navigation).toBe(navigation);
    expect(bindings.runtimeGateway).toBe(runtimeGateway);
    expect(bindings.runtime).toBe(runtime);
    expect(bindings.host).toBe(host);
    expect(bindings.platformUi).toBe(platformUi);
  });
});
