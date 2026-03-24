import { createRequire } from "node:module";
import type { BrowserWindow as ElectronBrowserWindow, HandlerDetails } from "electron";
import type {
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
} from "../shared/ipc.js";

const require = createRequire(import.meta.url);
const { BrowserWindow } = require("electron");

const DEFAULT_BROWSER_DEBUG_PORT = 9333;
const DEFAULT_BROWSER_DEBUG_TARGET_URL = "https://chatgpt.com/";
const BROWSER_DEBUG_PARTITION = "persist:hugecode-browser-debug";
const BROWSER_DEBUG_WINDOW_SIZE = {
  width: 1440,
  height: 960,
};

let browserDebugWindow: ElectronBrowserWindow | null = null;

function normalizeTargetUrl(targetUrl?: string | null): string {
  const trimmed = targetUrl?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_BROWSER_DEBUG_TARGET_URL;
}

export function resolveBrowserDebugPort(): number {
  const candidate = Number.parseInt(process.env.HUGECODE_ELECTRON_REMOTE_DEBUGGING_PORT ?? "", 10);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : DEFAULT_BROWSER_DEBUG_PORT;
}

export function resolveBrowserDebugUrl(): string {
  return `http://127.0.0.1:${resolveBrowserDebugPort()}`;
}

function focusBrowserDebugWindow(window: ElectronBrowserWindow) {
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function createBrowserDebugWindow(targetUrl: string) {
  const nextWindow = new BrowserWindow({
    ...BROWSER_DEBUG_WINDOW_SIZE,
    show: false,
    title: "HugeCode Browser Debug",
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: BROWSER_DEBUG_PARTITION,
    },
  });

  nextWindow.webContents.setWindowOpenHandler(({ url }: HandlerDetails) => {
    void nextWindow.loadURL(url);
    return { action: "deny" };
  });

  nextWindow.once("ready-to-show", () => {
    focusBrowserDebugWindow(nextWindow);
  });

  nextWindow.on("closed", () => {
    if (browserDebugWindow?.id === nextWindow.id) {
      browserDebugWindow = null;
    }
  });

  void nextWindow.loadURL(targetUrl);
  browserDebugWindow = nextWindow;
  return nextWindow;
}

async function waitForBrowserDebugEndpoint(timeoutMs = 5_000): Promise<string> {
  const browserUrl = resolveBrowserDebugUrl();
  const deadline = Date.now() + timeoutMs;
  let lastError = "browser debug endpoint did not become ready";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${browserUrl}/json/version`, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) {
        return browserUrl;
      }
      lastError = `browser debug endpoint responded with ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(lastError);
}

function toBrowserDebugSessionInfo(
  window: ElectronBrowserWindow,
  targetUrl: string
): DesktopBrowserDebugSessionInfo {
  const currentUrl = window.webContents.getURL().trim();
  return {
    browserUrl: resolveBrowserDebugUrl(),
    currentUrl: currentUrl.length > 0 ? currentUrl : null,
    targetUrl,
    windowId: window.id,
  };
}

export async function getBrowserDebugSession(): Promise<DesktopBrowserDebugSessionInfo | null> {
  if (!browserDebugWindow || browserDebugWindow.isDestroyed()) {
    browserDebugWindow = null;
    return null;
  }

  try {
    await waitForBrowserDebugEndpoint();
  } catch {
    return null;
  }

  return toBrowserDebugSessionInfo(
    browserDebugWindow,
    normalizeTargetUrl(browserDebugWindow.webContents.getURL())
  );
}

export async function ensureBrowserDebugSession(
  input: DesktopBrowserDebugSessionInput = {}
): Promise<DesktopBrowserDebugSessionInfo> {
  const targetUrl = normalizeTargetUrl(input.targetUrl);
  let targetWindow = browserDebugWindow;
  const shouldReset = input.reset === true || !targetWindow || targetWindow.isDestroyed();

  if (shouldReset) {
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.close();
    }
    targetWindow = createBrowserDebugWindow(targetUrl);
  }
  const activeWindow = targetWindow ?? createBrowserDebugWindow(targetUrl);

  if (activeWindow.webContents.getURL().trim() !== targetUrl) {
    await activeWindow.loadURL(targetUrl);
  }

  if (input.focus !== false) {
    focusBrowserDebugWindow(activeWindow);
  }

  await waitForBrowserDebugEndpoint();
  return toBrowserDebugSessionInfo(activeWindow, targetUrl);
}
