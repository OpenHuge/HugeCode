import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  session,
  shell,
  WebContentsView,
} from "electron";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  closeBrowserChromeTabState,
  createBrowserChromeTabState,
  fallbackBrowserChromeTitle,
  normalizeBrowserChromeNavigationInput,
  resolveBrowserChromeSecurityState,
  type BrowserChromeCommandResult,
  type BrowserChromeSnapshot,
  type BrowserChromeTabState,
} from "./browserChromeState";

const devServerUrl = process.env.HUGECODE_T3_DESKTOP_DEV_SERVER_URL;
const BROWSER_LOGIN_STATE_EXPORT_CHANNEL = "hugecode:browser-static-data:export-login-state";
const BROWSER_LOGIN_STATE_IMPORT_CHANNEL = "hugecode:browser-static-data:import-login-state";
const BROWSER_SITE_DATA_EXPORT_TO_CHROME_CHANNEL = "hugecode:browser-static-data:export-to-chrome";
const RUNTIME_RPC_INVOKE_CHANNEL = "hugecode:runtime:invoke";
const BROWSER_CHROME_GET_SNAPSHOT_CHANNEL = "hugecode:browser-chrome:get-snapshot";
const BROWSER_CHROME_CREATE_TAB_CHANNEL = "hugecode:browser-chrome:create-tab";
const BROWSER_CHROME_CLOSE_TAB_CHANNEL = "hugecode:browser-chrome:close-tab";
const BROWSER_CHROME_ACTIVATE_TAB_CHANNEL = "hugecode:browser-chrome:activate-tab";
const BROWSER_CHROME_NAVIGATE_CHANNEL = "hugecode:browser-chrome:navigate";
const BROWSER_CHROME_GO_BACK_CHANNEL = "hugecode:browser-chrome:go-back";
const BROWSER_CHROME_GO_FORWARD_CHANNEL = "hugecode:browser-chrome:go-forward";
const BROWSER_CHROME_RELOAD_CHANNEL = "hugecode:browser-chrome:reload";
const BROWSER_CHROME_STOP_CHANNEL = "hugecode:browser-chrome:stop";
const BROWSER_CHROME_SNAPSHOT_CHANNEL = "hugecode:browser-chrome:snapshot";
const BROWSER_CHROME_HEIGHT = 84;
const BROWSER_DATA_EXPORT_ADMIN_AUTH_PROMPT =
  "HugeCode needs administrator approval to export built-in browser data.";

type ElectronCookieSnapshot = {
  domain?: string;
  expirationDate?: number;
  httpOnly?: boolean;
  name: string;
  path?: string;
  sameSite?: "lax" | "no_restriction" | "strict" | "unspecified";
  secure?: boolean;
  session?: boolean;
  value: string;
};

type ElectronCookieLoginStatePayload = {
  cookies: ElectronCookieSnapshot[];
  exportedAt: number;
  payloadFormat: "electron-session-cookies/v1";
};

type ElectronBrowserStateFileSnapshot = {
  dataBase64: string;
  path: string;
  size: number;
};

type ElectronBrowserSessionStatePayload = {
  cookies: ElectronCookieSnapshot[];
  exportedAt: number;
  payloadFormat: "electron-session-state/v2";
  storageFiles: ElectronBrowserStateFileSnapshot[];
  storageRoot: "electron-default-session";
};

type ElectronEncryptedLoginStateBundle = {
  cookieCount: number;
  createdAt: number;
  encryptedPayloadBase64: string;
  encryption: "electron-safe-storage";
  id: string;
  originCount: number;
  payloadFormat: "electron-session-cookies/v1" | "electron-session-state/v2";
  stateByteCount?: number;
  stateFileCount?: number;
  summary: string;
};

type ElectronChromeSiteDataExportResult = {
  chromeExecutablePath: string;
  profilePath: string;
  restoredBytes: number;
  restoredFiles: number;
  summary: string;
  targetUrl: string;
};

type RuntimeRpcEnvelope<Result = unknown> =
  | {
      ok: true;
      result: Result;
    }
  | {
      error?: {
        message?: string;
      };
      ok: false;
    };

type BrowserChromeTabController = {
  state: BrowserChromeTabState;
  view: WebContentsView;
};

type BrowserChromeWindowController = {
  activateTab: (tabId: string) => BrowserChromeCommandResult;
  closeTab: (tabId: string) => BrowserChromeCommandResult;
  createTab: (url: string | null, activate?: boolean) => BrowserChromeCommandResult;
  getSnapshot: () => BrowserChromeSnapshot;
  goBack: (tabId?: string | null) => BrowserChromeCommandResult;
  goForward: (tabId?: string | null) => BrowserChromeCommandResult;
  navigate: (url: string, tabId?: string | null) => BrowserChromeCommandResult;
  reload: (tabId?: string | null) => BrowserChromeCommandResult;
  stop: (tabId?: string | null) => BrowserChromeCommandResult;
};

const browserChromeControllers = new Map<number, BrowserChromeWindowController>();
let nextBrowserChromeTabSequence = 1;

function resolveRendererUrl(): string {
  if (devServerUrl) {
    return devServerUrl;
  }

  return pathToFileURL(join(__dirname, "../dist/index.html")).toString();
}

function isHugeCodeBrowserLaunchUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("hcbrowser") !== "1") {
      return false;
    }
    const rendererUrl = new URL(resolveRendererUrl());
    if (rendererUrl.protocol === "file:") {
      return parsed.protocol === "file:" && parsed.pathname === rendererUrl.pathname;
    }
    return parsed.origin === rendererUrl.origin;
  } catch {
    return false;
  }
}

function isHugeCodeBrowserSpecialLaunchUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("ldxpAssistant") === "1";
  } catch {
    return false;
  }
}

function getBrowserChromeControllerForSender(sender: Electron.WebContents) {
  const senderWindow = BrowserWindow.fromWebContents(sender);
  return senderWindow ? (browserChromeControllers.get(senderWindow.id) ?? null) : null;
}

function createBrowserChromeIpcErrorResult(
  controller: BrowserChromeWindowController | null,
  errorMessage: string
): BrowserChromeCommandResult {
  return {
    errorMessage,
    ok: false,
    snapshot: controller?.getSnapshot() ?? {
      activeTabId: "missing",
      tabs: [createBrowserChromeTabState({ id: "missing" })],
    },
  };
}

function readPayloadString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record[key] === "string" ? record[key] : null;
}

function readPayloadBoolean(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record[key] === "boolean" ? record[key] : null;
}

function isEmbeddableBrowserChromeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function createBrowserChromeController(
  browserWindow: BrowserWindow,
  initialTargetUrl: string
): BrowserChromeWindowController {
  const tabs = new Map<string, BrowserChromeTabController>();
  let activeTabId = "";

  function getOrderedTabs() {
    return Array.from(tabs.values());
  }

  function getActiveTab() {
    return tabs.get(activeTabId) ?? getOrderedTabs()[0] ?? null;
  }

  function getSnapshot(): BrowserChromeSnapshot {
    const orderedTabs = getOrderedTabs().map((tab) => tab.state);
    return {
      activeTabId: tabs.has(activeTabId) ? activeTabId : (orderedTabs[0]?.id ?? ""),
      tabs: orderedTabs.length > 0 ? orderedTabs : [createBrowserChromeTabState({ id: "empty" })],
    };
  }

  function publishSnapshot() {
    if (browserWindow.isDestroyed()) {
      return;
    }
    browserWindow.webContents.send(BROWSER_CHROME_SNAPSHOT_CHANNEL, getSnapshot());
  }

  function layoutViews() {
    if (browserWindow.isDestroyed()) {
      return;
    }
    const bounds = browserWindow.getContentBounds();
    const viewBounds = {
      height: Math.max(bounds.height - BROWSER_CHROME_HEIGHT, 0),
      width: bounds.width,
      x: 0,
      y: BROWSER_CHROME_HEIGHT,
    };
    for (const tab of tabs.values()) {
      tab.view.setBounds(viewBounds);
      tab.view.setVisible(tab.state.id === activeTabId && tab.state.url.trim().length > 0);
    }
  }

  function canWebContentsGoBack(webContents: Electron.WebContents) {
    return webContents.navigationHistory?.canGoBack() ?? webContents.canGoBack();
  }

  function canWebContentsGoForward(webContents: Electron.WebContents) {
    return webContents.navigationHistory?.canGoForward() ?? webContents.canGoForward();
  }

  function updateTabFromWebContents(tabId: string, partial: Partial<BrowserChromeTabState> = {}) {
    const tab = tabs.get(tabId);
    if (!tab || tab.view.webContents.isDestroyed()) {
      return;
    }
    const webContents = tab.view.webContents;
    const currentUrl = partial.url ?? webContents.getURL() ?? tab.state.url;
    tab.state = {
      ...tab.state,
      ...partial,
      canGoBack: canWebContentsGoBack(webContents),
      canGoForward: canWebContentsGoForward(webContents),
      loading: partial.loading ?? webContents.isLoading(),
      securityState: resolveBrowserChromeSecurityState(currentUrl),
      title:
        partial.title?.trim() || webContents.getTitle() || fallbackBrowserChromeTitle(currentUrl),
      url: currentUrl,
    };
    layoutViews();
    publishSnapshot();
  }

  function commandSuccess(): BrowserChromeCommandResult {
    return {
      ok: true,
      snapshot: getSnapshot(),
    };
  }

  function commandFailure(errorMessage: string): BrowserChromeCommandResult {
    return {
      errorMessage,
      ok: false,
      snapshot: getSnapshot(),
    };
  }

  function attachTabEvents(tab: BrowserChromeTabController) {
    const webContents = tab.view.webContents;
    webContents.setWindowOpenHandler(({ url: nextUrl }) => {
      if (isHugeCodeBrowserLaunchUrl(nextUrl)) {
        createBrowserWindow(nextUrl);
      } else if (isEmbeddableBrowserChromeUrl(nextUrl)) {
        createTab(nextUrl, true);
      } else {
        void shell.openExternal(nextUrl);
      }
      return { action: "deny" };
    });
    webContents.on("will-navigate", (event, nextUrl) => {
      if (!isEmbeddableBrowserChromeUrl(nextUrl)) {
        event.preventDefault();
        void shell.openExternal(nextUrl);
      }
    });
    webContents.on("did-start-loading", () =>
      updateTabFromWebContents(tab.state.id, { loading: true })
    );
    webContents.on("did-stop-loading", () =>
      updateTabFromWebContents(tab.state.id, { loading: false })
    );
    webContents.on("did-finish-load", () =>
      updateTabFromWebContents(tab.state.id, { loading: false })
    );
    webContents.on("did-navigate", (_event, nextUrl) =>
      updateTabFromWebContents(tab.state.id, { url: nextUrl })
    );
    webContents.on("did-navigate-in-page", (_event, nextUrl) =>
      updateTabFromWebContents(tab.state.id, { url: nextUrl })
    );
    webContents.on("page-title-updated", (_event, title) =>
      updateTabFromWebContents(tab.state.id, { title })
    );
    webContents.on("did-fail-load", (_event, errorCode, _errorDescription, validatedUrl) => {
      if (errorCode === -3) {
        return;
      }
      updateTabFromWebContents(tab.state.id, {
        loading: false,
        title: fallbackBrowserChromeTitle(validatedUrl),
        url: validatedUrl || tab.state.url,
      });
    });
    webContents.on("render-process-gone", (_event, details) => {
      updateTabFromWebContents(tab.state.id, {
        loading: false,
        title:
          details.reason === "clean-exit"
            ? fallbackBrowserChromeTitle(tab.state.url)
            : "Page crashed",
      });
    });
  }

  function createTab(url: string | null, activate = true): BrowserChromeCommandResult {
    let normalizedUrl = "";
    if (url?.trim()) {
      try {
        normalizedUrl = normalizeBrowserChromeNavigationInput(url) ?? "";
      } catch {
        return commandFailure("Use a valid http or https web address.");
      }
    }
    const tabId = `tab-${nextBrowserChromeTabSequence++}`;
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const tab: BrowserChromeTabController = {
      state: createBrowserChromeTabState({ id: tabId, url: normalizedUrl }),
      view,
    };
    tabs.set(tabId, tab);
    browserWindow.contentView.addChildView(view);
    attachTabEvents(tab);
    if (activate || !activeTabId) {
      activeTabId = tabId;
    }
    if (normalizedUrl) {
      void view.webContents.loadURL(normalizedUrl);
    }
    layoutViews();
    publishSnapshot();
    return commandSuccess();
  }

  function closeTab(tabId: string): BrowserChromeCommandResult {
    const tab = tabs.get(tabId);
    if (!tab) {
      return commandFailure("Browser tab was not found.");
    }
    const replacementTab = createBrowserChromeTabState({
      id: `tab-${nextBrowserChromeTabSequence}`,
    });
    const nextSnapshot = closeBrowserChromeTabState(getSnapshot(), tabId, replacementTab);
    browserWindow.contentView.removeChildView(tab.view);
    tab.view.webContents.close({ waitForBeforeUnload: false });
    tabs.delete(tabId);
    if (tabs.size === 0) {
      activeTabId = "";
      return createTab(null, true);
    }
    activeTabId = nextSnapshot.activeTabId;
    layoutViews();
    publishSnapshot();
    return commandSuccess();
  }

  function activateTab(tabId: string): BrowserChromeCommandResult {
    if (!tabs.has(tabId)) {
      return commandFailure("Browser tab was not found.");
    }
    activeTabId = tabId;
    layoutViews();
    publishSnapshot();
    const tab = tabs.get(tabId);
    tab?.view.webContents.focus();
    return commandSuccess();
  }

  function navigate(url: string, tabId?: string | null): BrowserChromeCommandResult {
    const tab = tabId ? tabs.get(tabId) : getActiveTab();
    if (!tab) {
      return commandFailure("Browser tab was not found.");
    }
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeBrowserChromeNavigationInput(url) ?? "";
    } catch {
      return commandFailure("Use a valid http or https web address.");
    }
    if (!normalizedUrl || !isEmbeddableBrowserChromeUrl(normalizedUrl)) {
      return commandFailure("Use a valid http or https web address.");
    }
    tab.state = {
      ...tab.state,
      loading: true,
      securityState: resolveBrowserChromeSecurityState(normalizedUrl),
      title: fallbackBrowserChromeTitle(normalizedUrl),
      url: normalizedUrl,
    };
    activeTabId = tab.state.id;
    layoutViews();
    publishSnapshot();
    void tab.view.webContents.loadURL(normalizedUrl);
    return commandSuccess();
  }

  function goBack(tabId?: string | null): BrowserChromeCommandResult {
    const tab = tabId ? tabs.get(tabId) : getActiveTab();
    if (!tab) {
      return commandFailure("Browser tab was not found.");
    }
    if (canWebContentsGoBack(tab.view.webContents)) {
      tab.view.webContents.goBack();
    }
    return commandSuccess();
  }

  function goForward(tabId?: string | null): BrowserChromeCommandResult {
    const tab = tabId ? tabs.get(tabId) : getActiveTab();
    if (!tab) {
      return commandFailure("Browser tab was not found.");
    }
    if (canWebContentsGoForward(tab.view.webContents)) {
      tab.view.webContents.goForward();
    }
    return commandSuccess();
  }

  function reload(tabId?: string | null): BrowserChromeCommandResult {
    const tab = tabId ? tabs.get(tabId) : getActiveTab();
    if (!tab) {
      return commandFailure("Browser tab was not found.");
    }
    if (tab.state.url.trim()) {
      tab.view.webContents.reload();
    }
    return commandSuccess();
  }

  function stop(tabId?: string | null): BrowserChromeCommandResult {
    const tab = tabId ? tabs.get(tabId) : getActiveTab();
    if (!tab) {
      return commandFailure("Browser tab was not found.");
    }
    tab.view.webContents.stop();
    updateTabFromWebContents(tab.state.id, { loading: false });
    return commandSuccess();
  }

  browserWindow.on("resize", layoutViews);
  browserWindow.on("closed", () => {
    browserChromeControllers.delete(browserWindow.id);
    for (const tab of tabs.values()) {
      if (!tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close({ waitForBeforeUnload: false });
      }
    }
    tabs.clear();
  });

  const controller: BrowserChromeWindowController = {
    activateTab,
    closeTab,
    createTab,
    getSnapshot,
    goBack,
    goForward,
    navigate,
    reload,
    stop,
  };
  browserChromeControllers.set(browserWindow.id, controller);
  createTab(initialTargetUrl, true);
  return controller;
}

function createBrowserWindow(url: string): BrowserWindow {
  const browserWindow = new BrowserWindow({
    title: "HugeCode Browser",
    width: 1180,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  browserWindow.once("ready-to-show", () => {
    browserWindow.show();
  });

  browserWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isHugeCodeBrowserLaunchUrl(nextUrl)) {
      createBrowserWindow(nextUrl);
      return { action: "deny" };
    }
    void shell.openExternal(nextUrl);
    return { action: "deny" };
  });

  void browserWindow.loadURL(url);
  if (!isHugeCodeBrowserSpecialLaunchUrl(url)) {
    let initialTargetUrl = "";
    try {
      initialTargetUrl = new URL(url).searchParams.get("target") ?? "";
    } catch {
      initialTargetUrl = "";
    }
    browserWindow.webContents.once("did-finish-load", () => {
      if (!browserWindow.isDestroyed() && !browserChromeControllers.has(browserWindow.id)) {
        createBrowserChromeController(browserWindow, initialTargetUrl);
      }
    });
    browserWindow.webContents.on("render-process-gone", (_event, details) => {
      if (details.reason !== "clean-exit") {
        browserChromeControllers.delete(browserWindow.id);
      }
    });
  }
  return browserWindow;
}

function resolveRuntimeRpcEndpoint(): string {
  return process.env.HUGECODE_T3_RUNTIME_RPC_ENDPOINT?.trim() || "http://127.0.0.1:8788/rpc";
}

function cookieOrigin(cookie: ElectronCookieSnapshot) {
  const rawDomain = cookie.domain?.trim();
  if (!rawDomain) {
    return null;
  }
  const host = rawDomain.startsWith(".") ? rawDomain.slice(1) : rawDomain;
  if (!host || host.includes("/") || host.includes("@")) {
    return null;
  }
  return `${cookie.secure ? "https" : "http"}://${host}`;
}

function cookieUrl(cookie: ElectronCookieSnapshot) {
  const origin = cookieOrigin(cookie);
  if (!origin) {
    return null;
  }
  const path = cookie.path?.startsWith("/") ? cookie.path : "/";
  return `${origin}${path}`;
}

function assertSafeStorageAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Electron safeStorage encryption is unavailable on this host.");
  }
}

function appleScriptStringLiteral(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function runAdministratorAuthorizationCommand(
  command: string,
  args: readonly string[],
  failureMessage: string
) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const childProcess = spawn(command, args, {
      stdio: "ignore",
      windowsHide: true,
    });
    childProcess.once("error", (error) => {
      rejectPromise(new Error(`${failureMessage} ${error.message}`));
    });
    childProcess.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(signal ? `${failureMessage} Signal: ${signal}.` : failureMessage));
    });
  });
}

async function requireAdministratorAuthorizationForBrowserDataExport() {
  if (process.platform === "darwin") {
    await runAdministratorAuthorizationCommand(
      "osascript",
      [
        "-e",
        `do shell script "/usr/bin/true" with administrator privileges with prompt ${appleScriptStringLiteral(
          BROWSER_DATA_EXPORT_ADMIN_AUTH_PROMPT
        )}`,
      ],
      "Administrator password is required to export built-in browser data."
    );
    return;
  }
  if (process.platform === "win32") {
    await runAdministratorAuthorizationCommand(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$ErrorActionPreference = 'Stop'; $process = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','exit 0' -Verb RunAs -Wait -PassThru; exit $process.ExitCode",
      ],
      "Administrator approval is required to export built-in browser data."
    );
    return;
  }
  throw new Error(
    "Administrator password verification is only supported on macOS and Windows desktop builds."
  );
}

const ELECTRON_BROWSER_STATE_ENTRY_NAMES = [
  "Local Storage",
  "Session Storage",
  "IndexedDB",
  "Storage",
  "Shared Storage",
  "Cookies",
  "Network",
  "Cache",
  "Code Cache",
  "Service Worker",
  "File System",
  "Extension Cookies",
  "Extension Rules",
  "Extension Scripts",
  "Local Extension Settings",
  "Managed Extension Settings",
  "Sync Extension Settings",
  "Extension State",
  "blob_storage",
  "databases",
  "shared_proto_db",
  "QuotaManager",
  "QuotaManager-journal",
  "Network Persistent State",
  "TransportSecurity",
  "Preferences",
  "DawnCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
] as const;

function resolveSessionStoragePath() {
  const storagePath = session.defaultSession.getStoragePath();
  if (!storagePath) {
    throw new Error("Electron default session storage path is unavailable.");
  }
  return storagePath;
}

function safeRelativeStoragePath(storageRoot: string, relativePath: string) {
  const topLevelEntry = relativePath.split("/")[0];
  if (
    relativePath.length === 0 ||
    !ELECTRON_BROWSER_STATE_ENTRY_NAMES.some((entryName) => entryName === topLevelEntry) ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\") ||
    relativePath.includes("..")
  ) {
    return null;
  }
  const normalizedRelativePath = relativePath.split("/").join(sep);
  const absolutePath = resolve(storageRoot, normalizedRelativePath);
  const normalizedRoot = resolve(storageRoot);
  if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${sep}`)) {
    return null;
  }
  return absolutePath;
}

async function collectStorageFiles(
  storageRoot: string,
  absolutePath: string
): Promise<ElectronBrowserStateFileSnapshot[]> {
  const entryStat = await lstat(absolutePath).catch(() => null);
  if (!entryStat) {
    return [];
  }
  if (entryStat.isDirectory()) {
    const children = await readdir(absolutePath);
    const nestedFiles = await Promise.all(
      children.map((child) => collectStorageFiles(storageRoot, join(absolutePath, child)))
    );
    return nestedFiles.flat();
  }
  if (!entryStat.isFile()) {
    return [];
  }
  const data = await readFile(absolutePath);
  return [
    {
      dataBase64: data.toString("base64"),
      path: relative(storageRoot, absolutePath).split(sep).join("/"),
      size: data.byteLength,
    },
  ];
}

async function exportBrowserStorageFiles(storageRoot: string) {
  const files = await Promise.all(
    ELECTRON_BROWSER_STATE_ENTRY_NAMES.map((entryName) =>
      collectStorageFiles(storageRoot, join(storageRoot, entryName))
    )
  );
  return files.flat();
}

async function pathExists(path: string) {
  return (await lstat(path).catch(() => null)) !== null;
}

function resolveChromeCandidatePaths() {
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
      join(app.getPath("home"), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    ];
  }
  if (process.platform === "win32") {
    return [
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe")
        : null,
      process.env.PROGRAMFILES
        ? join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe")
        : null,
      process.env["PROGRAMFILES(X86)"]
        ? join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe")
        : null,
    ].filter((path): path is string => path !== null);
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ];
}

async function resolveChromeExecutablePath() {
  for (const candidate of resolveChromeCandidatePaths()) {
    if (!candidate.includes("/") || (await pathExists(candidate))) {
      return candidate;
    }
  }
  throw new Error("Google Chrome was not found on this computer.");
}

function normalizeChromeExportTargetUrl(value: unknown) {
  const targetUrl =
    typeof value === "string" && value.trim() ? value.trim() : "https://chatgpt.com/";
  const parsed = new URL(targetUrl);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(
      "Chrome site-data export target URL must be a credential-free http or https URL."
    );
  }
  parsed.hash = "";
  return parsed.toString();
}

async function clearBrowserStorageEntries(storageRoot: string) {
  await Promise.all(
    ELECTRON_BROWSER_STATE_ENTRY_NAMES.map((entryName) =>
      rm(join(storageRoot, entryName), { force: true, recursive: true })
    )
  );
}

function normalizeImportedStorageFile(value: unknown): ElectronBrowserStateFileSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<ElectronBrowserStateFileSnapshot>;
  if (
    typeof record.path !== "string" ||
    typeof record.dataBase64 !== "string" ||
    typeof record.size !== "number"
  ) {
    return null;
  }
  return {
    dataBase64: record.dataBase64,
    path: record.path,
    size: record.size,
  };
}

async function restoreBrowserStorageFiles(
  storageRoot: string,
  files: readonly ElectronBrowserStateFileSnapshot[]
) {
  await clearBrowserStorageEntries(storageRoot);
  let restoredFiles = 0;
  let restoredBytes = 0;
  for (const file of files) {
    const absolutePath = safeRelativeStoragePath(storageRoot, file.path);
    if (!absolutePath) {
      continue;
    }
    const bytes = Buffer.from(file.dataBase64, "base64");
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
    restoredFiles += 1;
    restoredBytes += bytes.byteLength;
  }
  return { restoredBytes, restoredFiles };
}

function normalizeImportedLoginStateBundle(value: unknown): ElectronEncryptedLoginStateBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Encrypted browser login-state bundle is invalid.");
  }
  const record = value as Partial<ElectronEncryptedLoginStateBundle>;
  if (
    typeof record.encryptedPayloadBase64 !== "string" ||
    record.encryption !== "electron-safe-storage" ||
    (record.payloadFormat !== "electron-session-cookies/v1" &&
      record.payloadFormat !== "electron-session-state/v2")
  ) {
    throw new Error("Encrypted browser login-state bundle is unsupported.");
  }
  return {
    cookieCount: typeof record.cookieCount === "number" ? record.cookieCount : 0,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    encryptedPayloadBase64: record.encryptedPayloadBase64,
    encryption: "electron-safe-storage",
    id: typeof record.id === "string" ? record.id : randomUUID(),
    originCount: typeof record.originCount === "number" ? record.originCount : 0,
    payloadFormat: record.payloadFormat,
    stateByteCount: typeof record.stateByteCount === "number" ? record.stateByteCount : undefined,
    stateFileCount: typeof record.stateFileCount === "number" ? record.stateFileCount : undefined,
    summary:
      typeof record.summary === "string"
        ? record.summary
        : "Encrypted Electron browser session-state bundle.",
  };
}

function normalizeImportedCookie(value: unknown): ElectronCookieSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<ElectronCookieSnapshot>;
  if (typeof record.name !== "string" || typeof record.value !== "string") {
    return null;
  }
  const cookie: ElectronCookieSnapshot = {
    domain: typeof record.domain === "string" ? record.domain : undefined,
    expirationDate: typeof record.expirationDate === "number" ? record.expirationDate : undefined,
    httpOnly: record.httpOnly === true,
    name: record.name,
    path: typeof record.path === "string" ? record.path : "/",
    sameSite: record.sameSite,
    secure: record.secure === true,
    session: record.session === true,
    value: record.value,
  };
  return cookieUrl(cookie) ? cookie : null;
}

function registerBrowserStaticDataIpc() {
  ipcMain.handle(BROWSER_LOGIN_STATE_EXPORT_CHANNEL, async () => {
    await requireAdministratorAuthorizationForBrowserDataExport();
    assertSafeStorageAvailable();
    await session.defaultSession.flushStorageData();
    const storageRoot = resolveSessionStoragePath();
    const cookies = await session.defaultSession.cookies.get({});
    const storageFiles = await exportBrowserStorageFiles(storageRoot);
    const stateByteCount = storageFiles.reduce((total, file) => total + file.size, 0);
    const payload: ElectronBrowserSessionStatePayload = {
      cookies: cookies.map((cookie) => ({
        domain: cookie.domain,
        expirationDate: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        name: cookie.name,
        path: cookie.path,
        sameSite: cookie.sameSite,
        secure: cookie.secure,
        session: cookie.session,
        value: cookie.value,
      })),
      exportedAt: Date.now(),
      payloadFormat: "electron-session-state/v2",
      storageFiles,
      storageRoot: "electron-default-session",
    };
    const origins = new Set(payload.cookies.map(cookieOrigin).filter((origin) => origin !== null));
    return {
      cookieCount: payload.cookies.length,
      createdAt: payload.exportedAt,
      encryptedPayloadBase64: safeStorage.encryptString(JSON.stringify(payload)).toString("base64"),
      encryption: "electron-safe-storage",
      id: `electron-login-state:${randomUUID()}`,
      originCount: origins.size,
      payloadFormat: "electron-session-state/v2",
      stateByteCount,
      stateFileCount: storageFiles.length,
      summary: `Encrypted ${payload.cookies.length} Electron cookies and ${storageFiles.length} browser storage files across ${origins.size} origins.`,
    } satisfies ElectronEncryptedLoginStateBundle;
  });

  ipcMain.handle(BROWSER_LOGIN_STATE_IMPORT_CHANNEL, async (_event, bundle: unknown) => {
    assertSafeStorageAvailable();
    const normalizedBundle = normalizeImportedLoginStateBundle(bundle);
    const decrypted = safeStorage.decryptString(
      Buffer.from(normalizedBundle.encryptedPayloadBase64, "base64")
    );
    const parsed = JSON.parse(decrypted) as Partial<
      ElectronCookieLoginStatePayload | ElectronBrowserSessionStatePayload
    >;
    if (
      (parsed.payloadFormat !== "electron-session-cookies/v1" &&
        parsed.payloadFormat !== "electron-session-state/v2") ||
      !Array.isArray(parsed.cookies)
    ) {
      throw new Error("Encrypted browser login-state payload is invalid.");
    }
    let restoredFiles = 0;
    let restoredBytes = 0;
    if (parsed.payloadFormat === "electron-session-state/v2") {
      const storageFiles = Array.isArray(parsed.storageFiles)
        ? parsed.storageFiles
            .map(normalizeImportedStorageFile)
            .filter((file): file is ElectronBrowserStateFileSnapshot => file !== null)
        : [];
      const restoredState = await restoreBrowserStorageFiles(
        resolveSessionStoragePath(),
        storageFiles
      );
      restoredFiles = restoredState.restoredFiles;
      restoredBytes = restoredState.restoredBytes;
    }
    const cookies = parsed.cookies
      .map(normalizeImportedCookie)
      .filter((cookie): cookie is ElectronCookieSnapshot => cookie !== null);
    let importedCookies = 0;
    const origins = new Set<string>();
    for (const cookie of cookies) {
      const url = cookieUrl(cookie);
      if (!url) {
        continue;
      }
      origins.add(cookieOrigin(cookie) ?? url);
      await session.defaultSession.cookies.set({
        domain: cookie.domain,
        expirationDate: cookie.session ? undefined : cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        name: cookie.name,
        path: cookie.path,
        sameSite: cookie.sameSite === "unspecified" ? undefined : cookie.sameSite,
        secure: cookie.secure,
        url,
        value: cookie.value,
      });
      importedCookies += 1;
    }
    await session.defaultSession.flushStorageData();
    return {
      importedCookies,
      originCount: origins.size,
      restoredBytes,
      restoredFiles,
    };
  });

  ipcMain.handle(BROWSER_SITE_DATA_EXPORT_TO_CHROME_CHANNEL, async (_event, input: unknown) => {
    await requireAdministratorAuthorizationForBrowserDataExport();
    const targetUrl =
      input && typeof input === "object" && !Array.isArray(input)
        ? normalizeChromeExportTargetUrl((input as { targetUrl?: unknown }).targetUrl)
        : normalizeChromeExportTargetUrl(null);
    await session.defaultSession.flushStorageData();
    const storageRoot = resolveSessionStoragePath();
    const storageFiles = await exportBrowserStorageFiles(storageRoot);
    const chromeUserDataRoot = join(app.getPath("userData"), "chrome-site-data-export");
    const chromeProfilePath = join(chromeUserDataRoot, "Default");
    const restoredState = await restoreBrowserStorageFiles(chromeProfilePath, storageFiles);
    const chromeExecutablePath = await resolveChromeExecutablePath();
    const chromeProcess = spawn(
      chromeExecutablePath,
      [
        `--user-data-dir=${chromeUserDataRoot}`,
        "--profile-directory=Default",
        "--no-first-run",
        "--new-window",
        targetUrl,
      ],
      {
        detached: true,
        stdio: "ignore",
      }
    );
    chromeProcess.unref();
    return {
      chromeExecutablePath,
      profilePath: chromeProfilePath,
      restoredBytes: restoredState.restoredBytes,
      restoredFiles: restoredState.restoredFiles,
      summary: `Exported ${restoredState.restoredFiles} browser site-data files into a HugeCode-managed Chrome profile.`,
      targetUrl,
    } satisfies ElectronChromeSiteDataExportResult;
  });
}

function registerRuntimeRpcIpc() {
  ipcMain.handle(
    RUNTIME_RPC_INVOKE_CHANNEL,
    async (_event, method: unknown, params: unknown = {}) => {
      if (typeof method !== "string" || method.trim().length === 0) {
        throw new Error("Runtime RPC method is required.");
      }
      const normalizedParams =
        params && typeof params === "object" && !Array.isArray(params)
          ? (params as Record<string, unknown>)
          : {};
      const response = await fetch(resolveRuntimeRpcEndpoint(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          method,
          params: normalizedParams,
        }),
      });
      if (!response.ok) {
        throw new Error(`Runtime RPC ${method} failed with HTTP ${response.status}.`);
      }
      const envelope = (await response.json()) as RuntimeRpcEnvelope;
      if (!envelope.ok) {
        throw new Error(envelope.error?.message ?? `Runtime RPC ${method} rejected request.`);
      }
      return envelope.result;
    }
  );
}

function registerBrowserChromeIpc() {
  ipcMain.handle(BROWSER_CHROME_GET_SNAPSHOT_CHANNEL, (event) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.")
        .snapshot;
    }
    return controller.getSnapshot();
  });

  ipcMain.handle(BROWSER_CHROME_CREATE_TAB_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    return controller.createTab(
      readPayloadString(payload, "url"),
      readPayloadBoolean(payload, "activate") ?? true
    );
  });

  ipcMain.handle(BROWSER_CHROME_CLOSE_TAB_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    const tabId = readPayloadString(payload, "tabId");
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    if (!tabId) {
      return createBrowserChromeIpcErrorResult(controller, "Browser tab id is required.");
    }
    return controller.closeTab(tabId);
  });

  ipcMain.handle(BROWSER_CHROME_ACTIVATE_TAB_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    const tabId = readPayloadString(payload, "tabId");
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    if (!tabId) {
      return createBrowserChromeIpcErrorResult(controller, "Browser tab id is required.");
    }
    return controller.activateTab(tabId);
  });

  ipcMain.handle(BROWSER_CHROME_NAVIGATE_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    const url = readPayloadString(payload, "url");
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    if (!url) {
      return createBrowserChromeIpcErrorResult(controller, "Browser URL is required.");
    }
    return controller.navigate(url, readPayloadString(payload, "tabId"));
  });

  ipcMain.handle(BROWSER_CHROME_GO_BACK_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    return controller.goBack(readPayloadString(payload, "tabId"));
  });

  ipcMain.handle(BROWSER_CHROME_GO_FORWARD_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    return controller.goForward(readPayloadString(payload, "tabId"));
  });

  ipcMain.handle(BROWSER_CHROME_RELOAD_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    return controller.reload(readPayloadString(payload, "tabId"));
  });

  ipcMain.handle(BROWSER_CHROME_STOP_CHANNEL, (event, payload: unknown = {}) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    return controller.stop(readPayloadString(payload, "tabId"));
  });
}

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    title: "HugeCode",
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0f1115",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHugeCodeBrowserLaunchUrl(url)) {
      createBrowserWindow(url);
      return { action: "deny" };
    }
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void mainWindow.loadURL(resolveRendererUrl());

  if (devServerUrl) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  return mainWindow;
}

app.setName("HugeCode");

void app.whenReady().then(() => {
  registerBrowserStaticDataIpc();
  registerRuntimeRpcIpc();
  registerBrowserChromeIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
