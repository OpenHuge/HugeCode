export type DesktopHostKind = "electron";
export type DesktopRuntimeHost = "browser" | DesktopHostKind;
export type DesktopWindowLabel = "main" | "about";
export type DesktopRuntimeMode = "local" | "remote";
export type DesktopReleaseChannel = "stable" | "beta" | "dev";
export type DesktopUpdateCapability = "automatic" | "manual" | "unsupported";
export type DesktopUpdateMode =
  | "disabled_beta_manual"
  | "disabled_first_run_lock"
  | "disabled_unpacked"
  | "enabled_beta_static_feed"
  | "enabled_stable_public_service"
  | "misconfigured"
  | "unsupported_platform";
export type DesktopUpdateProvider = "none" | "public-github" | "static-storage";
export type DesktopLaunchIntentKind =
  | "launch"
  | "protocol"
  | "workspace"
  | "post-install"
  | "post-update";
export type DesktopUpdateStage =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "latest"
  | "error";

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

export type DesktopDiagnosticsInfo = {
  crashDumpsDirectoryPath: string | null;
  incidentLogPath: string | null;
  lastIncidentAt: string | null;
  logsDirectoryPath: string | null;
  recentIncidentCount: number;
  reportIssueUrl: string | null;
  supportSnapshotText: string | null;
};

export type DesktopAppInfo = {
  channel: DesktopReleaseChannel;
  platform: NodeJS.Platform;
  updateCapability: DesktopUpdateCapability;
  updateMessage?: string | null;
  updateMode: DesktopUpdateMode;
  version: string | null;
};

export type DesktopLaunchIntent = {
  kind: DesktopLaunchIntentKind;
  launchPath?: string | null;
  launchPathKind?: "directory" | "file" | null;
  receivedAt: string;
  url?: string | null;
  workspaceLabel?: string | null;
  workspacePath?: string | null;
};

export type DesktopUpdateState = {
  capability: DesktopUpdateCapability;
  downloadedBytes?: number;
  error?: string | null;
  message?: string | null;
  mode: DesktopUpdateMode;
  provider: DesktopUpdateProvider;
  releaseUrl?: string | null;
  stage: DesktopUpdateStage;
  totalBytes?: number;
  version?: string | null;
};

export type OpenDesktopWindowInput = {
  duplicate?: boolean;
  launchPath?: string | null;
  launchPathKind?: "directory" | "file" | null;
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

export type LocalChromeDebuggerEndpointDescriptor = {
  browserName?: string | null;
  discoverySource: "devtools-active-port" | "remote-debugging-port";
  httpBaseUrl?: string | null;
  profileLabel?: string | null;
  webSocketDebuggerUrl: string;
};
export type DesktopOpenDialogInput = {
  directory?: boolean;
  multiple?: boolean;
};

export type DesktopOpenDialogResult = string | string[] | null;

export type DesktopOpenPathInInput = {
  appName?: string | null;
  args?: string[] | null;
  command?: string | null;
  path: string;
};

export type DesktopAppCapability = {
  getInfo?: () => Promise<DesktopAppInfo | null | undefined> | DesktopAppInfo | null | undefined;
  getVersion?: () => Promise<string | null | undefined> | string | null | undefined;
};

export type DesktopLaunchCapability = {
  consumePendingIntent?: () =>
    | Promise<DesktopLaunchIntent | null | undefined>
    | DesktopLaunchIntent
    | null
    | undefined;
  onIntent?: (
    listener: (intent: DesktopLaunchIntent) => void
  ) => (() => void) | void | Promise<() => void | void>;
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

export type DesktopDialogCapability = {
  open?: (
    input?: DesktopOpenDialogInput
  ) => Promise<DesktopOpenDialogResult | undefined> | DesktopOpenDialogResult | undefined;
};

export type DesktopDiagnosticsCapability = {
  copySupportSnapshot?: () => Promise<boolean | void> | boolean | void;
  getInfo?: () =>
    | Promise<DesktopDiagnosticsInfo | null | undefined>
    | DesktopDiagnosticsInfo
    | null
    | undefined;
};

export type DesktopUpdaterCapability = {
  checkForUpdates?: () =>
    | Promise<DesktopUpdateState | null | undefined>
    | DesktopUpdateState
    | null
    | undefined;
  getState?: () =>
    | Promise<DesktopUpdateState | null | undefined>
    | DesktopUpdateState
    | null
    | undefined;
  onState?: (listener: (state: DesktopUpdateState) => void) => (() => void) | void;
  restartToApplyUpdate?: () => Promise<boolean | void> | boolean | void;
};

export type DesktopShellCapability = {
  openExternalUrl?: (url: string) => Promise<boolean | void> | boolean | void;
  openPathIn?: (input: DesktopOpenPathInInput) => Promise<boolean | void> | boolean | void;
  openPath?: (path: string) => Promise<boolean | void> | boolean | void;
  revealItemInDir?: (path: string) => Promise<boolean | void> | boolean | void;
};

export type DesktopBrowserDebugCapability = {
  listLocalChromeDebuggerEndpoints?: () =>
    | Promise<LocalChromeDebuggerEndpointDescriptor[] | null | undefined>
    | LocalChromeDebuggerEndpointDescriptor[]
    | null
    | undefined;
};

export type DesktopHostCapabilities = {
  app?: DesktopAppCapability;
  browserDebug?: DesktopBrowserDebugCapability;
  launch?: DesktopLaunchCapability;
  updater?: DesktopUpdaterCapability;
  session?: DesktopSessionCapability;
  window?: DesktopWindowCapability;
  windowing?: DesktopWindowingCapability;
  tray?: DesktopTrayCapability;
  notifications?: DesktopNotificationCapability;
  dialogs?: DesktopDialogCapability;
  diagnostics?: DesktopDiagnosticsCapability;
  shell?: DesktopShellCapability;
};

export type DesktopHostBridge = {
  kind: DesktopHostKind;
} & DesktopHostCapabilities;

export type DesktopHostBridgeApi = {
  kind: DesktopHostKind;
  app: {
    getInfo(): Promise<DesktopAppInfo | null>;
    getVersion(): Promise<string | null>;
  };
  browserDebug: {
    listLocalChromeDebuggerEndpoints(): Promise<LocalChromeDebuggerEndpointDescriptor[]>;
  };
  launch: {
    consumePendingIntent(): Promise<DesktopLaunchIntent | null>;
    onIntent(listener: (intent: DesktopLaunchIntent) => void): () => void;
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
  dialogs: {
    open(input?: DesktopOpenDialogInput): Promise<DesktopOpenDialogResult>;
  };
  diagnostics: {
    copySupportSnapshot(): Promise<boolean>;
    getInfo(): Promise<DesktopDiagnosticsInfo | null>;
  };
  updater: {
    checkForUpdates(): Promise<DesktopUpdateState>;
    getState(): Promise<DesktopUpdateState>;
    onState(listener: (state: DesktopUpdateState) => void): () => void;
    restartToApplyUpdate(): Promise<boolean>;
  };
  shell: {
    openExternalUrl(url: string): Promise<boolean>;
    openPathIn(input: DesktopOpenPathInInput): Promise<boolean>;
    openPath(path: string): Promise<boolean>;
    revealItemInDir(path: string): Promise<boolean>;
  };
};

export function isElectronDesktopHostBridge(value: unknown): value is DesktopHostBridge {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "electron"
  );
}
