import { describe, expect, it } from "vitest";
import {
  type DesktopAppInfo,
  type DesktopLaunchIntent,
  type DesktopUpdateState,
  isElectronDesktopHostBridge,
} from "./index";

describe("code-platform-interfaces", () => {
  it("recognizes the supported electron bridge kind", () => {
    expect(isElectronDesktopHostBridge({ kind: "electron" })).toBe(true);
  });

  it("rejects missing or unsupported bridge kinds", () => {
    expect(isElectronDesktopHostBridge(null)).toBe(false);
    expect(isElectronDesktopHostBridge({ kind: "electron-legacy" })).toBe(false);
    expect(isElectronDesktopHostBridge({})).toBe(false);
  });

  it("supports the public beta app, launch, and updater contracts", () => {
    const appInfo: DesktopAppInfo = {
      channel: "beta",
      platform: "darwin",
      updateCapability: "automatic",
      updateMessage: "Automatic beta updates are enabled from the configured static feed.",
      updateMode: "enabled_beta_static_feed",
      version: "0.1.0-beta.1",
    };
    const launchIntent: DesktopLaunchIntent = {
      kind: "protocol",
      receivedAt: "2026-03-24T00:00:00.000Z",
      url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
    };
    const workspaceLaunchIntent: DesktopLaunchIntent = {
      kind: "workspace",
      launchPath: "/workspace/alpha/src/main.ts",
      launchPathKind: "file",
      receivedAt: "2026-03-24T00:00:00.000Z",
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    };
    const updateState: DesktopUpdateState = {
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases/tag/v0.1.0-beta.2",
      stage: "available",
      version: "0.1.0-beta.2",
    };

    expect(appInfo.channel).toBe("beta");
    expect(launchIntent.kind).toBe("protocol");
    expect(workspaceLaunchIntent.launchPathKind).toBe("file");
    expect(workspaceLaunchIntent.workspacePath).toBe("/workspace/alpha");
    expect(updateState.stage).toBe("available");
  });
});
