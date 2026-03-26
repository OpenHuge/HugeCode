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

export type DesktopBrowserWorkspaceSessionKind = "preview" | "debug" | "research";
export type DesktopBrowserWorkspaceHost = "pane" | "window";
export type DesktopBrowserWorkspaceProfileMode = "isolated" | "shared";
export type DesktopBrowserWorkspacePreviewServerStatus =
  | "unknown"
  | "starting"
  | "ready"
  | "failed";
export type DesktopBrowserWorkspaceLoadingState = "idle" | "loading" | "ready" | "failed";
export type DesktopBrowserWorkspaceNavigationAction = "back" | "forward" | "reload";

export type DesktopBrowserWorkspacePaneBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesktopBrowserWorkspaceSessionQuery = {
  kind?: DesktopBrowserWorkspaceSessionKind | null;
  sessionId?: string | null;
  workspaceId?: string | null;
};

export type DesktopBrowserWorkspaceSessionInput = {
  kind?: DesktopBrowserWorkspaceSessionKind | null;
  sessionId?: string | null;
  host?: DesktopBrowserWorkspaceHost | null;
  workspaceId?: string | null;
  targetUrl?: string | null;
  focus?: boolean;
  reset?: boolean;
  profileMode?: DesktopBrowserWorkspaceProfileMode | null;
  canAgentAttach?: boolean | null;
  agentAttached?: boolean | null;
  devtoolsOpen?: boolean | null;
  previewServerStatus?: DesktopBrowserWorkspacePreviewServerStatus | null;
};

export type DesktopBrowserWorkspaceSessionInfo = {
  sessionId: string;
  kind: DesktopBrowserWorkspaceSessionKind;
  host: DesktopBrowserWorkspaceHost;
  browserUrl: string;
  currentUrl: string | null;
  targetUrl: string | null;
  workspaceId: string | null;
  windowId: number | null;
  partitionId: string;
  profileMode: DesktopBrowserWorkspaceProfileMode;
  canAgentAttach: boolean;
  agentAttached: boolean;
  devtoolsOpen: boolean;
  previewServerStatus: DesktopBrowserWorkspacePreviewServerStatus;
  pageTitle: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  paneWindowId: number | null;
  paneVisible: boolean;
  loadingState: DesktopBrowserWorkspaceLoadingState;
  lastError: string | null;
  crashCount: number;
  consoleTail: string[];
  lastVerifiedTarget: string | null;
  lastVerifiedAt: string | null;
};

export type DesktopBrowserWorkspaceSetHostInput = {
  focus?: boolean;
  host: DesktopBrowserWorkspaceHost;
  sessionId: string;
};

export type DesktopBrowserWorkspaceSetProfileModeInput = {
  profileMode: DesktopBrowserWorkspaceProfileMode;
  sessionId: string;
};

export type DesktopBrowserWorkspaceSetAgentAttachedInput = {
  attached: boolean;
  sessionId: string;
};

export type DesktopBrowserWorkspaceSetPreviewServerStatusInput = {
  previewServerStatus: DesktopBrowserWorkspacePreviewServerStatus;
  sessionId: string;
};

export type DesktopBrowserWorkspaceSetDevtoolsOpenInput = {
  open: boolean;
  sessionId: string;
};

export type DesktopBrowserWorkspaceSetPaneStateInput = {
  bounds?: DesktopBrowserWorkspacePaneBounds | null;
  sessionId: string;
  visible: boolean;
};

export type DesktopBrowserWorkspaceNavigateInput = {
  action: DesktopBrowserWorkspaceNavigationAction;
  sessionId: string;
};

export type DesktopBrowserWorkspaceReportVerificationInput = {
  sessionId: string;
  targetUrl?: string | null;
  verifiedAt?: string | null;
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

export type DesktopBrowserWorkspaceCapability = {
  ensureSession?: (
    input?: DesktopBrowserWorkspaceSessionInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  getSession?: (
    query?: DesktopBrowserWorkspaceSessionQuery
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  listSessions?: () =>
    | Promise<DesktopBrowserWorkspaceSessionInfo[] | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo[]
    | null
    | undefined;
  setAgentAttached?: (
    input: DesktopBrowserWorkspaceSetAgentAttachedInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  setDevtoolsOpen?: (
    input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  setPaneState?: (
    input: DesktopBrowserWorkspaceSetPaneStateInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  navigate?: (
    input: DesktopBrowserWorkspaceNavigateInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  setHost?: (
    input: DesktopBrowserWorkspaceSetHostInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  setPreviewServerStatus?: (
    input: DesktopBrowserWorkspaceSetPreviewServerStatusInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  setProfileMode?: (
    input: DesktopBrowserWorkspaceSetProfileModeInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
  reportVerification?: (
    input: DesktopBrowserWorkspaceReportVerificationInput
  ) =>
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined;
};

export type DesktopHostCapabilities = {
  app?: DesktopAppCapability;
  browserWorkspace?: DesktopBrowserWorkspaceCapability;
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
  browserWorkspace: {
    ensureSession(
      input?: DesktopBrowserWorkspaceSessionInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    getSession(
      query?: DesktopBrowserWorkspaceSessionQuery
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    listSessions(): Promise<DesktopBrowserWorkspaceSessionInfo[]>;
    setAgentAttached(
      input: DesktopBrowserWorkspaceSetAgentAttachedInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    setDevtoolsOpen(
      input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    setPaneState(
      input: DesktopBrowserWorkspaceSetPaneStateInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    navigate(
      input: DesktopBrowserWorkspaceNavigateInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    setHost(
      input: DesktopBrowserWorkspaceSetHostInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    setPreviewServerStatus(
      input: DesktopBrowserWorkspaceSetPreviewServerStatusInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    setProfileMode(
      input: DesktopBrowserWorkspaceSetProfileModeInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
    reportVerification(
      input: DesktopBrowserWorkspaceReportVerificationInput
    ): Promise<DesktopBrowserWorkspaceSessionInfo | null>;
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
