import type {
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionInput,
  DesktopBrowserWorkspaceSessionKind,
  DesktopBrowserWorkspaceSessionQuery,
  DesktopBrowserWorkspaceSetAgentAttachedInput,
  DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  DesktopBrowserWorkspaceSetHostInput,
  DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  DesktopBrowserWorkspaceSetProfileModeInput,
} from "./desktopHostBridge";
import { getDesktopHostBridge } from "./desktopHostBridge";

function normalizeSessionKind(value: unknown): DesktopBrowserWorkspaceSessionKind | null {
  if (value === "preview" || value === "debug" || value === "research") {
    return value;
  }
  return null;
}

function normalizeBrowserWorkspaceSession(
  value: DesktopBrowserWorkspaceSessionInfo | null | undefined
): DesktopBrowserWorkspaceSessionInfo | null {
  if (!value) {
    return null;
  }
  const sessionId =
    typeof value.sessionId === "string" && value.sessionId.trim().length > 0
      ? value.sessionId.trim()
      : null;
  const kind = normalizeSessionKind(value.kind);
  const host = value.host === "pane" ? "pane" : value.host === "window" ? "window" : null;
  const browserUrl =
    typeof value.browserUrl === "string" && value.browserUrl.trim().length > 0
      ? value.browserUrl.trim()
      : null;
  const partitionId =
    typeof value.partitionId === "string" && value.partitionId.trim().length > 0
      ? value.partitionId.trim()
      : null;
  const previewServerStatus =
    value.previewServerStatus === "starting" ||
    value.previewServerStatus === "ready" ||
    value.previewServerStatus === "failed"
      ? value.previewServerStatus
      : value.previewServerStatus === "unknown"
        ? "unknown"
        : null;
  if (!sessionId || !kind || !host || !browserUrl || !partitionId || !previewServerStatus) {
    return null;
  }
  return {
    sessionId,
    kind,
    host,
    browserUrl,
    currentUrl:
      typeof value.currentUrl === "string" && value.currentUrl.trim().length > 0
        ? value.currentUrl.trim()
        : null,
    targetUrl:
      typeof value.targetUrl === "string" && value.targetUrl.trim().length > 0
        ? value.targetUrl.trim()
        : null,
    workspaceId:
      typeof value.workspaceId === "string" && value.workspaceId.trim().length > 0
        ? value.workspaceId.trim()
        : null,
    windowId:
      typeof value.windowId === "number" && Number.isFinite(value.windowId) ? value.windowId : null,
    partitionId,
    profileMode: value.profileMode === "shared" ? "shared" : "isolated",
    canAgentAttach: value.canAgentAttach !== false,
    agentAttached: value.agentAttached === true,
    devtoolsOpen: value.devtoolsOpen === true,
    previewServerStatus,
  };
}

async function readSessionResult(
  value:
    | Promise<DesktopBrowserWorkspaceSessionInfo | null | undefined>
    | DesktopBrowserWorkspaceSessionInfo
    | null
    | undefined
) {
  return normalizeBrowserWorkspaceSession(await value);
}

export async function getDesktopBrowserWorkspaceSession(
  query?: DesktopBrowserWorkspaceSessionQuery
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.getSession?.(query));
  } catch {
    return null;
  }
}

export async function ensureDesktopBrowserWorkspaceSession(
  input?: DesktopBrowserWorkspaceSessionInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.ensureSession?.(input));
  } catch {
    return null;
  }
}

export async function listDesktopBrowserWorkspaceSessions(): Promise<
  DesktopBrowserWorkspaceSessionInfo[]
> {
  const bridge = getDesktopHostBridge();
  try {
    const sessions = await bridge?.browserWorkspace?.listSessions?.();
    if (!Array.isArray(sessions)) {
      return [];
    }
    return sessions
      .map((session) => normalizeBrowserWorkspaceSession(session))
      .filter((session): session is DesktopBrowserWorkspaceSessionInfo => session !== null);
  } catch {
    return [];
  }
}

export async function setDesktopBrowserWorkspaceHost(
  input: DesktopBrowserWorkspaceSetHostInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.setHost?.(input));
  } catch {
    return null;
  }
}

export async function setDesktopBrowserWorkspaceProfileMode(
  input: DesktopBrowserWorkspaceSetProfileModeInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.setProfileMode?.(input));
  } catch {
    return null;
  }
}

export async function setDesktopBrowserWorkspaceAgentAttached(
  input: DesktopBrowserWorkspaceSetAgentAttachedInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.setAgentAttached?.(input));
  } catch {
    return null;
  }
}

export async function setDesktopBrowserWorkspacePreviewServerStatus(
  input: DesktopBrowserWorkspaceSetPreviewServerStatusInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.setPreviewServerStatus?.(input));
  } catch {
    return null;
  }
}

export async function setDesktopBrowserWorkspaceDevtoolsOpen(
  input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
): Promise<DesktopBrowserWorkspaceSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return readSessionResult(await bridge?.browserWorkspace?.setDevtoolsOpen?.(input));
  } catch {
    return null;
  }
}
