import { describe, expect, it, vi } from "vitest";
import { createDesktopResilienceController } from "./desktopResilienceController.js";

describe("desktopResilienceController", () => {
  it("recovers a crashed renderer and announces the replacement window", () => {
    const notificationController = {
      showDesktopNotification: vi.fn(() => true),
    };
    const logIncident = vi.fn();
    const recoverWindow = vi.fn(() => ({
      focused: false,
      hidden: false,
      sessionId: "desktop-session-1",
      windowId: 202,
      windowLabel: "main" as const,
      workspaceLabel: "alpha",
    }));
    const controller = createDesktopResilienceController({
      isQuitting: () => false,
      logIncident,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      notificationController,
      recoverWindow,
    });

    const replacementWindow = controller.handleRenderProcessGone({
      details: {
        exitCode: 1,
        reason: "crashed",
      },
      session: {
        id: "desktop-session-1",
        lastActiveAt: "2026-03-25T10:00:00.000Z",
        runtimeMode: "local",
        windowLabel: "main",
        workspaceLabel: "alpha",
        workspacePath: "/workspace/alpha",
      },
      windowId: 101,
    });

    expect(recoverWindow).toHaveBeenCalledWith(101);
    expect(replacementWindow).toEqual(
      expect.objectContaining({
        windowId: 202,
      })
    );
    expect(notificationController.showDesktopNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "HugeCode Recovered a Window",
      }),
      expect.objectContaining({
        onClick: expect.any(Function),
      })
    );
    expect(logIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "desktop_render_process_gone",
        level: "warn",
        sessionId: "desktop-session-1",
        windowId: 101,
      })
    );
  });

  it("does not attempt recovery while the app is quitting", () => {
    const recoverWindow = vi.fn();
    const controller = createDesktopResilienceController({
      isQuitting: () => true,
      logIncident: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      notificationController: {
        showDesktopNotification: vi.fn(() => true),
      },
      recoverWindow,
    });

    expect(
      controller.handleRenderProcessGone({
        details: {
          exitCode: 1,
          reason: "crashed",
        },
        session: null,
        windowId: 101,
      })
    ).toBeNull();
    expect(recoverWindow).not.toHaveBeenCalled();
  });

  it("notifies only once while a window stays unresponsive", () => {
    const notificationController = {
      showDesktopNotification: vi.fn(() => true),
    };
    const logIncident = vi.fn();
    const controller = createDesktopResilienceController({
      isQuitting: () => false,
      logIncident,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
      notificationController,
      recoverWindow: vi.fn(() => null),
    });

    expect(
      controller.handleWindowUnresponsive({
        focusWindow: vi.fn(() => true),
        session: null,
        windowId: 303,
      })
    ).toBe(true);
    expect(
      controller.handleWindowUnresponsive({
        focusWindow: vi.fn(() => true),
        session: null,
        windowId: 303,
      })
    ).toBe(false);

    controller.handleWindowResponsive({
      session: null,
      windowId: 303,
    });

    expect(notificationController.showDesktopNotification).toHaveBeenCalledTimes(1);
    expect(logIncident).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: "desktop_window_unresponsive",
        level: "warn",
        windowId: 303,
      })
    );
    expect(logIncident).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: "desktop_window_responsive",
        level: "info",
        windowId: 303,
      })
    );
  });
});
