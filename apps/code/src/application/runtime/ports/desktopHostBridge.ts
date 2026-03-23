export type DesktopHostKind = "electron";
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

export type DesktopHostBridge = {
  kind: DesktopHostKind;
  app?: {
    getVersion?: () => Promise<string | null | undefined> | string | null | undefined;
  };
  session?: {
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
  window?: {
    getLabel?: () => Promise<string | null | undefined> | string | null | undefined;
  };
  windowing?: {
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
  tray?: {
    getState?: () =>
      | Promise<DesktopTrayState | null | undefined>
      | DesktopTrayState
      | null
      | undefined;
    setEnabled?: (
      enabled: boolean
    ) => Promise<DesktopTrayState | null | undefined> | DesktopTrayState | null | undefined;
  };
  notifications?: {
    show?: (input: DesktopNotificationInput) => Promise<boolean | void> | boolean | void;
  };
  shell?: {
    openExternalUrl?: (url: string) => Promise<boolean | void> | boolean | void;
    revealItemInDir?: (path: string) => Promise<boolean | void> | boolean | void;
  };
  browserDebug?: {
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
};

declare global {
  interface Window {
    hugeCodeDesktopHost?: DesktopHostBridge;
  }
}

export function getDesktopHostBridge(): DesktopHostBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const bridge = window.hugeCodeDesktopHost;
  if (!bridge || bridge.kind !== "electron") {
    return null;
  }

  return bridge;
}
