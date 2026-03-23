export type DesktopHostKind = "electron";
export type DesktopRuntimeHost = "browser" | DesktopHostKind | "tauri";
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

export type DesktopAppCapability = {
  getVersion?: () => Promise<string | null | undefined> | string | null | undefined;
};

export type DesktopSessionCapability = {
  getCurrentSession?: () =>
    | Promise<DesktopSessionInfo | null | undefined>
    | DesktopSessionInfo
    | null
    | undefined;
  listRecentSessions?: () =>
    | Promise<DesktopSessionInfo[] | null | undefined>
    | DesktopSessionInfo[]
    | null
    | undefined;
  reopenSession?: (sessionId: string) => Promise<boolean | void> | boolean | void;
};

export type DesktopWindowCapability = {
  getLabel?: () => Promise<string | null | undefined> | string | null | undefined;
};

export type DesktopWindowingCapability = {
  closeWindow?: (windowId: number) => Promise<boolean | void> | boolean | void;
  focusWindow?: (windowId: number) => Promise<boolean | void> | boolean | void;
  listWindows?: () =>
    | Promise<DesktopWindowInfo[] | null | undefined>
    | DesktopWindowInfo[]
    | null
    | undefined;
  openWindow?: (
    input?: OpenDesktopWindowInput
  ) => Promise<DesktopWindowInfo | null | undefined> | DesktopWindowInfo | null | undefined;
};

export type DesktopTrayCapability = {
  getState?: () =>
    | Promise<DesktopTrayState | null | undefined>
    | DesktopTrayState
    | null
    | undefined;
  setEnabled?: (
    enabled: boolean
  ) => Promise<DesktopTrayState | null | undefined> | DesktopTrayState | null | undefined;
};

export type DesktopNotificationCapability = {
  show?: (input: DesktopNotificationInput) => Promise<boolean | void> | boolean | void;
};

export type DesktopShellCapability = {
  openExternalUrl?: (url: string) => Promise<boolean | void> | boolean | void;
  revealItemInDir?: (path: string) => Promise<boolean | void> | boolean | void;
};

export type DesktopBrowserDebugCapability = {
  getSession?: () =>
    | Promise<DesktopBrowserDebugSessionInfo | null | undefined>
    | DesktopBrowserDebugSessionInfo
    | null
    | undefined;
  ensureSession?: (
    input?: DesktopBrowserDebugSessionInput
  ) =>
    | Promise<DesktopBrowserDebugSessionInfo | null | undefined>
    | DesktopBrowserDebugSessionInfo
    | null
    | undefined;
};

export type DesktopHostCapabilities = {
  app?: DesktopAppCapability;
  session?: DesktopSessionCapability;
  window?: DesktopWindowCapability;
  windowing?: DesktopWindowingCapability;
  tray?: DesktopTrayCapability;
  notifications?: DesktopNotificationCapability;
  shell?: DesktopShellCapability;
  browserDebug?: DesktopBrowserDebugCapability;
};

export type DesktopHostBridge = {
  kind: DesktopHostKind;
} & DesktopHostCapabilities;

export type DesktopHostBridgeApi = {
  kind: DesktopHostKind;
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

export function isElectronDesktopHostBridge(value: unknown): value is DesktopHostBridge {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "electron"
  );
}
