import { Menu } from "electron";
import type { JumpListCategory, Menu as ElectronMenu, MenuItemConstructorOptions } from "electron";
import type { DesktopSessionDescriptor } from "./desktopShellState.js";
import { DESKTOP_NEW_WINDOW_ARG } from "./desktopLaunchCommands.js";

type PlatformLauncherState = {
  recentSessions: DesktopSessionDescriptor[];
};

type DockLike = {
  setMenu(menu: MenuLike | null): void;
};

type ElectronAppLike = {
  dock?: DockLike | null;
  getJumpListSettings?(): {
    minItems: number;
    removedItems: PlatformLauncherRemovedJumpListItem[];
  };
  setJumpList?(categories: JumpListCategory[] | null): string;
};

type MenuLike = object;

type PlatformLauncherRemovedJumpListItem = {
  args?: string;
  title?: string;
  type?: "file" | "separator" | "task";
};

type PlatformLauncherJumpListTask = {
  args: string;
  description: string;
  iconIndex: number;
  iconPath: string;
  program: string;
  title: string;
  type: "task";
};

type PlatformLauncherHandlers = {
  onNewWindow(): void;
  onReopenSession(sessionId: string): void;
};

type PlatformLauncherLogger = {
  warn(message: string, metadata?: Record<string, unknown>): void;
};

type DesktopPlatformLauncherControllerDependencies = {
  createMenuFromTemplate?: (template: MenuItemConstructorOptions[]) => MenuLike;
  executablePath?: string;
  logger?: PlatformLauncherLogger;
};

export type CreateDesktopPlatformLauncherControllerInput = {
  app: ElectronAppLike;
  dependencies?: DesktopPlatformLauncherControllerDependencies;
  platform: NodeJS.Platform;
  readState(): PlatformLauncherState;
  onNewWindow(): void;
  onReopenSession(sessionId: string): void;
};

function formatSessionLabel(session: DesktopSessionDescriptor) {
  if (session.windowLabel === "about") {
    return "About HugeCode";
  }

  return session.workspaceLabel ?? session.workspacePath ?? "Untitled Session";
}

function getPlatformLauncherStateSignature(state: PlatformLauncherState) {
  return JSON.stringify({
    recentSessions: state.recentSessions.map((session) => ({
      id: session.id,
      windowLabel: session.windowLabel,
      workspaceLabel: session.workspaceLabel,
      workspacePath: session.workspacePath,
    })),
  });
}

function quoteCommandLineArg(argument: string) {
  if (!/[\s"]/u.test(argument)) {
    return argument;
  }

  const escapedArgument = argument.replace(/(\\*)"/gu, '$1$1\\"').replace(/(\\+)$/u, "$1$1");
  return `"${escapedArgument}"`;
}

function isRemovedJumpListTask(
  removedItems: PlatformLauncherRemovedJumpListItem[] | undefined,
  item: PlatformLauncherJumpListTask
) {
  return (removedItems ?? []).some((removedItem) => {
    return (
      removedItem.type === "task" &&
      removedItem.title === item.title &&
      removedItem.args === item.args
    );
  });
}

function toWorkspaceSessions(sessions: DesktopSessionDescriptor[]) {
  return sessions.filter((session) => {
    return session.windowLabel === "main" && typeof session.workspacePath === "string";
  });
}

export function buildDockMenuTemplate(
  state: PlatformLauncherState,
  handlers: PlatformLauncherHandlers
): MenuItemConstructorOptions[] {
  const recentWorkspaceSessions = toWorkspaceSessions(state.recentSessions).slice(0, 5);
  const dockMenuTemplate: MenuItemConstructorOptions[] = [
    {
      label: "New Window",
      click: () => {
        handlers.onNewWindow();
      },
    },
  ];

  if (recentWorkspaceSessions.length > 0) {
    dockMenuTemplate.push(
      {
        type: "separator",
      },
      {
        label: "Recent Workspaces",
        submenu: recentWorkspaceSessions.map((session) => ({
          label: formatSessionLabel(session),
          click: () => {
            handlers.onReopenSession(session.id);
          },
        })),
      }
    );
  }

  return dockMenuTemplate;
}

export function buildWindowsJumpList(
  state: PlatformLauncherState,
  options: {
    executablePath: string;
    minItems: number;
    removedItems?: PlatformLauncherRemovedJumpListItem[];
  }
): JumpListCategory[] {
  const executablePath = options.executablePath.trim();
  const minItems = Math.max(1, options.minItems);
  const recentWorkspaceSessions = toWorkspaceSessions(state.recentSessions).slice(
    0,
    Math.max(5, minItems)
  );

  const newWindowTask = {
    type: "task" as const,
    title: "New Window",
    description: "Open a new HugeCode window.",
    program: executablePath,
    args: DESKTOP_NEW_WINDOW_ARG,
    iconPath: executablePath,
    iconIndex: 0,
  };

  const jumpList: JumpListCategory[] = [];
  if (!isRemovedJumpListTask(options.removedItems, newWindowTask)) {
    jumpList.push({
      type: "tasks",
      items: [newWindowTask],
    });
  }

  const recentWorkspaceItems = recentWorkspaceSessions
    .map((session) => {
      const workspacePath = session.workspacePath;
      if (!workspacePath) {
        return null;
      }

      return {
        type: "task" as const,
        title: formatSessionLabel(session),
        description: "Reopen a recent HugeCode workspace.",
        program: executablePath,
        args: quoteCommandLineArg(workspacePath),
        iconPath: executablePath,
        iconIndex: 0,
      };
    })
    .filter((item): item is PlatformLauncherJumpListTask => item !== null)
    .filter((item) => !isRemovedJumpListTask(options.removedItems, item));

  if (recentWorkspaceItems.length > 0) {
    jumpList.push({
      type: "custom",
      name: "Recent Workspaces",
      items: recentWorkspaceItems,
    });
  }

  return jumpList;
}

export function createDesktopPlatformLauncherController(
  input: CreateDesktopPlatformLauncherControllerInput
) {
  const createMenuFromTemplate =
    input.dependencies?.createMenuFromTemplate ?? ((template) => Menu.buildFromTemplate(template));
  const executablePath = input.dependencies?.executablePath ?? process.execPath;
  const logger = input.dependencies?.logger ?? {
    warn() {},
  };

  let dockMenu: MenuLike | null = null;
  let stateSignature: string | null = null;

  return {
    dispose() {
      dockMenu = null;
      stateSignature = null;
      if (input.platform === "darwin") {
        input.app.dock?.setMenu(null);
      }
      if (input.platform === "win32") {
        input.app.setJumpList?.(null);
      }
    },
    update() {
      const state = input.readState();
      const nextStateSignature = getPlatformLauncherStateSignature(state);
      if (nextStateSignature === stateSignature) {
        return;
      }

      if (input.platform === "darwin") {
        dockMenu = createMenuFromTemplate(
          buildDockMenuTemplate(state, {
            onNewWindow: input.onNewWindow,
            onReopenSession: input.onReopenSession,
          })
        );
        input.app.dock?.setMenu(dockMenu as ElectronMenu | null);
      }

      if (input.platform === "win32" && input.app.setJumpList) {
        const jumpListSettings = input.app.getJumpListSettings?.();
        const result = input.app.setJumpList(
          buildWindowsJumpList(state, {
            executablePath,
            minItems: jumpListSettings?.minItems ?? 1,
            removedItems: jumpListSettings?.removedItems,
          })
        );
        if (result !== "ok") {
          logger.warn("HugeCode desktop launcher jump list update failed.", {
            result,
          });
        }
      }

      stateSignature = nextStateSignature;
    },
  };
}
