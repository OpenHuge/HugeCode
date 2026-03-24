import { describe, expect, it, vi } from "vitest";
import {
  buildApplicationMenuTemplate,
  createDesktopApplicationMenuController,
} from "./desktopApplicationMenu.js";

describe("desktopApplicationMenu", () => {
  it("builds a macOS menu with about and recent sessions", () => {
    const template = buildApplicationMenuTemplate(
      {
        platform: "darwin",
        recentSessions: [
          {
            id: "session-alpha",
            lastActiveAt: "2026-03-24T00:00:00.000Z",
            preferredBackendId: null,
            runtimeMode: "local",
            windowLabel: "main",
            workspaceLabel: "alpha",
            workspacePath: "/workspace/alpha",
          },
        ],
      },
      {
        onNewWindow: vi.fn(),
        onOpenAbout: vi.fn(),
        onQuit: vi.fn(),
        onReopenSession: vi.fn(),
      }
    );

    expect(template[0]?.label).toBe("HugeCode");
    expect(template[1]).toMatchObject({
      label: "File",
    });
    expect(template[1]?.submenu?.[0]).toMatchObject({
      label: "New Window",
    });
    expect(template[1]?.submenu?.[1]).toMatchObject({
      label: "Open Recent Session",
      submenu: [expect.objectContaining({ label: "alpha" })],
    });
  });

  it("updates the application menu only when the state signature changes", () => {
    const createMenuFromTemplate = vi.fn((template) => ({ template }));
    const setApplicationMenu = vi.fn();
    const readState = vi.fn(() => ({
      recentSessions: [
        {
          id: "session-alpha",
          lastActiveAt: "2026-03-24T00:00:00.000Z",
          preferredBackendId: null,
          runtimeMode: "local" as const,
          windowLabel: "main" as const,
          workspaceLabel: "alpha",
          workspacePath: "/workspace/alpha",
        },
      ],
    }));
    const controller = createDesktopApplicationMenuController({
      dependencies: {
        createMenuFromTemplate,
        setApplicationMenu,
      },
      onNewWindow: vi.fn(),
      onOpenAbout: vi.fn(),
      onQuit: vi.fn(),
      onReopenSession: vi.fn(),
      platform: "darwin",
      readState,
    });

    controller.update();
    controller.update();

    expect(createMenuFromTemplate).toHaveBeenCalledTimes(1);
    expect(setApplicationMenu).toHaveBeenCalledTimes(1);

    readState.mockReturnValueOnce({
      recentSessions: [],
    });
    controller.update();

    expect(createMenuFromTemplate).toHaveBeenCalledTimes(2);
    expect(setApplicationMenu).toHaveBeenCalledTimes(2);

    controller.dispose();
    expect(setApplicationMenu).toHaveBeenLastCalledWith(null);
  });
});
