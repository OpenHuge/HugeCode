import { describe, expect, it, vi } from "vitest";
import { createDesktopUpdaterController } from "./desktopUpdaterController.js";

function createFakeAutoUpdater() {
  const listeners = new Map<string, (...args: unknown[]) => void>();

  return {
    checkForUpdates: vi.fn(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, listener);
    }),
    quitAndInstall: vi.fn(),
    trigger(event: string, ...args: unknown[]) {
      listeners.get(event)?.(...args);
    },
  };
}

describe("desktopUpdaterController", () => {
  it("falls back to manual updates when no beta update feed is configured", () => {
    const controller = createDesktopUpdaterController({
      appVersion: "0.1.0-beta.1",
      autoUpdater: createFakeAutoUpdater(),
      channel: "beta",
      isPackaged: true,
      platform: "darwin",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
    });

    expect(controller.getState()).toEqual({
      capability: "manual",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "0.1.0-beta.1",
    });
    expect(controller.checkForUpdates()).toEqual({
      capability: "manual",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "0.1.0-beta.1",
    });
  });

  it("tracks update state transitions when a static beta feed is configured", () => {
    const autoUpdater = createFakeAutoUpdater();
    const configureAutoUpdates = vi.fn();
    const controller = createDesktopUpdaterController({
      appVersion: "0.1.0-beta.1",
      autoUpdater,
      channel: "beta",
      configureAutoUpdates,
      isPackaged: true,
      platform: "win32",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      staticUpdateBaseUrl: "https://downloads.example.com/hugecode/beta",
    });

    expect(controller.getState()).toEqual({
      capability: "automatic",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "0.1.0-beta.1",
    });

    expect(controller.checkForUpdates()).toEqual({
      capability: "automatic",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "checking",
      version: "0.1.0-beta.1",
    });
    expect(configureAutoUpdates).toHaveBeenCalledWith({
      baseUrl: "https://downloads.example.com/hugecode/beta",
      channel: "beta",
    });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    autoUpdater.trigger("update-available", { version: "0.1.0-beta.2" });
    expect(controller.getState()).toMatchObject({
      capability: "automatic",
      stage: "available",
      version: "0.1.0-beta.2",
    });

    autoUpdater.trigger("download-progress", { total: 100, transferred: 40 });
    expect(controller.getState()).toMatchObject({
      downloadedBytes: 40,
      stage: "downloading",
      totalBytes: 100,
    });

    autoUpdater.trigger("update-downloaded", { version: "0.1.0-beta.2" });
    expect(controller.getState()).toMatchObject({
      stage: "downloaded",
      version: "0.1.0-beta.2",
    });

    expect(controller.restartToApplyUpdate()).toBe(true);
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
