export type DesktopHostKind = "electron";
export type DesktopRuntimeHost = "browser" | DesktopHostKind | "tauri";
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

export type DesktopDiagnosticsCapability = {
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
  openPath?: (path: string) => Promise<boolean | void> | boolean | void;
  revealItemInDir?: (path: string) => Promise<boolean | void> | boolean | void;
};

export type DesktopHostCapabilities = {
  app?: DesktopAppCapability;
  launch?: DesktopLaunchCapability;
  updater?: DesktopUpdaterCapability;
  session?: DesktopSessionCapability;
  window?: DesktopWindowCapability;
  windowing?: DesktopWindowingCapability;
  tray?: DesktopTrayCapability;
  notifications?: DesktopNotificationCapability;
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
  diagnostics: {
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
    openPath(path: string): Promise<boolean>;
    revealItemInDir(path: string): Promise<boolean>;
  };
};

export function isElectronDesktopHostBridge(value: unknown): value is DesktopHostBridge {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "electron"
  );
}
