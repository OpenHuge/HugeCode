import { describe, expect, it, vi } from "vitest";
import { createDesktopHostHandlers } from "./createDesktopHostHandlers.js";

describe("createDesktopHostHandlers", () => {
  it("delegates session, tray, and window handlers to the injected controllers", () => {
    const input = {
      appVersion: "1.2.3",
      browserDebugController: {
        ensureBrowserDebugSession: vi.fn(() => ({ browserUrl: "http://127.0.0.1:9333" })),
        getBrowserDebugSession: vi.fn(() => ({ browserUrl: "http://127.0.0.1:9333" })),
      },
      browserWorkspaceController: {
        ensureBrowserWorkspaceSession: vi.fn(() => ({ sessionId: "ws-1" })),
        getBrowserWorkspaceSession: vi.fn(() => ({ sessionId: "ws-1" })),
        listBrowserWorkspaceSessions: vi.fn(() => [{ sessionId: "ws-1" }]),
        setBrowserWorkspaceAgentAttached: vi.fn(() => ({ sessionId: "ws-1", agentAttached: true })),
        setBrowserWorkspaceDevtoolsOpen: vi.fn(() => ({ sessionId: "ws-1", devtoolsOpen: true })),
        setBrowserWorkspaceHost: vi.fn(() => ({ sessionId: "ws-1", host: "window" })),
        setBrowserWorkspacePreviewServerStatus: vi.fn(() => ({
          sessionId: "ws-1",
          previewServerStatus: "ready",
        })),
        setBrowserWorkspaceProfileMode: vi.fn(() => ({
          sessionId: "ws-1",
          profileMode: "shared",
        })),
      },
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
    expect(handlers.getBrowserDebugSession()).toEqual({ browserUrl: "http://127.0.0.1:9333" });
    expect(handlers.ensureBrowserDebugSession()).toEqual({ browserUrl: "http://127.0.0.1:9333" });
    expect(handlers.getBrowserWorkspaceSession()).toEqual({ sessionId: "ws-1" });
    expect(handlers.ensureBrowserWorkspaceSession()).toEqual({ sessionId: "ws-1" });
    expect(handlers.listBrowserWorkspaceSessions()).toEqual([{ sessionId: "ws-1" }]);
    expect(handlers.setBrowserWorkspaceHost({ sessionId: "ws-1", host: "window" })).toEqual({
      sessionId: "ws-1",
      host: "window",
    });
    expect(handlers.getCurrentSession({ sender: {} as never })).toEqual({ id: "session-1" });
    expect(handlers.getWindowLabel({ sender: {} as never })).toBe("main");
    expect(handlers.listRecentSessions()).toEqual([{ id: "session-1" }]);
    expect(handlers.listWindows()).toEqual([{ windowId: 1 }]);
    expect(handlers.openWindow()).toEqual({ windowId: 1 });
    expect(handlers.reopenSession("session-1")).toBe(true);
    expect(handlers.closeWindow(1)).toBe(true);
    expect(handlers.focusWindow(1)).toBe(true);
    expect(handlers.getTrayState()).toEqual({ enabled: true, supported: true });
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
      browserDebugController: {
        ensureBrowserDebugSession: vi.fn(() => null),
        getBrowserDebugSession: vi.fn(() => null),
      },
      browserWorkspaceController: {
        ensureBrowserWorkspaceSession: vi.fn(() => null),
        getBrowserWorkspaceSession: vi.fn(() => null),
        listBrowserWorkspaceSessions: vi.fn(() => []),
        setBrowserWorkspaceAgentAttached: vi.fn(() => null),
        setBrowserWorkspaceDevtoolsOpen: vi.fn(() => null),
        setBrowserWorkspaceHost: vi.fn(() => null),
        setBrowserWorkspacePreviewServerStatus: vi.fn(() => null),
        setBrowserWorkspaceProfileMode: vi.fn(() => null),
      },
      listRecentSessions: vi.fn(() => []),
      notificationController: {
        showNotification: vi.fn(() => false),
      },
      openExternalUrl: vi.fn(async () => true),
      persistTrayEnabled,
      revealItemInDir: vi.fn(() => true),
      trayController,
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
