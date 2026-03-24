import { describe, expect, it, vi } from "vitest";
import { createDesktopShellState, type DesktopWindowBounds } from "./desktopShellState.js";
import { createDesktopWindowController } from "./desktopWindowController.js";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";

type WindowEventMap = {
  close: (event: { preventDefault(): void }) => void;
  closed: () => void;
  focus: () => void;
  responsive: () => void;
  unresponsive: () => void;
};

function createFakeBrowserWindow(id: number, bounds: DesktopWindowBounds) {
  const listeners: {
    [Key in keyof WindowEventMap]?: WindowEventMap[Key][];
  } = {};
  let windowOpenHandler: ((details: { url: string }) => { action: "deny" }) | null = null;
  const webContentsListeners: {
    "render-process-gone"?: Array<
      (_event: unknown, details: { exitCode: number; reason: string }) => void
    >;
    "will-navigate"?: Array<(event: { preventDefault(): void }, url: string) => void>;
  } = {};
  let destroyed = false;
  let focused = false;
  let minimized = false;
  let visible = false;

  const webContents = {
    on: vi.fn(
      (
        event: "render-process-gone" | "will-navigate",
        listener:
          | ((_event: unknown, details: { exitCode: number; reason: string }) => void)
          | ((event: { preventDefault(): void }, url: string) => void)
      ) => {
        webContentsListeners[event] ??= [];
        webContentsListeners[event]?.push(listener as never);
      }
    ),
    send: vi.fn(),
    setWindowOpenHandler: vi.fn((handler: (details: { url: string }) => { action: "deny" }) => {
      windowOpenHandler = handler;
    }),
  };

  return {
    close: vi.fn(),
    destroy: vi.fn(() => {
      destroyed = true;
    }),
    focus: vi.fn(() => {
      focused = true;
      visible = true;
    }),
    getBounds: vi.fn(() => bounds),
    hide: vi.fn(() => {
      visible = false;
    }),
    id,
    isDestroyed: vi.fn(() => destroyed),
    isFocused: vi.fn(() => focused),
    isMinimized: vi.fn(() => minimized),
    isVisible: vi.fn(() => visible),
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    once: vi.fn((event: "ready-to-show", listener: () => void) => {
      if (event === "ready-to-show") {
        listener();
      }
    }),
    on: vi.fn(<Key extends keyof WindowEventMap>(event: Key, listener: WindowEventMap[Key]) => {
      listeners[event] ??= [];
      listeners[event]?.push(listener);
    }),
    restore: vi.fn(() => {
      minimized = false;
    }),
    setDestroyed(nextDestroyed: boolean) {
      destroyed = nextDestroyed;
    },
    setFocused(nextFocused: boolean) {
      focused = nextFocused;
    },
    setMinimized(nextMinimized: boolean) {
      minimized = nextMinimized;
    },
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
    },
    show: vi.fn(() => {
      visible = true;
    }),
    webContents,
    emitClose(event: { preventDefault(): void }) {
      listeners.close?.forEach((listener) => {
        listener(event);
      });
    },
    emitClosed() {
      listeners.closed?.forEach((listener) => {
        listener();
      });
    },
    emitFocus() {
      listeners.focus?.forEach((listener) => {
        listener();
      });
    },
    emitWindowOpen(url: string) {
      return windowOpenHandler?.({ url }) ?? null;
    },
    emitWillNavigate(url: string, event = { preventDefault: vi.fn() }) {
      webContentsListeners["will-navigate"]?.forEach((listener) => {
        listener(event, url);
      });
      return event;
    },
    emitRenderProcessGone(details: { exitCode: number; reason: string }) {
      webContentsListeners["render-process-gone"]?.forEach((listener) => {
        listener({}, details);
      });
    },
    emitResponsive() {
      listeners.responsive?.forEach((listener) => {
        listener();
      });
    },
    emitUnresponsive() {
      listeners.unresponsive?.forEach((listener) => {
        listener();
      });
    },
  };
}

describe("desktopWindowController", () => {
  it("opens a resolved session and returns a window descriptor", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const fakeWindow = createFakeBrowserWindow(101, {
      height: 900,
      width: 1400,
    });
    const loadRenderer = vi.fn();
    const persistState = vi.fn();
    const notifyWindowsChanged = vi.fn();
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => [fakeWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => false,
      loadRenderer,
      notifyWindowsChanged,
      openExternalUrl: vi.fn(),
      persistState,
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    const descriptor = controller.openWindow({
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    });

    expect(descriptor).toEqual({
      focused: false,
      hidden: false,
      sessionId: "desktop-session-1",
      windowId: 101,
      windowLabel: "main",
      workspaceLabel: "alpha",
    });
    expect(loadRenderer).toHaveBeenCalledWith(fakeWindow);
    expect(persistState).toHaveBeenCalled();
    expect(notifyWindowsChanged).toHaveBeenCalled();
  });

  it("hides the last window instead of closing when tray mode is enabled", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: true,
      },
    });
    const fakeWindow = createFakeBrowserWindow(201, {
      height: 900,
      width: 1400,
    });
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => [fakeWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => false,
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      openExternalUrl: vi.fn(),
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    controller.openWindow();
    const preventDefault = vi.fn();

    fakeWindow.emitClose({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(fakeWindow.hide).toHaveBeenCalledTimes(1);
    expect(controller.listWindows()).toEqual([
      expect.objectContaining({
        hidden: true,
        windowId: 201,
      }),
    ]);
  });

  it("restores and focuses an existing live window", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const fakeWindow = createFakeBrowserWindow(301, {
      height: 900,
      width: 1400,
    });
    fakeWindow.setMinimized(true);
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => [fakeWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => false,
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      openExternalUrl: vi.fn(),
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    controller.openWindow();

    expect(controller.restoreVisibleWindow()).toBe(true);
    expect(fakeWindow.restore).toHaveBeenCalledTimes(1);
    expect(fakeWindow.show).toHaveBeenCalled();
    expect(fakeWindow.focus).toHaveBeenCalled();
  });

  it("blocks untrusted navigation and only opens safe external urls", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const fakeWindow = createFakeBrowserWindow(401, {
      height: 900,
      width: 1400,
    });
    const openExternalUrl = vi.fn();
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => [fakeWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: (url) => url.startsWith("https://"),
      isQuitting: () => false,
      isTrustedRendererUrl: (url) => url.startsWith("file://"),
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      openExternalUrl,
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    controller.openWindow();

    expect(fakeWindow.emitWindowOpen("https://example.com")).toEqual({ action: "deny" });
    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");

    const safeNavigationEvent = fakeWindow.emitWillNavigate("https://example.com");
    expect(safeNavigationEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");

    const unsafeNavigationEvent = fakeWindow.emitWillNavigate("javascript:alert(1)");
    expect(unsafeNavigationEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternalUrl).toHaveBeenCalledTimes(2);

    const trustedNavigationEvent = fakeWindow.emitWillNavigate("file:///tmp/index.html");
    expect(trustedNavigationEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("delivers live launch intents to an existing window", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const fakeWindow = createFakeBrowserWindow(501, {
      height: 900,
      width: 1400,
    });
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => [fakeWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => true,
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      openExternalUrl: vi.fn(),
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    const descriptor = controller.openWindow({
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    });

    expect(
      controller.deliverLaunchIntent(descriptor?.windowId ?? -1, {
        kind: "workspace",
        launchPath: "/workspace/alpha/src/main.ts",
        launchPathKind: "file",
        receivedAt: "2026-03-25T10:00:00.000Z",
        workspaceLabel: "alpha",
        workspacePath: "/workspace/alpha",
      })
    ).toBe(true);
    expect(fakeWindow.webContents.send).toHaveBeenCalledWith(
      DESKTOP_HOST_IPC_CHANNELS.pushLaunchIntent,
      expect.objectContaining({
        kind: "workspace",
        launchPath: "/workspace/alpha/src/main.ts",
      })
    );
  });

  it("broadcasts updater state to every live window", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const firstWindow = createFakeBrowserWindow(601, {
      height: 900,
      width: 1400,
    });
    const secondWindow = createFakeBrowserWindow(602, {
      height: 900,
      width: 1400,
    });
    const createdWindows = [firstWindow, secondWindow];
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => createdWindows.shift() ?? firstWindow),
        fromWebContents: vi.fn(() => firstWindow),
        getAllWindows: vi.fn(() => [firstWindow, secondWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => true,
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      openExternalUrl: vi.fn(),
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    controller.openWindow({
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    });
    controller.openWindow({
      workspaceLabel: "beta",
      workspacePath: "/workspace/beta",
    });

    expect(
      controller.broadcastUpdateState({
        capability: "automatic",
        mode: "enabled_stable_public_service",
        provider: "public-github",
        stage: "checking",
      })
    ).toBe(2);
    expect(firstWindow.webContents.send).toHaveBeenCalledWith(
      DESKTOP_HOST_IPC_CHANNELS.pushUpdateState,
      expect.objectContaining({
        stage: "checking",
      })
    );
    expect(secondWindow.webContents.send).toHaveBeenCalledWith(
      DESKTOP_HOST_IPC_CHANNELS.pushUpdateState,
      expect.objectContaining({
        stage: "checking",
      })
    );
  });

  it("reports unresponsive and responsive window transitions", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const fakeWindow = createFakeBrowserWindow(701, {
      height: 900,
      width: 1400,
    });
    const onWindowUnresponsive = vi.fn();
    const onWindowResponsive = vi.fn();
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => fakeWindow),
        fromWebContents: vi.fn(() => fakeWindow),
        getAllWindows: vi.fn(() => [fakeWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => true,
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      onWindowResponsive,
      onWindowUnresponsive,
      openExternalUrl: vi.fn(),
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    const descriptor = controller.openWindow({
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    });

    fakeWindow.emitUnresponsive();
    fakeWindow.emitResponsive();

    expect(onWindowUnresponsive).toHaveBeenCalledWith({
      focusWindow: expect.any(Function),
      session: expect.objectContaining({
        id: descriptor?.sessionId,
      }),
      windowId: 701,
    });
    expect(onWindowResponsive).toHaveBeenCalledWith({
      session: expect.objectContaining({
        id: descriptor?.sessionId,
      }),
      windowId: 701,
    });
  });

  it("recovers a crashed renderer by recreating the session window", () => {
    const shellState = createDesktopShellState({
      now: () => "2026-03-23T10:00:00.000Z",
      persistedState: {
        sessions: [],
        trayEnabled: false,
      },
    });
    const firstWindow = createFakeBrowserWindow(801, {
      height: 900,
      width: 1400,
    });
    const replacementWindow = createFakeBrowserWindow(802, {
      height: 900,
      width: 1400,
    });
    const createdWindows = [firstWindow, replacementWindow];
    const onRenderProcessGone = vi.fn();
    const controller = createDesktopWindowController({
      browserWindow: {
        create: vi.fn(() => createdWindows.shift() ?? replacementWindow),
        fromWebContents: vi.fn((webContents) =>
          webContents === firstWindow.webContents ? firstWindow : replacementWindow
        ),
        getAllWindows: vi.fn(() => [firstWindow, replacementWindow]),
      },
      defaultWindowBounds: {
        height: 960,
        width: 1440,
      },
      isSafeExternalUrl: () => true,
      isQuitting: () => false,
      isTrustedRendererUrl: () => true,
      loadRenderer: vi.fn(),
      notifyWindowsChanged: vi.fn(),
      onRenderProcessGone,
      openExternalUrl: vi.fn(),
      persistState: vi.fn(),
      preloadPath: "/tmp/preload.js",
      shellState,
    });

    const descriptor = controller.openWindow({
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    });

    firstWindow.emitRenderProcessGone({
      exitCode: 1,
      reason: "crashed",
    });

    expect(onRenderProcessGone).toHaveBeenCalledWith({
      details: {
        exitCode: 1,
        reason: "crashed",
      },
      session: expect.objectContaining({
        id: descriptor?.sessionId,
      }),
      windowId: 801,
    });

    const replacementDescriptor = controller.recoverWindow(801);
    expect(firstWindow.destroy).toHaveBeenCalledTimes(1);
    expect(replacementDescriptor).toEqual(
      expect.objectContaining({
        sessionId: descriptor?.sessionId,
        windowId: 802,
      })
    );
  });
});
