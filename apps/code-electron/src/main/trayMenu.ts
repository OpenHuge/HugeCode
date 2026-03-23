import type { MenuItemConstructorOptions } from "electron";
import type { DesktopSessionDescriptor, DesktopWindowDescriptor } from "./desktopShellState.js";

type TrayMenuHandlers = {
  onFocusWindow: (windowId: number) => void;
  onNewWindow: () => void;
  onQuit: () => void;
  onReopenSession: (sessionId: string) => void;
  onToggleTray: (enabled: boolean) => void;
};

type TrayMenuState = {
  recentSessions: DesktopSessionDescriptor[];
  trayEnabled: boolean;
  windows: DesktopWindowDescriptor[];
};

type TrayMenuStateSignature = {
  recentSessions: Array<{
    id: string;
    workspaceLabel: string | null;
    workspacePath: string | null;
    windowLabel: DesktopSessionDescriptor["windowLabel"];
  }>;
  trayEnabled: boolean;
  windows: Array<{
    sessionId: string;
    windowId: number;
    windowLabel: DesktopWindowDescriptor["windowLabel"];
    workspaceLabel: string | null;
  }>;
};

function formatWindowLabel(window: DesktopWindowDescriptor) {
  if (window.windowLabel === "about") {
    return "About HugeCode";
  }

  return window.workspaceLabel ?? `Window ${window.windowId}`;
}

function formatSessionLabel(session: DesktopSessionDescriptor) {
  if (session.windowLabel === "about") {
    return "About HugeCode";
  }

  return session.workspaceLabel ?? session.workspacePath ?? "Untitled Session";
}

export function getTrayMenuStateSignature(state: TrayMenuState) {
  const signature: TrayMenuStateSignature = {
    trayEnabled: state.trayEnabled,
    windows: state.windows.map((window) => ({
      windowId: window.windowId,
      sessionId: window.sessionId,
      windowLabel: window.windowLabel,
      workspaceLabel: window.workspaceLabel,
    })),
    recentSessions: state.recentSessions.map((session) => ({
      id: session.id,
      windowLabel: session.windowLabel,
      workspaceLabel: session.workspaceLabel,
      workspacePath: session.workspacePath,
    })),
  };

  return JSON.stringify(signature);
}

export function buildTrayMenuTemplate(
  state: TrayMenuState,
  handlers: TrayMenuHandlers
): MenuItemConstructorOptions[] {
  const activeWindowsSubmenu: MenuItemConstructorOptions[] =
    state.windows.length > 0
      ? state.windows.map((window) => ({
          label: formatWindowLabel(window),
          type: "normal",
          click: () => {
            handlers.onFocusWindow(window.windowId);
          },
        }))
      : [
          {
            label: "No Open Windows",
            enabled: false,
          },
        ];

  const recentSessionsSubmenu: MenuItemConstructorOptions[] =
    state.recentSessions.length > 0
      ? state.recentSessions.map((session) => ({
          label: formatSessionLabel(session),
          type: "normal",
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

  return [
    {
      label: "New Window",
      click: () => {
        handlers.onNewWindow();
      },
    },
    {
      label: "Current Windows",
      submenu: activeWindowsSubmenu,
    },
    {
      label: "Recent Sessions",
      submenu: recentSessionsSubmenu,
    },
    {
      type: "separator",
    },
    {
      label: "Keep HugeCode in Tray",
      type: "checkbox",
      checked: state.trayEnabled,
      click: () => {
        handlers.onToggleTray(!state.trayEnabled);
      },
    },
    {
      type: "separator",
    },
    {
      label: "Quit HugeCode",
      click: () => {
        handlers.onQuit();
      },
    },
  ];
}
