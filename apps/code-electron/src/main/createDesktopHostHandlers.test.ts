import { describe, expect, it, vi } from "vitest";
import { createDesktopHostHandlers } from "./createDesktopHostHandlers.js";

describe("createDesktopHostHandlers", () => {
  it("delegates session, tray, and window handlers to the injected controllers", () => {
    const input = {
      appVersion: "1.2.3",
      consumePendingLaunchIntent: vi.fn(() => ({
        kind: "protocol" as const,
        receivedAt: "2026-03-24T00:00:00.000Z",
        url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
      })),
      getAppInfo: vi.fn(() => ({
        channel: "beta" as const,
        platform: "darwin" as const,
        updateCapability: "automatic" as const,
        updateMessage: "Automatic beta updates are enabled from the configured static feed.",
        updateMode: "enabled_beta_static_feed" as const,
        version: "1.2.3",
      })),
      listRecentSessions: vi.fn(() => [{ id: "session-1" }]),
      notificationController: {
        showNotification: vi.fn(() => true),
      },
      openExternalUrl: vi.fn(async () => true),
      persistTrayEnabled: vi.fn(),
      revealItemInDir: vi.fn(() => true),
      trayController: {
        getState: vi.fn(() => ({ enabled: true, supported: true })),
        update: vi.fn(),
      },
      updaterController: {
        checkForUpdates: vi.fn(() => ({
          capability: "automatic" as const,
          mode: "enabled_beta_static_feed" as const,
          provider: "static-storage" as const,
          stage: "checking" as const,
        })),
        getState: vi.fn(() => ({
          capability: "automatic" as const,
          mode: "enabled_beta_static_feed" as const,
          provider: "static-storage" as const,
          stage: "available" as const,
          version: "1.2.4",
        })),
        restartToApplyUpdate: vi.fn(() => true),
      },
      windowController: {
        closeWindow: vi.fn(() => true),
        focusWindow: vi.fn(() => true),
        getSessionForWebContents: vi.fn(() => ({ id: "session-1" })),
        getWindowLabelForWebContents: vi.fn(() => "main"),
        listWindows: vi.fn(() => [{ windowId: 1 }]),
        openWindow: vi.fn(() => ({ windowId: 1 })),
        reopenSession: vi.fn(() => true),
      },
    };

    const handlers = createDesktopHostHandlers(input);

    expect(handlers.getAppVersion()).toBe("1.2.3");
    expect(handlers.getAppInfo()).toEqual({
      channel: "beta",
      platform: "darwin",
      updateCapability: "automatic",
      updateMessage: "Automatic beta updates are enabled from the configured static feed.",
      updateMode: "enabled_beta_static_feed",
      version: "1.2.3",
    });
    expect(handlers.getCurrentSession({ sender: {} as never })).toEqual({ id: "session-1" });
    expect(handlers.getWindowLabel({ sender: {} as never })).toBe("main");
    expect(handlers.consumePendingLaunchIntent()).toEqual({
      kind: "protocol",
      receivedAt: "2026-03-24T00:00:00.000Z",
      url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
    });
    expect(handlers.listRecentSessions()).toEqual([{ id: "session-1" }]);
    expect(handlers.listWindows()).toEqual([{ windowId: 1 }]);
    expect(handlers.openWindow()).toEqual({ windowId: 1 });
    expect(handlers.reopenSession("session-1")).toBe(true);
    expect(handlers.closeWindow(1)).toBe(true);
    expect(handlers.focusWindow(1)).toBe(true);
    expect(handlers.getTrayState()).toEqual({ enabled: true, supported: true });
    expect(handlers.getUpdateState()).toEqual({
      capability: "automatic",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      stage: "available",
      version: "1.2.4",
    });
    expect(handlers.checkForUpdates()).toEqual({
      capability: "automatic",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      stage: "checking",
    });
    expect(handlers.restartToApplyUpdate()).toBe(true);
    expect(handlers.showNotification({ sender: {} as never }, { title: "Build complete" })).toBe(
      true
    );
  });

  it("persists tray state and refreshes the tray when toggled", () => {
    const persistTrayEnabled = vi.fn();
    const trayController = {
      getState: vi.fn(() => ({ enabled: false, supported: true })),
      update: vi.fn(),
    };
    const handlers = createDesktopHostHandlers({
      appVersion: null,
      consumePendingLaunchIntent: vi.fn(() => null),
      getAppInfo: vi.fn(() => ({
        channel: "beta" as const,
        platform: "darwin" as const,
        updateCapability: "manual" as const,
        updateMessage:
          "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
        updateMode: "disabled_beta_manual" as const,
        version: null,
      })),
      listRecentSessions: vi.fn(() => []),
      notificationController: {
        showNotification: vi.fn(() => false),
      },
      openExternalUrl: vi.fn(async () => true),
      persistTrayEnabled,
      revealItemInDir: vi.fn(() => true),
      trayController,
      updaterController: {
        checkForUpdates: vi.fn(() => ({
          capability: "manual",
          message:
            "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
          mode: "disabled_beta_manual",
          provider: "none",
          stage: "idle",
        })),
        getState: vi.fn(() => ({
          capability: "manual",
          message:
            "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
          mode: "disabled_beta_manual",
          provider: "none",
          stage: "idle",
        })),
        restartToApplyUpdate: vi.fn(() => false),
      },
      windowController: {
        closeWindow: vi.fn(),
        focusWindow: vi.fn(),
        getSessionForWebContents: vi.fn(),
        getWindowLabelForWebContents: vi.fn(() => "main"),
        listWindows: vi.fn(() => []),
        openWindow: vi.fn(() => null),
        reopenSession: vi.fn(() => false),
      },
    });

    expect(handlers.setTrayEnabled(true)).toEqual({
      enabled: false,
      supported: true,
    });
    expect(persistTrayEnabled).toHaveBeenCalledWith(true);
    expect(trayController.update).toHaveBeenCalledTimes(1);
  });
});
