import type {
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
} from "./desktopHostBridge";
import { getDesktopHostBridge } from "./desktopHostBridge";

function normalizeBrowserDebugSession(
  value: DesktopBrowserDebugSessionInfo | null | undefined
): DesktopBrowserDebugSessionInfo | null {
  if (!value) {
    return null;
  }
  const browserUrl =
    typeof value.browserUrl === "string" && value.browserUrl.trim().length > 0
      ? value.browserUrl.trim()
      : null;
  const windowId =
    typeof value.windowId === "number" && Number.isFinite(value.windowId) ? value.windowId : null;
  if (!browserUrl || windowId === null) {
    return null;
  }
  return {
    browserUrl,
    currentUrl:
      typeof value.currentUrl === "string" && value.currentUrl.trim().length > 0
        ? value.currentUrl.trim()
        : null,
    targetUrl:
      typeof value.targetUrl === "string" && value.targetUrl.trim().length > 0
        ? value.targetUrl.trim()
        : null,
    windowId,
  };
}

export async function getDesktopBrowserDebugSession(): Promise<DesktopBrowserDebugSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return normalizeBrowserDebugSession(await bridge?.browserDebug?.getSession?.());
  } catch {
    return null;
  }
}

export async function ensureDesktopBrowserDebugSession(
  input?: DesktopBrowserDebugSessionInput
): Promise<DesktopBrowserDebugSessionInfo | null> {
  const bridge = getDesktopHostBridge();
  try {
    return normalizeBrowserDebugSession(await bridge?.browserDebug?.ensureSession?.(input));
  } catch {
    return null;
  }
}
