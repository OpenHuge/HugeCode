import { Menu } from "electron";
import type { Menu as ElectronMenu, MenuItemConstructorOptions } from "electron";
import type { DesktopSessionDescriptor } from "./desktopShellState.js";

type ApplicationMenuState = {
  platform: NodeJS.Platform;
  recentSessions: DesktopSessionDescriptor[];
};

type ApplicationMenuHandlers = {
  onCheckForUpdates(): void;
  onNewWindow(): void;
  onOpenFile(): void;
  onOpenFolder(): void;
  onOpenAbout(): void;
  onQuit(): void;
  onReopenSession(sessionId: string): void;
};

type MenuLike = object;

type DesktopApplicationMenuControllerDependencies = {
  createMenuFromTemplate?: (template: MenuItemConstructorOptions[]) => MenuLike;
  setApplicationMenu?: (menu: MenuLike | null) => void;
};

export type CreateDesktopApplicationMenuControllerInput = {
  dependencies?: DesktopApplicationMenuControllerDependencies;
  platform: NodeJS.Platform;
  readState(): Pick<ApplicationMenuState, "recentSessions">;
  onNewWindow(): void;
  onOpenFile(): void;
  onOpenFolder(): void;
  onOpenAbout(): void;
  onQuit(): void;
  onReopenSession(sessionId: string): void;
  onCheckForUpdates(): void;
};

function formatSessionLabel(session: DesktopSessionDescriptor) {
  if (session.windowLabel === "about") {
    return "About HugeCode";
  }

  return session.workspaceLabel ?? session.workspacePath ?? "Untitled Session";
}

function getApplicationMenuStateSignature(state: ApplicationMenuState) {
  return JSON.stringify({
    platform: state.platform,
    recentSessions: state.recentSessions.map((session) => ({
      id: session.id,
      windowLabel: session.windowLabel,
      workspaceLabel: session.workspaceLabel,
      workspacePath: session.workspacePath,
    })),
  });
}

export function buildApplicationMenuTemplate(
  state: ApplicationMenuState,
  handlers: ApplicationMenuHandlers
): MenuItemConstructorOptions[] {
  const recentSessionsSubmenu: MenuItemConstructorOptions[] =
    state.recentSessions.length > 0
      ? state.recentSessions.map((session) => ({
          label: formatSessionLabel(session),
          click: () => {
            handlers.onReopenSession(session.id);
          },
        }))
      : [
          {
            label: "No Recent Sessions",
            enabled: false,
          },
        ];

  const fileMenuItems: MenuItemConstructorOptions[] = [
    {
      label: "New Window",
      accelerator: state.platform === "darwin" ? "Command+N" : "Ctrl+N",
      click: () => {
        handlers.onNewWindow();
      },
    },
    {
      label: "Open File...",
      accelerator: state.platform === "darwin" ? "Command+O" : "Ctrl+O",
      click: () => {
        handlers.onOpenFile();
      },
    },
    {
      label: "Open Folder...",
      click: () => {
        handlers.onOpenFolder();
      },
    },
    {
      type: "separator",
    },
    {
      label: "Open Recent Session",
      submenu: recentSessionsSubmenu,
    },
  ];

  if (state.platform === "darwin") {
    fileMenuItems.push({
      label: "Open Recent File",
      submenu: [
        {
          role: "recentDocuments",
        },
        {
          type: "separator",
        },
        {
          role: "clearRecentDocuments",
        },
      ],
    });
  }

  const helpMenuItems: MenuItemConstructorOptions[] = [
    {
      label: "Check for Updates...",
      click: () => {
        handlers.onCheckForUpdates();
      },
    },
  ];

  if (state.platform !== "darwin") {
    fileMenuItems.unshift({
      label: "About HugeCode",
      click: () => {
        handlers.onOpenAbout();
      },
    });
  }

  fileMenuItems.push(
    {
      type: "separator",
    },
    state.platform === "darwin"
      ? { role: "close" }
      : {
          label: "Quit HugeCode",
          accelerator: "Ctrl+Q",
          click: () => {
            handlers.onQuit();
          },
        }
  );

  if (state.platform === "darwin") {
    return [
      {
        label: "HugeCode",
        submenu: [
          {
            label: "About HugeCode",
            click: () => {
              handlers.onOpenAbout();
            },
          },
          {
            type: "separator",
          },
          {
            role: "services",
          },
          {
            type: "separator",
          },
          {
            role: "hide",
          },
          {
            role: "hideOthers",
          },
          {
            role: "unhide",
          },
          {
            type: "separator",
          },
          {
            label: "Quit HugeCode",
            accelerator: "Command+Q",
            click: () => {
              handlers.onQuit();
            },
          },
        ],
      },
      {
        label: "File",
        submenu: fileMenuItems,
      },
      {
        label: "Help",
        submenu: helpMenuItems,
      },
      {
        role: "windowMenu",
      },
    ];
  }

  return [
    {
      label: "File",
      submenu: fileMenuItems,
    },
    {
      label: "Window",
      submenu: [
        {
          role: "minimize",
        },
        {
          role: "close",
        },
      ],
    },
    {
      label: "Help",
      submenu: helpMenuItems,
    },
  ];
}

export function createDesktopApplicationMenuController(
  input: CreateDesktopApplicationMenuControllerInput
) {
  const createMenuFromTemplate =
    input.dependencies?.createMenuFromTemplate ?? ((template) => Menu.buildFromTemplate(template));
  const setApplicationMenu =
    input.dependencies?.setApplicationMenu ??
    ((menu) => Menu.setApplicationMenu(menu as ElectronMenu | null));

  let menu: MenuLike | null = null;
  let menuSignature: string | null = null;

  return {
    dispose() {
      menu = null;
      menuSignature = null;
      setApplicationMenu(null);
    },
    update() {
      const state: ApplicationMenuState = {
        platform: input.platform,
        recentSessions: input.readState().recentSessions,
      };
      const nextSignature = getApplicationMenuStateSignature(state);
      if (nextSignature === menuSignature && menu) {
        return;
      }

      menu = createMenuFromTemplate(
        buildApplicationMenuTemplate(state, {
          onNewWindow: input.onNewWindow,
          onCheckForUpdates: input.onCheckForUpdates,
          onOpenFile: input.onOpenFile,
          onOpenFolder: input.onOpenFolder,
          onOpenAbout: input.onOpenAbout,
          onQuit: input.onQuit,
          onReopenSession: input.onReopenSession,
        })
      );
      menuSignature = nextSignature;
      setApplicationMenu(menu);
    },
  };
}
