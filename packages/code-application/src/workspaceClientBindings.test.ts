import { describe, expect, it, vi } from "vitest";
import {
  createDesktopWorkspaceClientHostBindings,
  createWorkspaceClientBindings,
} from "./workspaceClientBindings";

describe("workspaceClientBindings", () => {
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
      settingsShellFraming: { mode: "sidebar" as const },
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
