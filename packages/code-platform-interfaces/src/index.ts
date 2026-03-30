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

export type DesktopBrowserExtractionStatus = "succeeded" | "partial" | "empty" | "failed";

export type DesktopBrowserExtractionTraceStage =
  | "availability"
  | "capture"
  | "extract"
  | "normalize"
  | "transport";

export type DesktopBrowserExtractionTraceEntry = {
  stage: DesktopBrowserExtractionTraceStage;
  message: string;
  at: string;
  code?: string | null;
  detail?: string | null;
};

export type DesktopBrowserExtractionRequest = {
  maxCharacters?: number;
  selector?: string | null;
  sourceUrl?: string | null;
};

export type DesktopBrowserExtractionResult = {
  status: DesktopBrowserExtractionStatus;
  normalizedText: string | null;
  snippet: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  traceId?: string | null;
  trace: DesktopBrowserExtractionTraceEntry[];
};

export type DesktopBrowserExtractionCapability = {
  extract?: (
    input?: DesktopBrowserExtractionRequest
  ) =>
    | Promise<DesktopBrowserExtractionResult | null | undefined>
    | DesktopBrowserExtractionResult
    | null
    | undefined;
  getLastResult?: () =>
    | Promise<DesktopBrowserExtractionResult | null | undefined>
    | DesktopBrowserExtractionResult
    | null
    | undefined;
};

export type DesktopBrowserAssessmentTarget =
  | {
      kind: "fixture";
      fixtureName: string;
    }
  | {
      kind: "route";
      routePath: string;
    };

export type DesktopBrowserAssessmentStatus = "passed" | "failed" | "error";

export type DesktopBrowserAssessmentTraceStage =
  | "proxy"
  | "render"
  | "collect"
  | "audit"
  | "transport";

export type DesktopBrowserAssessmentTraceEntry = {
  stage: DesktopBrowserAssessmentTraceStage;
  message: string;
  at: string;
  code?: string | null;
  detail?: string | null;
};

export type DesktopBrowserAssessmentConsoleEntry = {
  level: "log" | "info" | "warn" | "error";
  message: string;
  line?: number | null;
  sourceId?: string | null;
};

export type DesktopBrowserAssessmentAccessibilityFailure = {
  code: string;
  message: string;
  selector?: string | null;
};

export type DesktopBrowserAssessmentDomSnapshot = {
  childElementCount: number;
  html: string | null;
  selector: string | null;
  selectorMatched: boolean;
  text: string | null;
};

export type DesktopBrowserAssessmentRequest = {
  selector?: string | null;
  target: DesktopBrowserAssessmentTarget;
  waitForMs?: number;
};

export type DesktopBrowserAssessmentResult = {
  status: DesktopBrowserAssessmentStatus;
  target: DesktopBrowserAssessmentTarget;
  domSnapshot: DesktopBrowserAssessmentDomSnapshot | null;
  consoleEntries: DesktopBrowserAssessmentConsoleEntry[];
  accessibilityFailures: DesktopBrowserAssessmentAccessibilityFailure[];
  sourceUrl?: string | null;
  title?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  traceId?: string | null;
  trace: DesktopBrowserAssessmentTraceEntry[];
};

export type DesktopBrowserAssessmentCapability = {
  assess?: (
    input: DesktopBrowserAssessmentRequest
  ) =>
    | Promise<DesktopBrowserAssessmentResult | null | undefined>
    | DesktopBrowserAssessmentResult
    | null
    | undefined;
  getLastResult?: () =>
    | Promise<DesktopBrowserAssessmentResult | null | undefined>
    | DesktopBrowserAssessmentResult
    | null
    | undefined;
};

export const DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE = "browser-assessment-proxy";
export const DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM = "__hugecode_browser_assessment";

const DESKTOP_BROWSER_ASSESSMENT_TARGET_KIND_QUERY_PARAM = "browserAssessmentTargetKind";
const DESKTOP_BROWSER_ASSESSMENT_TARGET_FIXTURE_QUERY_PARAM = "browserAssessmentTargetFixture";
const DESKTOP_BROWSER_ASSESSMENT_TARGET_ROUTE_QUERY_PARAM = "browserAssessmentTargetRoute";
const DESKTOP_BROWSER_ASSESSMENT_SELECTOR_QUERY_PARAM = "browserAssessmentSelector";
const DESKTOP_BROWSER_ASSESSMENT_WAIT_MS_QUERY_PARAM = "browserAssessmentWaitMs";
const DESKTOP_BROWSER_ASSESSMENT_PROXY_PATH = "/fixtures.html";
const DESKTOP_BROWSER_ASSESSMENT_BASE_URL = "https://desktop.hugecode.invalid";

export type DesktopBrowserAssessmentProxyRequestRead =
  | {
      ok: true;
      request: DesktopBrowserAssessmentRequest;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

function readNonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBrowserAssessmentWaitMs(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : undefined;
}

function readBrowserAssessmentWaitMs(value: string | null): number | undefined {
  const trimmed = readNonEmptyString(value);
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return normalizeBrowserAssessmentWaitMs(parsed);
}

export function buildDesktopBrowserAssessmentTargetUrl(
  target: DesktopBrowserAssessmentTarget
): string {
  if (target.kind === "fixture") {
    const fixtureName = readNonEmptyString(target.fixtureName);
    if (!fixtureName) {
      throw new Error("Browser assessment fixture targets require a non-empty fixture name.");
    }
    if (fixtureName === DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE) {
      throw new Error(
        "Browser assessment proxy cannot target itself as a fixture. This prevents infinite feedback loops."
      );
    }
    const searchParams = new URLSearchParams({
      fixture: fixtureName,
      [DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM]: "1",
    });
    return `${DESKTOP_BROWSER_ASSESSMENT_PROXY_PATH}?${searchParams.toString()}`;
  }

  const routePath = readNonEmptyString(target.routePath);
  if (!routePath || !routePath.startsWith("/")) {
    throw new Error("Browser assessment route targets must use an absolute in-app route path.");
  }
  const routeUrl = new URL(routePath, DESKTOP_BROWSER_ASSESSMENT_BASE_URL);
  if (
    routeUrl.pathname === DESKTOP_BROWSER_ASSESSMENT_PROXY_PATH &&
    routeUrl.searchParams.get("fixture") === DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE
  ) {
    throw new Error(
      "Browser assessment proxy cannot target itself as a route. This prevents infinite feedback loops."
    );
  }
  if (routeUrl.searchParams.has(DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM)) {
    throw new Error(
      "Browser assessment targets cannot predeclare the assessment sentinel. The proxy appends it exactly once."
    );
  }
  routeUrl.searchParams.set(DESKTOP_BROWSER_ASSESSMENT_SENTINEL_QUERY_PARAM, "1");
  return `${routeUrl.pathname}${routeUrl.search}${routeUrl.hash}`;
}

export function buildDesktopBrowserAssessmentProxyPath(
  input: DesktopBrowserAssessmentRequest
): string {
  const searchParams = new URLSearchParams({
    fixture: DESKTOP_BROWSER_ASSESSMENT_PROXY_FIXTURE,
    [DESKTOP_BROWSER_ASSESSMENT_TARGET_KIND_QUERY_PARAM]: input.target.kind,
  });
  if (input.target.kind === "fixture") {
    const fixtureName = readNonEmptyString(input.target.fixtureName);
    if (!fixtureName) {
      throw new Error("Browser assessment fixture targets require a non-empty fixture name.");
    }
    searchParams.set(DESKTOP_BROWSER_ASSESSMENT_TARGET_FIXTURE_QUERY_PARAM, fixtureName);
  } else {
    const routePath = readNonEmptyString(input.target.routePath);
    if (!routePath) {
      throw new Error("Browser assessment route targets require a non-empty route path.");
    }
    searchParams.set(DESKTOP_BROWSER_ASSESSMENT_TARGET_ROUTE_QUERY_PARAM, routePath);
  }
  const selector = readNonEmptyString(input.selector);
  if (selector) {
    searchParams.set(DESKTOP_BROWSER_ASSESSMENT_SELECTOR_QUERY_PARAM, selector);
  }
  const waitForMs = normalizeBrowserAssessmentWaitMs(input.waitForMs);
  if (waitForMs !== undefined) {
    searchParams.set(DESKTOP_BROWSER_ASSESSMENT_WAIT_MS_QUERY_PARAM, String(waitForMs));
  }
  return `${DESKTOP_BROWSER_ASSESSMENT_PROXY_PATH}?${searchParams.toString()}`;
}

export function readDesktopBrowserAssessmentProxyRequest(
  input: string | URLSearchParams
): DesktopBrowserAssessmentProxyRequestRead {
  const searchParams =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : new URLSearchParams(input);
  const targetKind = readNonEmptyString(
    searchParams.get(DESKTOP_BROWSER_ASSESSMENT_TARGET_KIND_QUERY_PARAM)
  );
  const selector =
    readNonEmptyString(searchParams.get(DESKTOP_BROWSER_ASSESSMENT_SELECTOR_QUERY_PARAM)) ?? null;
  const waitForMs = readBrowserAssessmentWaitMs(
    searchParams.get(DESKTOP_BROWSER_ASSESSMENT_WAIT_MS_QUERY_PARAM)
  );

  if (targetKind === "fixture") {
    const fixtureName = readNonEmptyString(
      searchParams.get(DESKTOP_BROWSER_ASSESSMENT_TARGET_FIXTURE_QUERY_PARAM)
    );
    if (!fixtureName) {
      return {
        ok: false,
        code: "BROWSER_ASSESSMENT_PROXY_FIXTURE_REQUIRED",
        message: "Browser assessment proxy requires a fixture target when target kind is fixture.",
      };
    }
    return {
      ok: true,
      request: {
        target: {
          kind: "fixture",
          fixtureName,
        },
        selector,
        ...(waitForMs !== undefined ? { waitForMs } : {}),
      },
    };
  }

  if (targetKind === "route") {
    const routePath = readNonEmptyString(
      searchParams.get(DESKTOP_BROWSER_ASSESSMENT_TARGET_ROUTE_QUERY_PARAM)
    );
    if (!routePath) {
      return {
        ok: false,
        code: "BROWSER_ASSESSMENT_PROXY_ROUTE_REQUIRED",
        message: "Browser assessment proxy requires a route target when target kind is route.",
      };
    }
    return {
      ok: true,
      request: {
        target: {
          kind: "route",
          routePath,
        },
        selector,
        ...(waitForMs !== undefined ? { waitForMs } : {}),
      },
    };
  }

  return {
    ok: false,
    code: "BROWSER_ASSESSMENT_PROXY_TARGET_REQUIRED",
    message:
      "Browser assessment proxy requires browserAssessmentTargetKind=fixture|route before it can render a target.",
  };
}

export type DesktopHostCapabilities = {
  app?: DesktopAppCapability;
  browserAssessment?: DesktopBrowserAssessmentCapability;
  browserDebug?: DesktopBrowserDebugCapability;
  browserExtraction?: DesktopBrowserExtractionCapability;
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
  browserAssessment?: {
    assess(input: DesktopBrowserAssessmentRequest): Promise<DesktopBrowserAssessmentResult | null>;
    getLastResult(): Promise<DesktopBrowserAssessmentResult | null>;
  };
  browserExtraction?: {
    extract(
      input?: DesktopBrowserExtractionRequest
    ): Promise<DesktopBrowserExtractionResult | null>;
    getLastResult(): Promise<DesktopBrowserExtractionResult | null>;
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

export const DESKTOP_HOST_IPC_CHANNELS = {
  getAppInfo: "hugecode:desktop-host:get-app-info",
  getAppVersion: "hugecode:desktop-host:get-app-version",
  listLocalChromeDebuggerEndpoints: "hugecode:desktop-host:list-local-chrome-debugger-endpoints",
  assessBrowserSurface: "hugecode:desktop-host:assess-browser-surface",
  getLastBrowserAssessmentResult: "hugecode:desktop-host:get-last-browser-assessment-result",
  extractBrowserContent: "hugecode:desktop-host:extract-browser-content",
  getLastBrowserExtractionResult: "hugecode:desktop-host:get-last-browser-extraction-result",
  consumePendingLaunchIntent: "hugecode:desktop-host:consume-pending-launch-intent",
  pushLaunchIntent: "hugecode:desktop-host:push-launch-intent",
  pushUpdateState: "hugecode:desktop-host:push-update-state",
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
  openDialog: "hugecode:desktop-host:open-dialog",
  getDiagnosticsInfo: "hugecode:desktop-host:get-diagnostics-info",
  copySupportSnapshot: "hugecode:desktop-host:copy-support-snapshot",
  getUpdateState: "hugecode:desktop-host:get-update-state",
  checkForUpdates: "hugecode:desktop-host:check-for-updates",
  restartToApplyUpdate: "hugecode:desktop-host:restart-to-apply-update",
  openExternalUrl: "hugecode:desktop-host:open-external-url",
  openPathIn: "hugecode:desktop-host:open-path-in",
  openPath: "hugecode:desktop-host:open-path",
  revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
} as const;

export function isElectronDesktopHostBridge(value: unknown): value is DesktopHostBridge {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "electron"
  );
}
