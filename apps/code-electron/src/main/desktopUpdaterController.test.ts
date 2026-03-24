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
  it("stays intentionally manual for beta releases without a static feed", () => {
    const autoUpdater = createFakeAutoUpdater();
    const configureAutoUpdates = vi.fn();
    const controller = createDesktopUpdaterController({
      appVersion: "0.1.0-beta.1",
      autoUpdater,
      configureAutoUpdates,
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      strategy: {
        capability: "manual",
        message:
          "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
        mode: "disabled_beta_manual",
        provider: "none",
      },
    });

    expect(controller.initialize()).toEqual({
      capability: "manual",
      message:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      mode: "disabled_beta_manual",
      provider: "none",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "0.1.0-beta.1",
    });
    expect(controller.checkForUpdates()).toEqual({
      capability: "manual",
      message:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      mode: "disabled_beta_manual",
      provider: "none",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "0.1.0-beta.1",
    });
    expect(configureAutoUpdates).not.toHaveBeenCalled();
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it("tracks automatic update state transitions for configured providers", () => {
    const autoUpdater = createFakeAutoUpdater();
    const configureAutoUpdates = vi.fn();
    const controller = createDesktopUpdaterController({
      appVersion: "0.1.0-beta.1",
      autoUpdater,
      configureAutoUpdates,
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      strategy: {
        capability: "automatic",
        message: "Automatic beta updates are enabled from the configured static feed.",
        mode: "enabled_beta_static_feed",
        provider: "static-storage",
      },
    });

    expect(controller.initialize()).toEqual({
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "0.1.0-beta.1",
    });
    expect(configureAutoUpdates).toHaveBeenCalledTimes(1);

    expect(controller.checkForUpdates()).toEqual({
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "checking",
      version: "0.1.0-beta.1",
    });
    expect(configureAutoUpdates).toHaveBeenCalledTimes(1);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    autoUpdater.trigger("update-available", { version: "0.1.0-beta.2" });
    expect(controller.getState()).toMatchObject({
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
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

  it("degrades to misconfigured when provider initialization cannot complete", () => {
    const autoUpdater = createFakeAutoUpdater();
    const controller = createDesktopUpdaterController({
      appVersion: "1.0.0",
      autoUpdater,
      configureAutoUpdates: vi.fn(() => false),
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      strategy: {
        capability: "automatic",
        message: "Automatic stable updates are enabled through the public Electron update service.",
        mode: "enabled_stable_public_service",
        provider: "public-github",
      },
    });

    expect(controller.initialize()).toEqual({
      capability: "manual",
      message:
        "Automatic desktop updates are unavailable because the updater provider could not be initialized for this build.",
      mode: "misconfigured",
      provider: "none",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "1.0.0",
    });
    expect(controller.checkForUpdates()).toEqual({
      capability: "manual",
      message:
        "Automatic desktop updates are unavailable because the updater provider could not be initialized for this build.",
      mode: "misconfigured",
      provider: "none",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases",
      stage: "idle",
      version: "1.0.0",
    });
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});
