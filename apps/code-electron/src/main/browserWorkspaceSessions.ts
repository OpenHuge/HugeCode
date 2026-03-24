import { createRequire } from "node:module";
import type {
  BrowserWindow as ElectronBrowserWindow,
  HandlerDetails,
  IpcMainInvokeEvent,
  WebContents,
  WebContentsView as ElectronWebContentsView,
} from "electron";
import type {
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
  DesktopBrowserWorkspaceHost,
  DesktopBrowserWorkspaceLoadingState,
  DesktopBrowserWorkspaceNavigateInput,
  DesktopBrowserWorkspacePaneBounds,
  DesktopBrowserWorkspacePreviewServerStatus,
  DesktopBrowserWorkspaceProfileMode,
  DesktopBrowserWorkspaceReportVerificationInput,
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionInput,
  DesktopBrowserWorkspaceSessionKind,
  DesktopBrowserWorkspaceSessionQuery,
  DesktopBrowserWorkspaceSetAgentAttachedInput,
  DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  DesktopBrowserWorkspaceSetHostInput,
  DesktopBrowserWorkspaceSetPaneStateInput,
  DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  DesktopBrowserWorkspaceSetProfileModeInput,
} from "../shared/ipc.js";

const require = createRequire(import.meta.url);
const { BrowserWindow, WebContentsView } = require("electron") as {
  BrowserWindow: typeof import("electron").BrowserWindow;
  WebContentsView: typeof import("electron").WebContentsView;
};

const DEFAULT_BROWSER_DEBUG_PORT = 9333;
const DEFAULT_RESEARCH_TARGET_URL = "https://chatgpt.com/";
const DEFAULT_DEBUG_TARGET_URL = "https://chatgpt.com/";
const BROWSER_WORKSPACE_WINDOW_SIZE = {
  width: 1440,
  height: 960,
};
const DEFAULT_CONSOLE_TAIL_LIMIT = 8;

type BrowserWorkspaceRecord = {
  agentAttached: boolean;
  attachedPaneWindowId: number | null;
  canAgentAttach: boolean;
  consoleTail: string[];
  crashCount: number;
  pageTitle: string | null;
  host: DesktopBrowserWorkspaceHost;
  kind: DesktopBrowserWorkspaceSessionKind;
  lastError: string | null;
  lastKnownUrl: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedTarget: string | null;
  loadingState: DesktopBrowserWorkspaceLoadingState;
  paneBounds: DesktopBrowserWorkspacePaneBounds | null;
  paneVisible: boolean;
  paneWindowId: number | null;
  partitionId: string;
  previewServerStatus: DesktopBrowserWorkspacePreviewServerStatus;
  profileMode: DesktopBrowserWorkspaceProfileMode;
  sessionId: string;
  targetUrl: string | null;
  view: ElectronWebContentsView | null;
  window: ElectronBrowserWindow | null;
  workspaceId: string | null;
};

const sessionRegistry = new Map<string, BrowserWorkspaceRecord>();

function normalizeWorkspaceId(workspaceId?: string | null): string | null {
  const trimmed = workspaceId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeSessionKind(
  kind?: DesktopBrowserWorkspaceSessionKind | null
): DesktopBrowserWorkspaceSessionKind {
  return kind === "preview" || kind === "research" ? kind : "debug";
}

function normalizeHost(host?: DesktopBrowserWorkspaceHost | null): DesktopBrowserWorkspaceHost {
  return host === "pane" ? "pane" : "window";
}

function normalizeProfileMode(
  profileMode?: DesktopBrowserWorkspaceProfileMode | null
): DesktopBrowserWorkspaceProfileMode {
  return profileMode === "shared" ? "shared" : "isolated";
}

function normalizePreviewServerStatus(
  previewServerStatus?: DesktopBrowserWorkspacePreviewServerStatus | null
): DesktopBrowserWorkspacePreviewServerStatus {
  if (
    previewServerStatus === "starting" ||
    previewServerStatus === "ready" ||
    previewServerStatus === "failed"
  ) {
    return previewServerStatus;
  }
  return "unknown";
}

function normalizeLoadingState(
  loadingState?: DesktopBrowserWorkspaceLoadingState | null
): DesktopBrowserWorkspaceLoadingState {
  if (loadingState === "loading" || loadingState === "ready" || loadingState === "failed") {
    return loadingState;
  }
  return "idle";
}

function defaultTargetUrlForKind(kind: DesktopBrowserWorkspaceSessionKind): string | null {
  if (kind === "preview") {
    return null;
  }
  return kind === "research" ? DEFAULT_RESEARCH_TARGET_URL : DEFAULT_DEBUG_TARGET_URL;
}

function normalizeTargetUrl(
  kind: DesktopBrowserWorkspaceSessionKind,
  targetUrl?: string | null
): string | null {
  const trimmed = targetUrl?.trim();
  if (!trimmed) {
    return defaultTargetUrlForKind(kind);
  }
  return trimmed;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isLoopbackPreviewTarget(url: string | null): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      isLoopbackHostname(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function assertAllowedTargetUrl(
  kind: DesktopBrowserWorkspaceSessionKind,
  targetUrl: string | null
) {
  if (kind === "preview" && targetUrl && !isLoopbackPreviewTarget(targetUrl)) {
    throw new Error("Preview browser workspace sessions only allow loopback targets.");
  }
}

function deriveSessionId(params: {
  kind: DesktopBrowserWorkspaceSessionKind;
  sessionId?: string | null;
  workspaceId?: string | null;
}) {
  const explicitId = params.sessionId?.trim();
  if (explicitId) {
    return explicitId;
  }
  const workspaceId = normalizeWorkspaceId(params.workspaceId) ?? "global";
  return `${workspaceId}:${params.kind}`;
}

function derivePartitionId(params: {
  kind: DesktopBrowserWorkspaceSessionKind;
  profileMode: DesktopBrowserWorkspaceProfileMode;
  workspaceId?: string | null;
}) {
  const workspaceId = normalizeWorkspaceId(params.workspaceId) ?? "global";
  const scope = params.profileMode === "shared" ? "shared-debug" : params.kind;
  return `persist:hugecode-browser-workspace:${workspaceId}:${scope}`;
}

export function resolveBrowserDebugPort(): number {
  const candidate = Number.parseInt(process.env.HUGECODE_ELECTRON_REMOTE_DEBUGGING_PORT ?? "", 10);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : DEFAULT_BROWSER_DEBUG_PORT;
}

export function resolveBrowserDebugUrl(): string {
  return `http://127.0.0.1:${resolveBrowserDebugPort()}`;
}

function focusBrowserWorkspaceWindow(window: ElectronBrowserWindow) {
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function titleForKind(kind: DesktopBrowserWorkspaceSessionKind) {
  if (kind === "preview") {
    return "HugeCode Preview";
  }
  if (kind === "research") {
    return "HugeCode Research Browser";
  }
  return "HugeCode Debug Browser";
}

function appendConsoleTail(record: BrowserWorkspaceRecord, entry: string) {
  const trimmed = entry.trim();
  if (!trimmed) {
    return;
  }
  record.consoleTail = [...record.consoleTail, trimmed].slice(-DEFAULT_CONSOLE_TAIL_LIMIT);
}

function updateLastKnownUrl(record: BrowserWorkspaceRecord, webContents: WebContents) {
  const currentUrl = webContents.getURL().trim();
  record.lastKnownUrl = currentUrl.length > 0 ? currentUrl : record.targetUrl;
}

function bindWorkspaceWebContents(record: BrowserWorkspaceRecord, webContents: WebContents) {
  const syncCurrentUrl = () => {
    updateLastKnownUrl(record, webContents);
  };

  webContents.setWindowOpenHandler(({ url }: HandlerDetails) => {
    if (record.kind === "preview" && !isLoopbackPreviewTarget(url)) {
      record.lastError = `Blocked external preview popup: ${url}`;
      return { action: "deny" };
    }
    void webContents.loadURL(url);
    return { action: "deny" };
  });

  webContents.on("did-start-loading", () => {
    record.loadingState = "loading";
    record.lastError = null;
  });
  webContents.on("page-title-updated", (event, title) => {
    event.preventDefault();
    record.pageTitle = title.trim().length > 0 ? title.trim() : null;
  });
  webContents.on("did-finish-load", () => {
    record.loadingState = "ready";
    record.lastError = null;
    if (!record.pageTitle) {
      const title = webContents.getTitle().trim();
      record.pageTitle = title.length > 0 ? title : null;
    }
    syncCurrentUrl();
  });
  webContents.on("did-navigate", syncCurrentUrl);
  webContents.on("did-navigate-in-page", syncCurrentUrl);
  webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    if (errorCode === -3) {
      return;
    }
    record.loadingState = "failed";
    record.lastError = `${errorDescription} (${validatedUrl})`;
  });
  webContents.on("will-navigate", (event, url) => {
    if (record.kind === "preview" && !isLoopbackPreviewTarget(url)) {
      event.preventDefault();
      record.lastError = `Blocked non-loopback preview navigation: ${url}`;
    }
  });
  webContents.on("console-message", (_event, level, message) => {
    appendConsoleTail(record, `[${level}] ${message}`);
  });
  webContents.on("render-process-gone", (_event, details) => {
    record.crashCount += 1;
    record.loadingState = "failed";
    record.lastError = `Renderer exited: ${details.reason}`;
  });
}

function detachPaneView(record: BrowserWorkspaceRecord) {
  if (!record.view) {
    record.attachedPaneWindowId = null;
    return;
  }
  const attachedWindow =
    record.attachedPaneWindowId !== null ? BrowserWindow.fromId(record.attachedPaneWindowId) : null;
  if (attachedWindow && !attachedWindow.isDestroyed()) {
    attachedWindow.contentView.removeChildView(record.view);
  }
  record.attachedPaneWindowId = null;
  record.view.setVisible(false);
}

function syncPaneHost(record: BrowserWorkspaceRecord) {
  if (!record.view) {
    return;
  }
  if (
    record.host !== "pane" ||
    record.paneVisible !== true ||
    !record.paneBounds ||
    record.paneWindowId === null
  ) {
    detachPaneView(record);
    return;
  }
  const hostWindow = BrowserWindow.fromId(record.paneWindowId);
  if (!hostWindow || hostWindow.isDestroyed()) {
    detachPaneView(record);
    record.lastError = "Preview pane host window is unavailable.";
    return;
  }
  const alreadyAttached = hostWindow.contentView.children.includes(record.view);
  if (!alreadyAttached) {
    detachPaneView(record);
    hostWindow.contentView.addChildView(record.view);
  }
  record.view.setBounds(record.paneBounds);
  record.view.setVisible(true);
}

function createWorkspaceView(record: BrowserWorkspaceRecord): ElectronWebContentsView {
  const nextView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: record.partitionId,
    },
  });
  bindWorkspaceWebContents(record, nextView.webContents);
  record.view = nextView;
  record.loadingState = "idle";
  return nextView;
}

function createWorkspaceWindow(record: BrowserWorkspaceRecord): ElectronBrowserWindow {
  const nextWindow = new BrowserWindow({
    ...BROWSER_WORKSPACE_WINDOW_SIZE,
    show: record.host === "window",
    title: titleForKind(record.kind),
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: record.partitionId,
    },
  });
  bindWorkspaceWebContents(record, nextWindow.webContents);
  nextWindow.on("closed", () => {
    if (record.window?.id === nextWindow.id) {
      record.window = null;
    }
  });
  record.window = nextWindow;
  return nextWindow;
}

function getHostWebContents(record: BrowserWorkspaceRecord): WebContents | null {
  if (record.window && !record.window.isDestroyed()) {
    return record.window.webContents;
  }
  if (record.view && !record.view.webContents.isDestroyed()) {
    return record.view.webContents;
  }
  return null;
}

function destroyView(record: BrowserWorkspaceRecord) {
  if (!record.view) {
    return;
  }
  detachPaneView(record);
  if (!record.view.webContents.isDestroyed()) {
    record.view.webContents.close();
  }
  record.view = null;
}

function destroyWindow(record: BrowserWorkspaceRecord) {
  if (!record.window || record.window.isDestroyed()) {
    record.window = null;
    return;
  }
  record.window.close();
  record.window = null;
}

function resetHost(record: BrowserWorkspaceRecord) {
  destroyWindow(record);
  destroyView(record);
}

async function loadTarget(record: BrowserWorkspaceRecord, targetUrl: string | null) {
  const webContents = getHostWebContents(record);
  if (!webContents || !targetUrl) {
    return;
  }
  if (webContents.getURL().trim() === targetUrl.trim()) {
    record.lastKnownUrl = targetUrl;
    return;
  }
  await webContents.loadURL(targetUrl);
  record.lastKnownUrl = targetUrl;
}

async function waitForBrowserDebugEndpoint(timeoutMs = 5_000): Promise<string> {
  const browserUrl = resolveBrowserDebugUrl();
  const deadline = Date.now() + timeoutMs;
  let lastError = "browser workspace endpoint did not become ready";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${browserUrl}/json/version`, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) {
        return browserUrl;
      }
      lastError = `browser workspace endpoint responded with ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(lastError);
}

function toSessionInfo(record: BrowserWorkspaceRecord): DesktopBrowserWorkspaceSessionInfo {
  const hostWebContents = getHostWebContents(record);
  const currentUrl = hostWebContents?.isDestroyed()
    ? record.lastKnownUrl
    : hostWebContents?.getURL().trim() || record.lastKnownUrl;
  return {
    sessionId: record.sessionId,
    kind: record.kind,
    host: record.host,
    browserUrl: resolveBrowserDebugUrl(),
    currentUrl: currentUrl && currentUrl.length > 0 ? currentUrl : null,
    targetUrl: record.targetUrl,
    workspaceId: record.workspaceId,
    windowId: record.window && !record.window.isDestroyed() ? record.window.id : null,
    partitionId: record.partitionId,
    profileMode: record.profileMode,
    canAgentAttach: record.canAgentAttach,
    agentAttached: record.agentAttached,
    devtoolsOpen: hostWebContents ? hostWebContents.isDevToolsOpened() : false,
    previewServerStatus: record.previewServerStatus,
    pageTitle: record.pageTitle,
    canGoBack: hostWebContents ? hostWebContents.canGoBack() : false,
    canGoForward: hostWebContents ? hostWebContents.canGoForward() : false,
    paneWindowId: record.paneWindowId,
    paneVisible: record.paneVisible,
    loadingState: record.loadingState,
    lastError: record.lastError,
    crashCount: record.crashCount,
    consoleTail: [...record.consoleTail],
    lastVerifiedTarget: record.lastVerifiedTarget,
    lastVerifiedAt: record.lastVerifiedAt,
  };
}

function getRecord(query?: DesktopBrowserWorkspaceSessionQuery): BrowserWorkspaceRecord | null {
  const sessionId = query?.sessionId?.trim();
  if (sessionId) {
    return sessionRegistry.get(sessionId) ?? null;
  }
  if (!query?.kind) {
    return null;
  }
  const derivedSessionId = deriveSessionId({
    kind: normalizeSessionKind(query.kind),
    workspaceId: query.workspaceId ?? null,
  });
  return sessionRegistry.get(derivedSessionId) ?? null;
}

async function ensureWorkspaceSessionInternal(
  input: DesktopBrowserWorkspaceSessionInput = {}
): Promise<DesktopBrowserWorkspaceSessionInfo> {
  const kind = normalizeSessionKind(input.kind);
  const sessionId = deriveSessionId({
    kind,
    sessionId: input.sessionId ?? null,
    workspaceId: input.workspaceId ?? null,
  });
  const workspaceId = normalizeWorkspaceId(input.workspaceId);
  const targetUrl = normalizeTargetUrl(kind, input.targetUrl);
  assertAllowedTargetUrl(kind, targetUrl);
  const host = normalizeHost(input.host);
  const profileMode = normalizeProfileMode(input.profileMode);
  const previewServerStatus = normalizePreviewServerStatus(input.previewServerStatus);
  const canAgentAttach = input.canAgentAttach !== false;
  const agentAttached = input.agentAttached === true;
  let record = sessionRegistry.get(sessionId) ?? null;

  const nextPartitionId = derivePartitionId({ kind, profileMode, workspaceId });
  const requiresReset =
    input.reset === true ||
    !record ||
    record.partitionId !== nextPartitionId ||
    record.host !== host ||
    (host === "window" && record.window?.isDestroyed() === true) ||
    (host === "pane" && record.view?.webContents.isDestroyed() === true);

  if (record && requiresReset) {
    resetHost(record);
  }

  if (!record) {
    record = {
      agentAttached,
      attachedPaneWindowId: null,
      canAgentAttach,
      consoleTail: [],
      crashCount: 0,
      pageTitle: null,
      host,
      kind,
      lastError: null,
      lastKnownUrl: targetUrl,
      lastVerifiedAt: null,
      lastVerifiedTarget: null,
      loadingState: normalizeLoadingState(targetUrl ? "loading" : "idle"),
      paneBounds: null,
      paneVisible: false,
      paneWindowId: null,
      partitionId: nextPartitionId,
      previewServerStatus,
      profileMode,
      sessionId,
      targetUrl,
      view: null,
      window: null,
      workspaceId,
    };
    sessionRegistry.set(sessionId, record);
  } else {
    record.kind = kind;
    record.host = host;
    record.targetUrl = targetUrl;
    record.workspaceId = workspaceId;
    record.canAgentAttach = canAgentAttach;
    record.agentAttached = agentAttached;
    record.previewServerStatus = previewServerStatus;
    record.profileMode = profileMode;
    record.partitionId = nextPartitionId;
    if (requiresReset) {
      record.loadingState = normalizeLoadingState(targetUrl ? "loading" : "idle");
      record.lastError = null;
    }
  }

  if (host === "window") {
    const activeWindow =
      record.window && !record.window.isDestroyed() ? record.window : createWorkspaceWindow(record);
    await loadTarget(record, targetUrl);
    if (input.focus !== false) {
      focusBrowserWorkspaceWindow(activeWindow);
    } else {
      activeWindow.show();
    }
  } else {
    const activeView =
      record.view && !record.view.webContents.isDestroyed()
        ? record.view
        : createWorkspaceView(record);
    await loadTarget(record, targetUrl);
    activeView.setVisible(record.paneVisible);
    syncPaneHost(record);
  }

  const hostWebContents = getHostWebContents(record);
  if (input.devtoolsOpen === true) {
    hostWebContents?.openDevTools({ mode: "detach" });
  } else if (input.devtoolsOpen === false) {
    hostWebContents?.closeDevTools();
  }

  await waitForBrowserDebugEndpoint();
  return toSessionInfo(record);
}

export async function getBrowserWorkspaceSession(
  query?: DesktopBrowserWorkspaceSessionQuery
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord(query);
  if (!record) {
    return null;
  }
  if (record.window?.isDestroyed()) {
    record.window = null;
  }
  if (record.view?.webContents.isDestroyed()) {
    record.view = null;
  }
  try {
    await waitForBrowserDebugEndpoint();
  } catch {
    return null;
  }
  return toSessionInfo(record);
}

export async function listBrowserWorkspaceSessions(): Promise<
  DesktopBrowserWorkspaceSessionInfo[]
> {
  try {
    await waitForBrowserDebugEndpoint();
  } catch {
    return [];
  }
  return [...sessionRegistry.values()]
    .map((record) => toSessionInfo(record))
    .sort((left, right) => left.sessionId.localeCompare(right.sessionId));
}

export async function ensureBrowserWorkspaceSession(
  input?: DesktopBrowserWorkspaceSessionInput
): Promise<DesktopBrowserWorkspaceSessionInfo> {
  return ensureWorkspaceSessionInternal(input);
}

export async function setBrowserWorkspaceHost(
  input: DesktopBrowserWorkspaceSetHostInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  return ensureWorkspaceSessionInternal({
    sessionId: record.sessionId,
    kind: record.kind,
    workspaceId: record.workspaceId,
    targetUrl: record.targetUrl,
    host: input.host,
    focus: input.focus,
    reset: true,
    profileMode: record.profileMode,
    canAgentAttach: record.canAgentAttach,
    agentAttached: record.agentAttached,
    previewServerStatus: record.previewServerStatus,
    devtoolsOpen: getHostWebContents(record)?.isDevToolsOpened() ?? false,
  });
}

export async function setBrowserWorkspaceProfileMode(
  input: DesktopBrowserWorkspaceSetProfileModeInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  return ensureWorkspaceSessionInternal({
    sessionId: record.sessionId,
    kind: record.kind,
    workspaceId: record.workspaceId,
    targetUrl: record.targetUrl,
    host: record.host,
    focus: false,
    reset: true,
    profileMode: input.profileMode,
    canAgentAttach: record.canAgentAttach,
    agentAttached: record.agentAttached,
    previewServerStatus: record.previewServerStatus,
    devtoolsOpen: getHostWebContents(record)?.isDevToolsOpened() ?? false,
  });
}

export async function setBrowserWorkspaceAgentAttached(
  input: DesktopBrowserWorkspaceSetAgentAttachedInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  record.agentAttached = input.attached === true;
  return toSessionInfo(record);
}

export async function setBrowserWorkspacePreviewServerStatus(
  input: DesktopBrowserWorkspaceSetPreviewServerStatusInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  record.previewServerStatus = normalizePreviewServerStatus(input.previewServerStatus);
  if (record.previewServerStatus === "failed") {
    record.loadingState = "failed";
  }
  return toSessionInfo(record);
}

export async function setBrowserWorkspaceDevtoolsOpen(
  input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  if (!getHostWebContents(record)) {
    await ensureWorkspaceSessionInternal({
      sessionId: record.sessionId,
      kind: record.kind,
      workspaceId: record.workspaceId,
      targetUrl: record.targetUrl,
      host: "window",
      focus: false,
      profileMode: record.profileMode,
      canAgentAttach: record.canAgentAttach,
      agentAttached: record.agentAttached,
      previewServerStatus: record.previewServerStatus,
    });
  }
  const hostWebContents = getHostWebContents(record);
  if (!hostWebContents) {
    return toSessionInfo(record);
  }
  if (input.open) {
    hostWebContents.openDevTools({ mode: "detach" });
  } else {
    hostWebContents.closeDevTools();
  }
  return toSessionInfo(record);
}

export async function navigateBrowserWorkspaceSession(
  input: DesktopBrowserWorkspaceNavigateInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  const hostWebContents = getHostWebContents(record);
  if (!hostWebContents) {
    return toSessionInfo(record);
  }
  if (input.action === "back") {
    if (hostWebContents.canGoBack()) {
      hostWebContents.goBack();
    }
    return toSessionInfo(record);
  }
  if (input.action === "forward") {
    if (hostWebContents.canGoForward()) {
      hostWebContents.goForward();
    }
    return toSessionInfo(record);
  }
  hostWebContents.reload();
  record.loadingState = "loading";
  return toSessionInfo(record);
}

function normalizePaneBounds(
  bounds?: DesktopBrowserWorkspacePaneBounds | null
): DesktopBrowserWorkspacePaneBounds | null {
  if (!bounds) {
    return null;
  }
  const width = Math.max(0, Math.trunc(bounds.width));
  const height = Math.max(0, Math.trunc(bounds.height));
  const x = Math.trunc(bounds.x);
  const y = Math.trunc(bounds.y);
  if (width === 0 || height === 0) {
    return null;
  }
  return { x, y, width, height };
}

export async function setBrowserWorkspacePaneState(
  event: IpcMainInvokeEvent,
  input: DesktopBrowserWorkspaceSetPaneStateInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  const hostWindow = BrowserWindow.fromWebContents(event.sender);
  record.paneWindowId = hostWindow?.id ?? null;
  record.paneVisible = input.visible === true;
  record.paneBounds = normalizePaneBounds(input.bounds);
  syncPaneHost(record);
  return toSessionInfo(record);
}

export async function reportBrowserWorkspaceVerification(
  input: DesktopBrowserWorkspaceReportVerificationInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  record.lastVerifiedTarget =
    typeof input.targetUrl === "string" && input.targetUrl.trim().length > 0
      ? input.targetUrl.trim()
      : getHostWebContents(record)?.getURL().trim() || record.lastKnownUrl || record.targetUrl;
  record.lastVerifiedAt =
    typeof input.verifiedAt === "string" && input.verifiedAt.trim().length > 0
      ? input.verifiedAt.trim()
      : new Date().toISOString();
  return toSessionInfo(record);
}

export async function getBrowserDebugSession(): Promise<DesktopBrowserDebugSessionInfo | null> {
  const session = await getBrowserWorkspaceSession({ kind: "debug" });
  if (!session?.windowId) {
    return null;
  }
  return {
    browserUrl: session.browserUrl,
    currentUrl: session.currentUrl,
    targetUrl: session.targetUrl,
    windowId: session.windowId,
  };
}

export async function ensureBrowserDebugSession(
  input?: DesktopBrowserDebugSessionInput
): Promise<DesktopBrowserDebugSessionInfo | null> {
  const session = await ensureWorkspaceSessionInternal({
    kind: "debug",
    focus: input?.focus,
    host: "window",
    reset: input?.reset,
    targetUrl: input?.targetUrl ?? null,
  });
  if (!session.windowId) {
    return null;
  }
  return {
    browserUrl: session.browserUrl,
    currentUrl: session.currentUrl,
    targetUrl: session.targetUrl,
    windowId: session.windowId,
  };
}
