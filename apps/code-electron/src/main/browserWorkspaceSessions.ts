import { createRequire } from "node:module";
import type { BrowserWindow as ElectronBrowserWindow, HandlerDetails } from "electron";
import type {
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
  DesktopBrowserWorkspaceHost,
  DesktopBrowserWorkspacePreviewServerStatus,
  DesktopBrowserWorkspaceProfileMode,
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionInput,
  DesktopBrowserWorkspaceSessionKind,
  DesktopBrowserWorkspaceSessionQuery,
  DesktopBrowserWorkspaceSetAgentAttachedInput,
  DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  DesktopBrowserWorkspaceSetHostInput,
  DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  DesktopBrowserWorkspaceSetProfileModeInput,
} from "../shared/ipc.js";

const require = createRequire(import.meta.url);
const { BrowserWindow } = require("electron");

const DEFAULT_BROWSER_DEBUG_PORT = 9333;
const DEFAULT_RESEARCH_TARGET_URL = "https://chatgpt.com/";
const DEFAULT_DEBUG_TARGET_URL = "https://chatgpt.com/";
const BROWSER_WORKSPACE_WINDOW_SIZE = {
  width: 1440,
  height: 960,
};

type BrowserWorkspaceRecord = {
  agentAttached: boolean;
  canAgentAttach: boolean;
  host: DesktopBrowserWorkspaceHost;
  kind: DesktopBrowserWorkspaceSessionKind;
  lastKnownUrl: string | null;
  partitionId: string;
  previewServerStatus: DesktopBrowserWorkspacePreviewServerStatus;
  profileMode: DesktopBrowserWorkspaceProfileMode;
  sessionId: string;
  targetUrl: string | null;
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

function bindWorkspaceWindow(record: BrowserWorkspaceRecord, nextWindow: ElectronBrowserWindow) {
  nextWindow.webContents.setWindowOpenHandler(({ url }: HandlerDetails) => {
    if (record.kind === "preview" && !isLoopbackPreviewTarget(url)) {
      return { action: "deny" };
    }
    void nextWindow.loadURL(url);
    return { action: "deny" };
  });

  const syncCurrentUrl = () => {
    const currentUrl = nextWindow.webContents.getURL().trim();
    record.lastKnownUrl = currentUrl.length > 0 ? currentUrl : record.targetUrl;
  };

  nextWindow.webContents.on("did-finish-load", syncCurrentUrl);
  nextWindow.webContents.on("did-navigate", syncCurrentUrl);
  nextWindow.webContents.on("did-navigate-in-page", syncCurrentUrl);
  nextWindow.on("closed", () => {
    if (record.window?.id === nextWindow.id) {
      record.window = null;
    }
  });
}

function createWorkspaceWindow(record: BrowserWorkspaceRecord): ElectronBrowserWindow {
  const targetUrl = record.targetUrl ?? defaultTargetUrlForKind(record.kind) ?? "about:blank";
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

  bindWorkspaceWindow(record, nextWindow);
  void nextWindow.loadURL(targetUrl);
  if (record.host === "window") {
    nextWindow.once("ready-to-show", () => {
      focusBrowserWorkspaceWindow(nextWindow);
    });
  }
  record.window = nextWindow;
  return nextWindow;
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
  const currentUrl = record.window?.isDestroyed()
    ? record.lastKnownUrl
    : record.window?.webContents.getURL().trim() || record.lastKnownUrl;
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
    devtoolsOpen: record.window ? record.window.webContents.isDevToolsOpened() : false,
    previewServerStatus: record.previewServerStatus,
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

  const requiresReset =
    input.reset === true ||
    !record ||
    record.window?.isDestroyed() === true ||
    record.partitionId !== derivePartitionId({ kind, profileMode, workspaceId });

  if (record && requiresReset && record.window && !record.window.isDestroyed()) {
    record.window.close();
    record.window = null;
  }

  if (!record || requiresReset) {
    record = {
      agentAttached,
      canAgentAttach,
      host,
      kind,
      lastKnownUrl: targetUrl,
      partitionId: derivePartitionId({ kind, profileMode, workspaceId }),
      previewServerStatus,
      profileMode,
      sessionId,
      targetUrl,
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
  }

  const activeWindow =
    record.window && !record.window.isDestroyed() ? record.window : createWorkspaceWindow(record);

  if (targetUrl && activeWindow.webContents.getURL().trim() !== targetUrl) {
    await activeWindow.loadURL(targetUrl);
    record.lastKnownUrl = targetUrl;
  }

  if (host === "window") {
    if (input.focus !== false) {
      focusBrowserWorkspaceWindow(activeWindow);
    } else {
      activeWindow.show();
    }
  } else {
    activeWindow.hide();
  }

  if (input.devtoolsOpen === true) {
    activeWindow.webContents.openDevTools({ mode: "detach" });
  } else if (input.devtoolsOpen === false) {
    activeWindow.webContents.closeDevTools();
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
    profileMode: record.profileMode,
    canAgentAttach: record.canAgentAttach,
    agentAttached: record.agentAttached,
    previewServerStatus: record.previewServerStatus,
    devtoolsOpen: record.window?.webContents.isDevToolsOpened() ?? false,
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
    devtoolsOpen: record.window?.webContents.isDevToolsOpened() ?? false,
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
  return toSessionInfo(record);
}

export async function setBrowserWorkspaceDevtoolsOpen(
  input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const record = getRecord({ sessionId: input.sessionId });
  if (!record) {
    return null;
  }
  if (!record.window || record.window.isDestroyed()) {
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
  const nextWindow = record.window;
  if (!nextWindow || nextWindow.isDestroyed()) {
    return toSessionInfo(record);
  }
  if (input.open) {
    nextWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    nextWindow.webContents.closeDevTools();
  }
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
  input: DesktopBrowserDebugSessionInput = {}
): Promise<DesktopBrowserDebugSessionInfo> {
  const session = await ensureBrowserWorkspaceSession({
    kind: "debug",
    focus: input.focus,
    reset: input.reset,
    targetUrl: input.targetUrl ?? null,
    host: "window",
  });
  return {
    browserUrl: session.browserUrl,
    currentUrl: session.currentUrl,
    targetUrl: session.targetUrl,
    windowId: session.windowId ?? 0,
  };
}
