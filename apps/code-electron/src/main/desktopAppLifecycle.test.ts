import { describe, expect, it, vi } from "vitest";
import type { DesktopSessionDescriptor } from "./desktopShellState.js";
import { registerDesktopAppLifecycle } from "./desktopAppLifecycle.js";

type AppEventMap = {
  activate: () => void;
  "before-quit": () => void;
  "second-instance": () => void;
  "window-all-closed": () => void;
};

function createFakeApp(platform = "darwin") {
  const listeners = new Map<keyof AppEventMap, () => void>();
  const whenReady = vi.fn(() => Promise.resolve());

  return {
    on: vi.fn(<Key extends keyof AppEventMap>(event: Key, listener: AppEventMap[Key]) => {
      listeners.set(event, listener);
    }),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    trigger<Key extends keyof AppEventMap>(event: Key) {
      listeners.get(event)?.();
    },
    whenReady,
    platform,
  };
}

describe("desktopAppLifecycle", () => {
  it("restores persisted sessions on ready and refreshes the tray", async () => {
    const app = createFakeApp();
    const openWindow = vi.fn();
    const createWindowForSession = vi.fn();
    const updateTray = vi.fn();
    const sessions: DesktopSessionDescriptor[] = [
      {
        id: "session-1",
        lastActiveAt: "2026-03-23T10:00:00.000Z",
        preferredBackendId: null,
        runtimeMode: "local",
        windowLabel: "main",
        workspaceLabel: "alpha",
        workspacePath: "/workspace/alpha",
      },
    ];

    registerDesktopAppLifecycle({
      app,
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      createWindowForSession,
      getLatestSession: () => sessions[0] ?? null,
      getPersistedSessions: () => sessions,
      isTrayEnabled: () => false,
      onBeforeQuit: vi.fn(),
      openWindow,
      updateTray,
    });
    await app.whenReady.mock.results[0]?.value;

    expect(createWindowForSession).toHaveBeenCalledWith(sessions[0]);
    expect(openWindow).not.toHaveBeenCalled();
    expect(updateTray).toHaveBeenCalledTimes(1);
  });

  it("opens a default window on ready when there are no persisted sessions", async () => {
    const app = createFakeApp();
    const openWindow = vi.fn();

    registerDesktopAppLifecycle({
      app,
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      createWindowForSession: vi.fn(),
      getLatestSession: () => null,
      getPersistedSessions: () => [],
      isTrayEnabled: () => false,
      onBeforeQuit: vi.fn(),
      openWindow,
      updateTray: vi.fn(),
    });
    await app.whenReady.mock.results[0]?.value;

    expect(openWindow).toHaveBeenCalledTimes(1);
  });

  it("focuses the first existing window on second-instance", () => {
    const app = createFakeApp();
    const firstWindow = {
      focus: vi.fn(),
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
    };

    registerDesktopAppLifecycle({
      app,
      browserWindow: {
        getAllWindows: vi.fn(() => [firstWindow]),
      },
      createWindowForSession: vi.fn(),
      getLatestSession: () => null,
      getPersistedSessions: () => [],
      isTrayEnabled: () => false,
      onBeforeQuit: vi.fn(),
      openWindow: vi.fn(),
      updateTray: vi.fn(),
    });

    app.trigger("second-instance");

    expect(firstWindow.restore).toHaveBeenCalledTimes(1);
    expect(firstWindow.show).toHaveBeenCalledTimes(1);
    expect(firstWindow.focus).toHaveBeenCalledTimes(1);
  });

  it("opens a window on activate when no windows are open", async () => {
    const app = createFakeApp();
    const latestSession: DesktopSessionDescriptor = {
      id: "session-2",
      lastActiveAt: "2026-03-23T10:00:00.000Z",
      preferredBackendId: null,
      runtimeMode: "local",
      windowLabel: "main",
      workspaceLabel: "beta",
      workspacePath: "/workspace/beta",
    };
    const createWindowForSession = vi.fn();

    registerDesktopAppLifecycle({
      app,
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      createWindowForSession,
      getLatestSession: () => latestSession,
      getPersistedSessions: () => [],
      isTrayEnabled: () => false,
      onBeforeQuit: vi.fn(),
      openWindow: vi.fn(),
      updateTray: vi.fn(),
    });
    await app.whenReady.mock.results[0]?.value;

    app.trigger("activate");

    expect(createWindowForSession).toHaveBeenCalledWith(latestSession);
  });

  it("quits on window-all-closed outside macOS when tray mode is disabled", () => {
    const app = createFakeApp("win32");

    registerDesktopAppLifecycle({
      app,
      browserWindow: {
        getAllWindows: vi.fn(() => []),
      },
      createWindowForSession: vi.fn(),
      getLatestSession: () => null,
      getPersistedSessions: () => [],
      isTrayEnabled: () => false,
      onBeforeQuit: vi.fn(),
      openWindow: vi.fn(),
      updateTray: vi.fn(),
    });

    app.trigger("window-all-closed");

    expect(app.quit).toHaveBeenCalledTimes(1);
  });
});
