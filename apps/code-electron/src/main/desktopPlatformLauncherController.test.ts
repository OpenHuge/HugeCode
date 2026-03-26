import { describe, expect, it, vi } from "vitest";
import {
  buildDockMenuTemplate,
  buildWindowsJumpList,
  createDesktopPlatformLauncherController,
} from "./desktopPlatformLauncherController.js";

describe("desktopPlatformLauncherController", () => {
  it("builds a macOS dock menu with a new window action and recent workspaces", () => {
    const template = buildDockMenuTemplate(
      {
        recentSessions: [
          {
            id: "session-alpha",
            lastActiveAt: "2026-03-25T00:00:00.000Z",
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
        onReopenSession: vi.fn(),
      }
    );

    expect(template[0]).toMatchObject({
      label: "New Window",
    });
    expect(template[2]).toMatchObject({
      label: "Recent Workspaces",
      submenu: [expect.objectContaining({ label: "alpha" })],
    });
  });

  it("builds a Windows jump list with a new window task and recent workspaces", () => {
    const categories = buildWindowsJumpList(
      {
        recentSessions: [
          {
            id: "session-alpha",
            lastActiveAt: "2026-03-25T00:00:00.000Z",
            preferredBackendId: null,
            runtimeMode: "local",
            windowLabel: "main",
            workspaceLabel: "alpha",
            workspacePath: "C:\\Workspaces\\Alpha Project",
          },
        ],
      },
      {
        executablePath: "C:\\Program Files\\HugeCode\\HugeCode.exe",
        minItems: 3,
      }
    );

    expect(categories[0]).toMatchObject({
      type: "tasks",
      items: [expect.objectContaining({ args: "--new-window", title: "New Window" })],
    });
    expect(categories[1]).toMatchObject({
      name: "Recent Workspaces",
      type: "custom",
      items: [
        expect.objectContaining({
          args: '"C:\\Workspaces\\Alpha Project"',
          title: "alpha",
        }),
      ],
    });
  });

  it("filters removed jump list items so Windows does not drop the whole custom category", () => {
    const categories = buildWindowsJumpList(
      {
        recentSessions: [
          {
            id: "session-alpha",
            lastActiveAt: "2026-03-25T00:00:00.000Z",
            preferredBackendId: null,
            runtimeMode: "local",
            windowLabel: "main",
            workspaceLabel: "alpha",
            workspacePath: "C:\\Workspaces\\Alpha",
          },
        ],
      },
      {
        executablePath: "C:\\Program Files\\HugeCode\\HugeCode.exe",
        minItems: 1,
        removedItems: [
          {
            args: "C:\\Workspaces\\Alpha",
            title: "alpha",
            type: "task",
          },
          {
            args: "--new-window",
            title: "New Window",
            type: "task",
          },
        ],
      }
    );

    expect(categories).toEqual([]);
  });

  it("updates the native launcher only when launcher state changes", () => {
    const createMenuFromTemplate = vi.fn((template) => ({ template }));
    const dockSetMenu = vi.fn();
    const setJumpList = vi.fn(() => "ok");
    const readState = vi.fn(() => ({
      recentSessions: [
        {
          id: "session-alpha",
          lastActiveAt: "2026-03-25T00:00:00.000Z",
          preferredBackendId: null,
          runtimeMode: "local" as const,
          windowLabel: "main" as const,
          workspaceLabel: "alpha",
          workspacePath: "/workspace/alpha",
        },
      ],
    }));

    const controller = createDesktopPlatformLauncherController({
      app: {
        dock: {
          setMenu: dockSetMenu,
        },
        getJumpListSettings: vi.fn(() => ({
          minItems: 3,
          removedItems: [],
        })),
        setJumpList,
      },
      dependencies: {
        createMenuFromTemplate,
        executablePath: "/Applications/HugeCode.app/Contents/MacOS/HugeCode",
      },
      onNewWindow: vi.fn(),
      onReopenSession: vi.fn(),
      platform: "darwin",
      readState,
    });

    controller.update();
    controller.update();

    expect(createMenuFromTemplate).toHaveBeenCalledTimes(1);
    expect(dockSetMenu).toHaveBeenCalledTimes(1);

    readState.mockReturnValueOnce({
      recentSessions: [],
    });
    controller.update();

    expect(createMenuFromTemplate).toHaveBeenCalledTimes(2);
    expect(dockSetMenu).toHaveBeenCalledTimes(2);

    controller.dispose();
    expect(dockSetMenu).toHaveBeenLastCalledWith(null);
  });
});
