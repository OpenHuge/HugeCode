export const DESKTOP_HOST_IPC_CHANNELS = {
  getAppVersion: "hugecode:desktop-host:get-app-version",
  getCurrentSession: "hugecode:desktop-host:get-current-session",
  listRecentSessions: "hugecode:desktop-host:list-recent-sessions",
  reopenSession: "hugecode:desktop-host:reopen-session",
  getWindowLabel: "hugecode:desktop-host:get-window-label",
  listWindows: "hugecode:desktop-host:list-windows",
  openWindow: "hugecode:desktop-host:open-window",
  focusWindow: "hugecode:desktop-host:focus-window",
  closeWindow: "hugecode:desktop-host:close-window",
  getTrayState: "hugecode:desktop-host:get-tray-state",
  setTrayEnabled: "hugecode:desktop-host:set-tray-enabled",
  showNotification: "hugecode:desktop-host:show-notification",
  openExternalUrl: "hugecode:desktop-host:open-external-url",
  revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
  getBrowserDebugSession: "hugecode:desktop-host:get-browser-debug-session",
  ensureBrowserDebugSession: "hugecode:desktop-host:ensure-browser-debug-session",
} as const;

export type DesktopWindowLabel = "main" | "about";
export type DesktopRuntimeMode = "local" | "remote";

export type DesktopSessionInfo = {
  id: string;
  lastActiveAt: string;
  preferredBackendId: string | null;
  runtimeMode: DesktopRuntimeMode;
  windowLabel: DesktopWindowLabel;
  workspaceLabel: string | null;
  workspacePath: string | null;
};

export type DesktopWindowInfo = {
  focused: boolean;
  hidden?: boolean;
  sessionId: string;
  windowId: number;
  windowLabel: DesktopWindowLabel;
  workspaceLabel: string | null;
};

export type DesktopTrayState = {
  enabled: boolean;
  supported: boolean;
};

export type OpenDesktopWindowInput = {
  duplicate?: boolean;
  preferredBackendId?: string | null;
  runtimeMode?: DesktopRuntimeMode;
  windowLabel?: DesktopWindowLabel;
  workspaceLabel?: string | null;
  workspacePath?: string | null;
};

export type DesktopNotificationInput = {
  body?: string | null;
  title: string;
};

export type DesktopBrowserDebugSessionInput = {
  focus?: boolean;
  reset?: boolean;
  targetUrl?: string | null;
};

export type DesktopBrowserDebugSessionInfo = {
  browserUrl: string;
  currentUrl: string | null;
  targetUrl: string | null;
  windowId: number;
};

export type DesktopHostBridgeApi = {
  kind: "electron";
  app: {
    getVersion(): Promise<string | null>;
  };
  session: {
    getCurrentSession(): Promise<DesktopSessionInfo | null>;
    listRecentSessions(): Promise<DesktopSessionInfo[]>;
    reopenSession(sessionId: string): Promise<boolean>;
  };
  window: {
    getLabel(): Promise<string>;
  };
  windowing: {
    closeWindow(windowId: number): Promise<boolean>;
    focusWindow(windowId: number): Promise<boolean>;
    listWindows(): Promise<DesktopWindowInfo[]>;
    openWindow(input?: OpenDesktopWindowInput): Promise<DesktopWindowInfo | null>;
  };
  tray: {
    getState(): Promise<DesktopTrayState>;
    setEnabled(enabled: boolean): Promise<DesktopTrayState>;
  };
  notifications: {
    show(input: DesktopNotificationInput): Promise<boolean>;
  };
  shell: {
    openExternalUrl(url: string): Promise<boolean>;
    revealItemInDir(path: string): Promise<boolean>;
  };
  browserDebug: {
    getSession(): Promise<DesktopBrowserDebugSessionInfo | null>;
    ensureSession(
      input?: DesktopBrowserDebugSessionInput
    ): Promise<DesktopBrowserDebugSessionInfo | null>;
  };
};
