import { describe, expect, it, vi } from "vitest";
import type { DesktopWindowDescriptor } from "./desktopShellState.js";
import { createDesktopTrayController } from "./desktopTrayController.js";

type MockTray = {
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setContextMenu: ReturnType<typeof vi.fn>;
  setToolTip: ReturnType<typeof vi.fn>;
};

function createWindowDescriptor(
  overrides: Partial<DesktopWindowDescriptor> = {}
): DesktopWindowDescriptor {
  return {
    focused: true,
    sessionId: "session-1",
    windowId: 7,
    windowLabel: "main",
    workspaceLabel: "alpha",
    ...overrides,
  };
}

describe("desktopTrayController", () => {
  it("reports unsupported state without creating a tray", () => {
    const createTray = vi.fn();
    const controller = createDesktopTrayController({
      isSupported: false,
      readState() {
        return {
          recentSessions: [],
          trayEnabled: true,
          windows: [],
        };
      },
      restoreVisibleWindow: vi.fn(),
      trayIconDataUrl: "data:image/png;base64,",
      dependencies: {
        createImageFromDataUrl: vi.fn(),
        createMenuFromTemplate: vi.fn(),
        createTray,
      },
      onFocusWindow: vi.fn(),
      onNewWindow: vi.fn(),
      onQuit: vi.fn(),
      onReopenSession: vi.fn(),
      onSetTrayEnabled: vi.fn(),
      platform: "darwin",
    });

    controller.update();

    expect(controller.getState()).toEqual({
      enabled: false,
      supported: false,
    });
    expect(createTray).not.toHaveBeenCalled();
  });

  it("creates one tray and skips menu rebuilds for focus-only state churn", () => {
    const tray: MockTray = {
      destroy: vi.fn(),
      on: vi.fn(),
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
    };
    const createTray = vi.fn(() => tray);
    const createMenuFromTemplate = vi.fn((template) => ({ template }));
    let focused = true;
    const controller = createDesktopTrayController({
      isSupported: true,
      readState() {
        return {
          recentSessions: [],
          trayEnabled: true,
          windows: [
            createWindowDescriptor({
              focused,
              hidden: focused ? false : true,
            }),
          ],
        };
      },
      restoreVisibleWindow: vi.fn(() => true),
      trayIconDataUrl: "data:image/png;base64,",
      dependencies: {
        createImageFromDataUrl: vi.fn(() => ({
          setTemplateImage: vi.fn(),
        })),
        createMenuFromTemplate,
        createTray,
      },
      onFocusWindow: vi.fn(),
      onNewWindow: vi.fn(),
      onQuit: vi.fn(),
      onReopenSession: vi.fn(),
      onSetTrayEnabled: vi.fn(),
      platform: "darwin",
    });

    controller.update();
    focused = false;
    controller.update();

    expect(controller.getState()).toEqual({
      enabled: true,
      supported: true,
    });
    expect(createTray).toHaveBeenCalledTimes(1);
    expect(createMenuFromTemplate).toHaveBeenCalledTimes(1);
    expect(tray.setToolTip).toHaveBeenCalledWith("HugeCode");
  });

  it("clears and destroys the tray when tray mode is turned off", () => {
    const tray: MockTray = {
      destroy: vi.fn(),
      on: vi.fn(),
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
    };
    const createTray = vi.fn(() => tray);
    let trayEnabled = true;
    const controller = createDesktopTrayController({
      isSupported: true,
      readState() {
        return {
          recentSessions: [],
          trayEnabled,
          windows: trayEnabled ? [createWindowDescriptor()] : [],
        };
      },
      restoreVisibleWindow: vi.fn(() => true),
      trayIconDataUrl: "data:image/png;base64,",
      dependencies: {
        createImageFromDataUrl: vi.fn(() => ({
          setTemplateImage: vi.fn(),
        })),
        createMenuFromTemplate: vi.fn((template) => ({ template })),
        createTray,
      },
      onFocusWindow: vi.fn(),
      onNewWindow: vi.fn(),
      onQuit: vi.fn(),
      onReopenSession: vi.fn(),
      onSetTrayEnabled: vi.fn(),
      platform: "darwin",
    });

    controller.update();
    trayEnabled = false;
    controller.update();

    expect(tray.setContextMenu).toHaveBeenLastCalledWith(null);
    expect(tray.destroy).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({
      enabled: false,
      supported: true,
    });
  });
});
