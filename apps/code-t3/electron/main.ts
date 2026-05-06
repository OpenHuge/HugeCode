import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  safeStorage,
  session,
  shell,
  WebContentsView,
  type MenuItemConstructorOptions,
} from "electron";
import { spawn } from "node:child_process";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { appendFile, lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
import {
  buildT3BrowserPortableLoginStateContract,
  normalizeT3BrowserAllowedOrigins,
  T3_BROWSER_PORTABLE_ENCRYPTION,
  T3_BROWSER_SAFE_STORAGE_ENCRYPTION,
  type T3BrowserLoginStateEncryption,
  type T3BrowserPortableLoginStateContract,
  type T3BrowserPortableLoginStateCrypto,
} from "../src/runtime/t3BrowserAccountDataContract";
import {
  clearT3BrowserSessionStorage,
  normalizeT3BrowserCaptureMode,
  resolveT3BrowserSessionPlanFromLaunchUrl,
  type T3BrowserCaptureMode,
} from "../src/runtime/t3BrowserChromeSessionPolicy";

const devServerUrl = process.env.HUGECODE_T3_DESKTOP_DEV_SERVER_URL;
const BROWSER_LOGIN_STATE_PREFLIGHT_CHANNEL = "hugecode:browser-static-data:check-login-state";
const BROWSER_LOGIN_STATE_EXPORT_CHANNEL = "hugecode:browser-static-data:export-login-state";
const BROWSER_LOGIN_STATE_IMPORT_CHANNEL = "hugecode:browser-static-data:import-login-state";
const BROWSER_SITE_DATA_EXPORT_TO_CHROME_CHANNEL = "hugecode:browser-static-data:export-to-chrome";
const RUNTIME_RPC_INVOKE_CHANNEL = "hugecode:runtime:invoke";
const BROWSER_CHROME_GET_SNAPSHOT_CHANNEL = "hugecode:browser-chrome:get-snapshot";
const BROWSER_CHROME_CREATE_TAB_CHANNEL = "hugecode:browser-chrome:create-tab";
const BROWSER_CHROME_CLOSE_TAB_CHANNEL = "hugecode:browser-chrome:close-tab";
const BROWSER_CHROME_CLOSE_WINDOW_CHANNEL = "hugecode:browser-chrome:close-window";
const BROWSER_CHROME_ACTIVATE_TAB_CHANNEL = "hugecode:browser-chrome:activate-tab";
const BROWSER_CHROME_NAVIGATE_CHANNEL = "hugecode:browser-chrome:navigate";
const BROWSER_CHROME_GO_BACK_CHANNEL = "hugecode:browser-chrome:go-back";
const BROWSER_CHROME_GO_FORWARD_CHANNEL = "hugecode:browser-chrome:go-forward";
const BROWSER_CHROME_RELOAD_CHANNEL = "hugecode:browser-chrome:reload";
const BROWSER_CHROME_STOP_CHANNEL = "hugecode:browser-chrome:stop";
const BROWSER_CHROME_SNAPSHOT_CHANNEL = "hugecode:browser-chrome:snapshot";
const OPENHUGE_DELIVERY_INVOKE_CHANNEL = "hugecode:openhuge-delivery:invoke";
const OPENHUGE_CONSUMER_DEBUG_CHANNEL = "hugecode:openhuge-consumer-debug:write";
const EMBEDDED_BROWSER_SHOW_CHANNEL = "hugecode:embedded-browser:show";
const EMBEDDED_BROWSER_SET_BOUNDS_CHANNEL = "hugecode:embedded-browser:set-bounds";
const EMBEDDED_BROWSER_HIDE_CHANNEL = "hugecode:embedded-browser:hide";
const EMBEDDED_BROWSER_AUTH_REQUIRED_CHANNEL = "hugecode:embedded-browser:auth-required";
const OPERATOR_UNLOCK_OVERLAY_SHOW_CHANNEL = "hugecode:operator-unlock-overlay:show";
const OPERATOR_UNLOCK_OVERLAY_CLOSE_CHANNEL = "hugecode:operator-unlock-overlay:close";
const OPERATOR_UNLOCK_OVERLAY_ATTEMPT_CHANNEL = "hugecode:operator-unlock-overlay:attempt";
const OPERATOR_UNLOCK_OVERLAY_SUBMIT_CHANNEL = "hugecode:operator-unlock-overlay:submit";
const OPERATOR_UNLOCK_OVERLAY_RESOLVE_CHANNEL = "hugecode:operator-unlock-overlay:resolve";
const BROWSER_CHROME_HEIGHT = 84;
const BROWSER_DATA_EXPORT_ADMIN_AUTH_PROMPT =
  "HugeCode needs administrator approval to export built-in browser data.";
const OPENHUGE_DEFAULT_PROVIDER = "chatgpt";
const OPENHUGE_DEFAULT_SERVICE_DAYS = 30;
const OPENHUGE_DEFAULT_SERVICE_KIND = "manual_browser_account";
const OPENHUGE_ARTIFACT_KIND = "browser_account_bundle";
const OPENHUGE_ARTIFACT_CONTENT_TYPE = "application/octet-stream";
const OPENHUGE_DELIVERY_CONFIG_FILE = "openhuge-delivery.json";
const OPENHUGE_CONSUMER_DEBUG_LOG_FILE = "openhuge-consumer-debug.jsonl";
const EMBEDDED_BROWSER_ACCOUNT_NOTICE_TEXT = "请不要退出账户，退出默认放弃账户。";
const EMBEDDED_BROWSER_AUTH_REQUIRED_MESSAGE = "账号已退出，请重新输入有效兑换码恢复。";
const DAY_IN_MS = 86_400_000;

type ElectronCookieSnapshot = {
  domain?: string;
  expirationDate?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  name: string;
  path?: string;
  sameSite?: "lax" | "no_restriction" | "strict" | "unspecified";
  secure?: boolean;
  session?: boolean;
  value: string;
};

type ElectronCookieLoginStatePayload = {
  allowedOrigins?: string[];
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
  allowedOrigins: string[];
  cookies: ElectronCookieSnapshot[];
  exportedAt: number;
  payloadFormat: "electron-session-state/v2";
  storageFiles: ElectronBrowserStateFileSnapshot[];
  storageRoot: "electron-default-session" | "electron-operator-delivery-session";
};

type ElectronEncryptedLoginStateBundle = {
  cookieCount: number;
  createdAt: number;
  encryptedPayloadBase64: string;
  encryption: T3BrowserLoginStateEncryption;
  id: string;
  originCount: number;
  payloadFormat: "electron-session-cookies/v1" | "electron-session-state/v2";
  portableContract?: T3BrowserPortableLoginStateContract;
  portableCrypto?: T3BrowserPortableLoginStateCrypto;
  stateByteCount?: number;
  stateFileCount?: number;
  summary: string;
};

type ElectronBrowserStaticDataExportInput = {
  allowedOrigins: string[];
  importSecret: string;
};

type ElectronBrowserStaticDataImportInput = {
  importSecret?: string;
};

type ElectronBrowserLoginStateImportResult = {
  importedCookies: number;
  originCount: number;
  restoredBytes: number;
  restoredFiles: number;
  success: boolean;
  summary: string | null;
};

type ElectronBrowserLoginStatePreflightResult = {
  allowedOrigins: string[];
  cookieCount: number;
  originCount: number;
  provider: "chatgpt";
  status: "loggedIn" | "notLoggedIn";
  storageFileCount: number;
  summary: string;
};

type OpenHugeDeliveryDesktopConfig = {
  authToken: string;
  baseUrl: string;
  projectId: string;
  serviceDays: number;
  serviceKind: string;
  tenantId: string;
};

type OpenHugeDeliveryOperation =
  | "prepare"
  | "readStatus"
  | "redeem"
  | "submitExportWitness"
  | "uploadArtifact";

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

type EmbeddedBrowserBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type EmbeddedBrowserController = {
  authRequired: boolean;
  targetUrl: string;
  view: WebContentsView;
};

type OperatorUnlockOverlayResult = {
  message?: string | null;
  ok: boolean;
};

type OperatorUnlockOverlayController = {
  detachHostListeners: () => void;
  hostWindowId: number;
  window: BrowserWindow;
};

type PendingOperatorUnlockOverlayRequest = {
  hostWindowId: number;
  resolve: (result: OperatorUnlockOverlayResult) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type BrowserChromeWindowController = {
  activateTab: (tabId: string) => BrowserChromeCommandResult;
  closeTab: (tabId: string) => BrowserChromeCommandResult;
  closeWindow: () => Promise<BrowserChromeCommandResult>;
  createTab: (url: string | null, activate?: boolean) => BrowserChromeCommandResult;
  getBrowserCaptureMode: () => T3BrowserCaptureMode | null;
  getBrowserSession: () => Electron.Session;
  getSnapshot: () => BrowserChromeSnapshot;
  goBack: (tabId?: string | null) => BrowserChromeCommandResult;
  goForward: (tabId?: string | null) => BrowserChromeCommandResult;
  navigate: (url: string, tabId?: string | null) => BrowserChromeCommandResult;
  reload: (tabId?: string | null) => BrowserChromeCommandResult;
  stop: (tabId?: string | null) => BrowserChromeCommandResult;
};

const browserChromeControllers = new Map<number, BrowserChromeWindowController>();
const embeddedBrowserControllers = new Map<number, EmbeddedBrowserController>();
const operatorUnlockOverlayControllers = new Map<number, OperatorUnlockOverlayController>();
const pendingOperatorUnlockOverlayRequests = new Map<string, PendingOperatorUnlockOverlayRequest>();
let nextBrowserChromeTabSequence = 1;

type BrowserChromeSessionScope = {
  captureMode: T3BrowserCaptureMode | null;
  cleanupOnClose: boolean;
  browserSession: Electron.Session;
};

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

function resetProductWindowZoom(window: BrowserWindow) {
  function applyZoomReset() {
    window.webContents.setZoomLevel(0);
    window.webContents.setZoomFactor(1);
    void window.webContents.setVisualZoomLevelLimits(1, 1);
  }
  applyZoomReset();
  window.webContents.on("did-finish-load", applyZoomReset);
}

function configureApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "文件",
      submenu: [
        { label: "关闭窗口", role: "close" },
        { type: "separator" },
        { label: "退出 HugeCode", role: "quit" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", role: "reload" },
        { label: "强制重新加载", role: "forceReload" },
        { type: "separator" },
        { label: "实际大小", role: "resetZoom" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { type: "separator" },
        { label: "全屏", role: "togglefullscreen" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { label: "最小化", role: "minimize" },
        { label: "缩放", role: "zoom" },
        { type: "separator" },
        { label: "前置全部窗口", role: "front" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getBrowserChromeControllerForSender(sender: Electron.WebContents) {
  const senderWindow = BrowserWindow.fromWebContents(sender);
  return senderWindow ? (browserChromeControllers.get(senderWindow.id) ?? null) : null;
}

function findActiveOperatorDeliveryController() {
  return (
    Array.from(browserChromeControllers.values()).find(
      (controller) => controller.getBrowserCaptureMode() === "operator-delivery"
    ) ?? null
  );
}

function resolveBrowserStaticDataSessionScope(
  sender: Electron.WebContents,
  input?: unknown
): {
  browserSession: Electron.Session;
  storageRoot: ElectronBrowserSessionStatePayload["storageRoot"];
} {
  const controller = getBrowserChromeControllerForSender(sender);
  if (controller?.getBrowserCaptureMode() === "operator-delivery") {
    return {
      browserSession: controller.getBrowserSession(),
      storageRoot: "electron-operator-delivery-session",
    };
  }
  if (readPayloadCaptureMode(input) === "operator-delivery") {
    const operatorController = findActiveOperatorDeliveryController();
    if (!operatorController) {
      throw new Error(
        "Production browser session is unavailable. Reopen ChatGPT in production capture mode before checking or exporting account data."
      );
    }
    return {
      browserSession: operatorController.getBrowserSession(),
      storageRoot: "electron-operator-delivery-session",
    };
  }
  return {
    browserSession: session.defaultSession,
    storageRoot: "electron-default-session",
  };
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

function readPayloadCaptureMode(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return normalizeT3BrowserCaptureMode((value as Record<string, unknown>).captureMode);
}

function isEmbeddableBrowserChromeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function readFinitePayloadNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEmbeddedBrowserBounds(value: unknown): EmbeddedBrowserBounds | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const boundsRecord =
    record.bounds && typeof record.bounds === "object" && !Array.isArray(record.bounds)
      ? (record.bounds as Record<string, unknown>)
      : record;
  const x = readFinitePayloadNumber(boundsRecord.x);
  const y = readFinitePayloadNumber(boundsRecord.y);
  const width = readFinitePayloadNumber(boundsRecord.width);
  const height = readFinitePayloadNumber(boundsRecord.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }
  return {
    height: Math.max(1, Math.round(height)),
    width: Math.max(1, Math.round(width)),
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
  };
}

function readEmbeddedBrowserTargetUrl(value: unknown) {
  const rawUrl = readPayloadString(value, "url") ?? "https://chatgpt.com/";
  const normalizedUrl = normalizeBrowserChromeNavigationInput(rawUrl);
  if (!normalizedUrl || !isEmbeddableBrowserChromeUrl(normalizedUrl)) {
    throw new Error("Embedded browser requires a valid http or https URL.");
  }
  return normalizedUrl;
}

function isChatGptHost(hostname: string) {
  return hostname === "chatgpt.com" || hostname === "www.chatgpt.com";
}

function isChatGptAuthRequiredUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!isChatGptHost(parsed.hostname)) {
      return false;
    }
    const pathname = parsed.pathname.toLowerCase();
    return (
      pathname === "/auth" ||
      pathname.startsWith("/auth/") ||
      pathname === "/login" ||
      pathname === "/signup" ||
      pathname === "/sign-in" ||
      pathname === "/sign-up"
    );
  } catch {
    return false;
  }
}

function buildEmbeddedBrowserAuthRequiredProbeScript() {
  return `
(() => {
  const allowedHosts = new Set(["chatgpt.com", "www.chatgpt.com"]);
  if (!allowedHosts.has(window.location.hostname)) {
    return { matched: false, reason: "host" };
  }
  const pathname = window.location.pathname.toLowerCase();
  if (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/sign-in" ||
    pathname === "/sign-up"
  ) {
    return { matched: true, reason: "auth-url", url: window.location.href };
  }
  const hasConversationComposer = Boolean(
    document.querySelector('textarea, [contenteditable="true"], form[data-testid*="composer"]')
  );
  if (hasConversationComposer) {
    return { matched: false, reason: "conversation-composer" };
  }
  const actionTexts = Array.from(document.querySelectorAll("a, button")).map((node) =>
    (node.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase()
  );
  const hasLoginAction = actionTexts.some((text) => text === "登录" || text === "log in");
  const hasSignupAction = actionTexts.some((text) => text === "免费注册" || text === "sign up");
  const hasGetStartedAction = actionTexts.some((text) => text === "开始使用" || text === "get started");
  const hasLoggedOutEntry = (hasLoginAction && hasSignupAction) || (hasGetStartedAction && (hasLoginAction || hasSignupAction));
  return {
    matched: Boolean(hasLoggedOutEntry),
    reason: hasLoggedOutEntry ? "logged-out-entry" : "content",
    url: window.location.href
  };
})();
`;
}

function notifyEmbeddedBrowserAuthRequired(
  browserWindow: BrowserWindow,
  controller: EmbeddedBrowserController,
  reason: string,
  url: string
) {
  if (browserWindow.isDestroyed() || controller.authRequired) {
    return;
  }
  controller.authRequired = true;
  controller.view.setVisible(false);
  browserWindow.webContents.send(EMBEDDED_BROWSER_AUTH_REQUIRED_CHANNEL, {
    message: EMBEDDED_BROWSER_AUTH_REQUIRED_MESSAGE,
    reason,
    url,
  });
}

function probeEmbeddedBrowserAuthRequired(
  browserWindow: BrowserWindow,
  controller: EmbeddedBrowserController,
  reason: string
) {
  const webContents = controller.view.webContents;
  if (browserWindow.isDestroyed() || webContents.isDestroyed()) {
    return;
  }
  const currentUrl = webContents.getURL();
  if (isChatGptAuthRequiredUrl(currentUrl)) {
    notifyEmbeddedBrowserAuthRequired(browserWindow, controller, reason, currentUrl);
    return;
  }
  void webContents
    .executeJavaScript(buildEmbeddedBrowserAuthRequiredProbeScript(), true)
    .then((result: unknown) => {
      if (browserWindow.isDestroyed() || webContents.isDestroyed()) {
        return;
      }
      const record =
        result && typeof result === "object" && !Array.isArray(result)
          ? (result as Record<string, unknown>)
          : null;
      if (record?.matched === true) {
        notifyEmbeddedBrowserAuthRequired(
          browserWindow,
          controller,
          typeof record.reason === "string" ? record.reason : reason,
          typeof record.url === "string" ? record.url : webContents.getURL()
        );
      }
    })
    .catch(() => undefined);
}

function buildEmbeddedBrowserAccountNoticeScript() {
  return `
(() => {
  const noticeId = "hugecode-account-usage-notice";
  const shownKey = "hugecode:account-usage-notice-shown:v1";
  const boundKey = "__hugeCodeAccountUsageNoticeBound";
  const shownMemoryKey = "__hugeCodeAccountUsageNoticeShown";
  const text = ${JSON.stringify(EMBEDDED_BROWSER_ACCOUNT_NOTICE_TEXT)};
  const allowedHosts = new Set(["chatgpt.com", "www.chatgpt.com"]);
  if (!allowedHosts.has(window.location.hostname)) {
    document.getElementById(noticeId)?.remove();
    return;
  }
  document.getElementById(noticeId)?.remove();
  const installProductChromeStyle = () => {
    if (document.getElementById("hugecode-product-chrome-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "hugecode-product-chrome-style";
    style.textContent = [
      ".hugecode-sidebar-toggle-marker{position:relative!important;}",
      ".hugecode-sidebar-toggle-marker>svg{opacity:0!important;}",
      ".hugecode-sidebar-toggle-marker::after{content:'';position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-45%,-50%);border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:8px solid currentColor;opacity:.86;pointer-events:none;}"
    ].join("");
    document.head?.appendChild(style);
  };

  const applyProductChrome = () => {
    installProductChromeStyle();
    const buttons = Array.from(document.querySelectorAll("button"));
    const sidebarToggle = buttons.find((button) => {
      const aria = (button.getAttribute("aria-label") || "").toLowerCase();
      if (
        !aria.includes("sidebar") &&
        !aria.includes("side bar") &&
        !aria.includes("侧边栏") &&
        !aria.includes("边栏")
      ) {
        return false;
      }
      const rect = button.getBoundingClientRect();
      return rect.top >= 0 && rect.top <= 96 && rect.left >= 0 && rect.left <= 140;
    });
    if (sidebarToggle) {
      sidebarToggle.classList.add("hugecode-sidebar-toggle-marker");
    }
  };

  applyProductChrome();
  if (window[boundKey]) {
    return;
  }
  window[boundKey] = true;
  const productChromeTimer = window.setInterval(applyProductChrome, 800);
  window.setTimeout(() => window.clearInterval(productChromeTimer), 8000);

  const hasShown = () => {
    if (window[shownMemoryKey]) {
      return true;
    }
    try {
      return window.sessionStorage.getItem(shownKey) === "1";
    } catch {
      return false;
    }
  };

  const markShown = () => {
    window[shownMemoryKey] = true;
    try {
      window.sessionStorage.setItem(shownKey, "1");
    } catch {
      return;
    }
  };

  const isLikelyAccountClick = (event) => {
    if (!document.body || !(event.target instanceof Element)) {
      return false;
    }
    const target = event.target;
    if (target.closest("#" + noticeId)) {
      return false;
    }
    const inLeftRail = event.clientX <= Math.min(430, window.innerWidth * 0.36);
    const inAccountBand = event.clientY >= window.innerHeight - 172;
    if (!inLeftRail || !inAccountBand) {
      return false;
    }
    let node = target;
    for (let depth = 0; node && depth < 8; depth += 1) {
      const aria = (node.getAttribute("aria-label") || "").toLowerCase();
      const testId = (node.getAttribute("data-testid") || "").toLowerCase();
      const textContent = (node.textContent || "").replace(/\\s+/g, " ").trim();
      if (
        aria.includes("account") ||
        aria.includes("profile") ||
        aria.includes("账户") ||
        aria.includes("个人") ||
        testId.includes("profile") ||
        testId.includes("account") ||
        textContent.includes("免费版") ||
        textContent.includes("升级")
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return true;
  };

  const showNotice = (event) => {
    if (hasShown()) {
      return;
    }
    if (!document.body) {
      return;
    }
    markShown();
    let notice = document.getElementById(noticeId);
    if (!notice) {
      notice = document.createElement("div");
      notice.id = noticeId;
      notice.setAttribute("role", "note");
      notice.style.position = "fixed";
      notice.style.zIndex = "2147483647";
      notice.style.boxSizing = "border-box";
      notice.style.width = "min(268px, calc(100vw - 32px))";
      notice.style.border = "1px solid rgba(255, 255, 255, 0.07)";
      notice.style.borderRadius = "12px";
      notice.style.background = "rgba(28, 28, 28, 0.56)";
      notice.style.backdropFilter = "blur(10px)";
      notice.style.webkitBackdropFilter = "blur(10px)";
      notice.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.14)";
      notice.style.color = "rgba(255, 255, 255, 0.52)";
      notice.style.font = "500 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      notice.style.letterSpacing = "0";
      notice.style.padding = "8px 10px";
      notice.style.pointerEvents = "none";
      notice.style.userSelect = "none";
      notice.style.whiteSpace = "normal";
      notice.style.wordBreak = "break-word";
      document.body.appendChild(notice);
    }
    const left = Math.max(12, Math.min(event.clientX - 28, window.innerWidth - 292));
    const bottom = Math.max(74, Math.min(142, window.innerHeight - event.clientY + 18));
    notice.style.left = left + "px";
    notice.style.bottom = bottom + "px";
    notice.style.opacity = "1";
    notice.textContent = text;
    window.setTimeout(() => {
      const currentNotice = document.getElementById(noticeId);
      if (currentNotice) {
        currentNotice.style.opacity = "0";
        window.setTimeout(() => currentNotice.remove(), 160);
      }
    }, 1000);
  };

  document.addEventListener(
    "click",
    (event) => {
      if (isLikelyAccountClick(event)) {
        showNotice(event);
      }
    },
    true
  );
})();
`;
}

function injectEmbeddedBrowserAccountNotice(view: WebContentsView) {
  const webContents = view.webContents;
  if (webContents.isDestroyed()) {
    return;
  }
  void webContents
    .executeJavaScript(buildEmbeddedBrowserAccountNoticeScript(), true)
    .catch(() => undefined);
}

function buildOperatorUnlockOverlayHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';"
    />
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
        color: rgba(255, 255, 255, 0.9);
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        letter-spacing: 0;
      }

      body {
        display: grid;
        place-items: center;
        padding: 18px;
      }

      .card {
        width: min(468px, 100%);
        border: 1px solid rgba(245, 158, 11, 0.38);
        border-radius: 18px;
        background:
          radial-gradient(circle at top right, rgba(180, 83, 9, 0.3), transparent 42%),
          rgba(22, 22, 22, 0.94);
        box-shadow:
          0 22px 70px rgba(0, 0, 0, 0.48),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        padding: 20px;
      }

      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      h1 {
        margin: 0;
        font-size: 18px;
        line-height: 1.25;
        font-weight: 760;
      }

      .subtitle {
        margin: 6px 0 0;
        color: rgba(255, 255, 255, 0.62);
        font-size: 12px;
        line-height: 1.55;
      }

      .close {
        width: 32px;
        height: 32px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.72);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }

      form {
        display: grid;
        gap: 12px;
      }

      label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        font-weight: 650;
      }

      input {
        width: 100%;
        height: 48px;
        border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 14px;
        outline: none;
        background: rgba(255, 255, 255, 0.92);
        color: #151515;
        font-size: 16px;
        padding: 0 14px;
      }

      input:focus {
        border-color: rgba(245, 158, 11, 0.82);
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.16);
      }

      .note {
        margin: 0;
        color: rgba(255, 255, 255, 0.52);
        font-size: 12px;
        line-height: 1.55;
      }

      .error {
        min-height: 18px;
        color: #fca5a5;
        font-size: 12px;
        line-height: 1.4;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      button {
        height: 38px;
        border: 0;
        border-radius: 12px;
        padding: 0 15px;
        font-size: 13px;
        font-weight: 760;
        cursor: pointer;
      }

      .secondary {
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.7);
      }

      .primary {
        background: linear-gradient(135deg, #0f766e, #115e59);
        color: white;
      }

      button:disabled {
        cursor: wait;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
    <section class="card" role="dialog" aria-modal="true" aria-label="生产端本地解锁">
      <div class="header">
        <div>
          <h1>生产端本地解锁</h1>
          <p class="subtitle">
            输入本地生产端密码后进入生产工作台。此入口只解锁本机生产操作界面，不代表后端订单、账号池或客户权限。
          </p>
        </div>
        <button class="close" type="button" aria-label="关闭">×</button>
      </div>
      <form>
        <label for="password">生产端本地密码</label>
        <input id="password" name="password" type="password" autocomplete="off" autofocus />
        <p class="note">如不需要生产操作，请关闭本卡片继续客户使用。</p>
        <div class="error" aria-live="polite"></div>
        <div class="actions">
          <button class="secondary" type="button" data-close>关闭</button>
          <button class="primary" type="submit">解锁生产工作台</button>
        </div>
      </form>
    </section>
    <script>
      const bridge = window.hugeCodeDesktopHost?.operatorUnlockOverlay;
      const form = document.querySelector("form");
      const input = document.querySelector("#password");
      const error = document.querySelector(".error");
      const submitButton = document.querySelector(".primary");
      const closeButtons = document.querySelectorAll("[data-close], .close");

      function setError(message) {
        error.textContent = message || "";
      }

      closeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          bridge?.close?.();
        });
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = input.value;
        if (!password.trim()) {
          setError("请输入生产端本地密码。");
          input.focus();
          return;
        }
        setError("");
        submitButton.disabled = true;
        submitButton.textContent = "正在解锁...";
        try {
          const result = await bridge?.submitPassword?.({ password });
          if (!result?.ok) {
            setError(result?.message || "生产端本地密码不正确。");
            input.select();
          }
        } catch {
          setError("生产端解锁通道不可用，请重试。");
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "解锁生产工作台";
        }
      });

      window.addEventListener("load", () => input.focus());
    </script>
  </body>
</html>`;
}

function findOperatorUnlockOverlayControllerByWindowId(windowId: number) {
  return (
    Array.from(operatorUnlockOverlayControllers.values()).find(
      (controller) => controller.window.id === windowId
    ) ?? null
  );
}

function repositionOperatorUnlockOverlay(hostWindow: BrowserWindow, overlayWindow: BrowserWindow) {
  if (hostWindow.isDestroyed() || overlayWindow.isDestroyed()) {
    return;
  }
  const hostBounds = hostWindow.getBounds();
  const width = Math.max(360, Math.min(520, hostBounds.width - 48));
  const height = Math.max(300, Math.min(360, hostBounds.height - 48));
  overlayWindow.setBounds({
    height,
    width,
    x: hostBounds.x + Math.round((hostBounds.width - width) / 2),
    y: hostBounds.y + Math.round((hostBounds.height - height) / 2),
  });
}

function destroyOperatorUnlockOverlay(hostWindowId: number) {
  const controller = operatorUnlockOverlayControllers.get(hostWindowId);
  if (!controller) {
    return;
  }
  operatorUnlockOverlayControllers.delete(hostWindowId);
  controller.detachHostListeners();
  if (!controller.window.isDestroyed()) {
    controller.window.close();
  }
}

function showOperatorUnlockOverlay(hostWindow: BrowserWindow) {
  const existing = operatorUnlockOverlayControllers.get(hostWindow.id);
  if (existing && !existing.window.isDestroyed()) {
    repositionOperatorUnlockOverlay(hostWindow, existing.window);
    existing.window.show();
    existing.window.focus();
    return;
  }
  destroyOperatorUnlockOverlay(hostWindow.id);

  const overlayWindow = new BrowserWindow({
    backgroundColor: "#00000000",
    frame: false,
    fullscreenable: false,
    height: 340,
    maximizable: false,
    minimizable: false,
    modal: true,
    parent: hostWindow,
    resizable: false,
    show: false,
    skipTaskbar: true,
    title: "生产端本地解锁",
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
      sandbox: true,
    },
    width: 500,
  });

  const reposition = () => repositionOperatorUnlockOverlay(hostWindow, overlayWindow);
  const detachHostListeners = () => {
    hostWindow.removeListener("move", reposition);
    hostWindow.removeListener("resize", reposition);
  };
  const controller: OperatorUnlockOverlayController = {
    detachHostListeners,
    hostWindowId: hostWindow.id,
    window: overlayWindow,
  };
  operatorUnlockOverlayControllers.set(hostWindow.id, controller);
  hostWindow.on("move", reposition);
  hostWindow.on("resize", reposition);
  hostWindow.once("closed", () => destroyOperatorUnlockOverlay(hostWindow.id));
  overlayWindow.once("closed", () => {
    if (operatorUnlockOverlayControllers.get(hostWindow.id)?.window.id === overlayWindow.id) {
      operatorUnlockOverlayControllers.delete(hostWindow.id);
      detachHostListeners();
    }
  });
  reposition();
  void overlayWindow.loadURL(
    `data:text/html;base64,${Buffer.from(buildOperatorUnlockOverlayHtml(), "utf8").toString(
      "base64"
    )}`
  );
  overlayWindow.once("ready-to-show", () => {
    overlayWindow.show();
    overlayWindow.focus();
  });
}

function completeOperatorUnlockOverlayRequest(
  requestId: string,
  result: OperatorUnlockOverlayResult
) {
  const request = pendingOperatorUnlockOverlayRequests.get(requestId);
  if (!request) {
    return null;
  }
  pendingOperatorUnlockOverlayRequests.delete(requestId);
  clearTimeout(request.timeout);
  request.resolve(result);
  return request;
}

function readOperatorUnlockOverlayAttemptPassword(value: unknown) {
  return readPayloadString(value, "password") ?? "";
}

function getEmbeddedBrowserWindowForSender(sender: Electron.WebContents) {
  const senderWindow = BrowserWindow.fromWebContents(sender);
  if (!senderWindow || senderWindow.isDestroyed()) {
    throw new Error("Embedded browser host window is unavailable.");
  }
  return senderWindow;
}

function attachEmbeddedBrowserEvents(
  browserWindow: BrowserWindow,
  controller: EmbeddedBrowserController
) {
  const view = controller.view;
  const webContents = view.webContents;
  webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isChatGptAuthRequiredUrl(nextUrl)) {
      notifyEmbeddedBrowserAuthRequired(browserWindow, controller, "window-open-auth-url", nextUrl);
      return { action: "deny" };
    }
    if (isEmbeddableBrowserChromeUrl(nextUrl)) {
      void webContents.loadURL(nextUrl);
    } else {
      void shell.openExternal(nextUrl);
    }
    return { action: "deny" };
  });
  webContents.on("will-navigate", (event, nextUrl) => {
    if (isChatGptAuthRequiredUrl(nextUrl)) {
      event.preventDefault();
      notifyEmbeddedBrowserAuthRequired(
        browserWindow,
        controller,
        "will-navigate-auth-url",
        nextUrl
      );
      return;
    }
    if (!isEmbeddableBrowserChromeUrl(nextUrl)) {
      event.preventDefault();
      void shell.openExternal(nextUrl);
    }
  });
  webContents.on("did-start-navigation", (_event, nextUrl, isInPlace, isMainFrame) => {
    if (!isInPlace && isMainFrame && isChatGptAuthRequiredUrl(nextUrl)) {
      notifyEmbeddedBrowserAuthRequired(
        browserWindow,
        controller,
        "did-start-navigation-auth-url",
        nextUrl
      );
    }
  });
  webContents.on("dom-ready", () => {
    injectEmbeddedBrowserAccountNotice(view);
    probeEmbeddedBrowserAuthRequired(browserWindow, controller, "dom-ready");
  });
  webContents.on("did-finish-load", () => {
    injectEmbeddedBrowserAccountNotice(view);
    probeEmbeddedBrowserAuthRequired(browserWindow, controller, "did-finish-load");
  });
  webContents.on("did-navigate", (_event, nextUrl) => {
    injectEmbeddedBrowserAccountNotice(view);
    if (isChatGptAuthRequiredUrl(nextUrl)) {
      notifyEmbeddedBrowserAuthRequired(
        browserWindow,
        controller,
        "did-navigate-auth-url",
        nextUrl
      );
      return;
    }
    probeEmbeddedBrowserAuthRequired(browserWindow, controller, "did-navigate");
  });
  webContents.on("did-navigate-in-page", (_event, nextUrl) => {
    injectEmbeddedBrowserAccountNotice(view);
    if (isChatGptAuthRequiredUrl(nextUrl)) {
      notifyEmbeddedBrowserAuthRequired(
        browserWindow,
        controller,
        "did-navigate-in-page-auth-url",
        nextUrl
      );
      return;
    }
    probeEmbeddedBrowserAuthRequired(browserWindow, controller, "did-navigate-in-page");
  });
}

function ensureEmbeddedBrowserController(browserWindow: BrowserWindow, targetUrl: string) {
  const existing = embeddedBrowserControllers.get(browserWindow.id);
  if (existing && !existing.view.webContents.isDestroyed()) {
    return existing;
  }
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      session: session.defaultSession,
    },
  });
  const controller: EmbeddedBrowserController = {
    authRequired: false,
    targetUrl,
    view,
  };
  attachEmbeddedBrowserEvents(browserWindow, controller);
  view.setVisible(false);
  browserWindow.contentView.addChildView(view);
  embeddedBrowserControllers.set(browserWindow.id, controller);
  return controller;
}

function destroyEmbeddedBrowserController(browserWindowId: number) {
  const controller = embeddedBrowserControllers.get(browserWindowId);
  if (!controller) {
    return;
  }
  embeddedBrowserControllers.delete(browserWindowId);
  if (!controller.view.webContents.isDestroyed()) {
    controller.view.webContents.close({ waitForBeforeUnload: false });
  }
}

function createBrowserChromeController(
  browserWindow: BrowserWindow,
  initialTargetUrl: string,
  sessionScope: BrowserChromeSessionScope
): BrowserChromeWindowController {
  const tabs = new Map<string, BrowserChromeTabController>();
  let activeTabId = "";
  let sessionCleanupComplete = !sessionScope.cleanupOnClose;
  let sessionCleanupInFlight: Promise<void> | null = null;
  let closeAfterSessionCleanup = false;

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

  async function cleanupBrowserSessionBeforeClose() {
    if (sessionCleanupComplete || !sessionScope.cleanupOnClose) {
      return;
    }
    sessionCleanupInFlight ??= clearT3BrowserSessionStorage(sessionScope.browserSession).then(
      () => {
        sessionCleanupComplete = true;
      }
    );
    await sessionCleanupInFlight;
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
        session: sessionScope.browserSession,
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

  async function closeWindow(): Promise<BrowserChromeCommandResult> {
    try {
      await cleanupBrowserSessionBeforeClose();
    } catch {
      return commandFailure(
        "Unable to clear the production browser session. Close was blocked; retry returning to the production workspace after checking the browser window."
      );
    }
    const result = commandSuccess();
    setTimeout(() => {
      if (!browserWindow.isDestroyed()) {
        closeAfterSessionCleanup = true;
        browserWindow.close();
      }
    }, 0);
    return result;
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
  browserWindow.on("close", (event) => {
    if (!sessionScope.cleanupOnClose || sessionCleanupComplete || closeAfterSessionCleanup) {
      return;
    }
    event.preventDefault();
    void cleanupBrowserSessionBeforeClose()
      .then(() => {
        if (!browserWindow.isDestroyed()) {
          closeAfterSessionCleanup = true;
          browserWindow.close();
        }
      })
      .catch(() => undefined);
  });
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
    closeWindow,
    createTab,
    getBrowserCaptureMode: () => sessionScope.captureMode,
    getBrowserSession: () => sessionScope.browserSession,
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
  const sessionPlan = resolveT3BrowserSessionPlanFromLaunchUrl(url, randomUUID());
  const sessionScope: BrowserChromeSessionScope = {
    captureMode: sessionPlan.captureMode,
    cleanupOnClose: sessionPlan.cleanupOnClose,
    browserSession: sessionPlan.partition
      ? session.fromPartition(sessionPlan.partition)
      : session.defaultSession,
  };
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

  resetProductWindowZoom(browserWindow);

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
        createBrowserChromeController(browserWindow, initialTargetUrl, sessionScope);
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

function cookiePath(cookie: ElectronCookieSnapshot) {
  return cookie.path?.startsWith("/") ? cookie.path : "/";
}

function hasCookieHostPrefix(cookie: ElectronCookieSnapshot) {
  return cookie.name.startsWith("__Host-");
}

function hasCookieSecurePrefix(cookie: ElectronCookieSnapshot) {
  return cookie.name.startsWith("__Secure-");
}

function importedCookieSetDetails(
  cookie: ElectronCookieSnapshot,
  allowedOrigins: readonly string[]
): Electron.CookiesSetDetails | null {
  const matchedOrigin = cookieAllowedOrigin(cookie, allowedOrigins);
  const origin = matchedOrigin ?? cookieOrigin(cookie);
  if (!origin) {
    return null;
  }
  const requiresSecure =
    hasCookieHostPrefix(cookie) ||
    hasCookieSecurePrefix(cookie) ||
    cookie.sameSite === "no_restriction";
  if (requiresSecure && !origin.startsWith("https://")) {
    return null;
  }
  const path = hasCookieHostPrefix(cookie) ? "/" : cookiePath(cookie);
  const details: Electron.CookiesSetDetails = {
    expirationDate: cookie.session ? undefined : cookie.expirationDate,
    httpOnly: cookie.httpOnly,
    name: cookie.name,
    path,
    sameSite: cookie.sameSite === "unspecified" ? undefined : cookie.sameSite,
    secure: cookie.secure === true || requiresSecure,
    url: `${origin}${path}`,
    value: cookie.value,
  };
  if (!hasCookieHostPrefix(cookie) && cookie.hostOnly !== true && cookie.domain) {
    details.domain = cookie.domain;
  }
  return details;
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

function resolveSessionStoragePath(browserSession = session.defaultSession) {
  const storagePath = browserSession.getStoragePath();
  if (!storagePath) {
    throw new Error("Electron browser session storage path is unavailable.");
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

function isElectronCookieDatabaseFile(storageRoot: string, absolutePath: string) {
  const relativePath = relative(storageRoot, absolutePath).split(sep).join("/").toLowerCase();
  return (
    relativePath === "cookies" ||
    relativePath === "cookies-journal" ||
    relativePath === "network/cookies" ||
    relativePath === "network/cookies-journal"
  );
}

function isChromiumRuntimeLockFile(storageRoot: string, absolutePath: string) {
  const relativePath = relative(storageRoot, absolutePath).split(sep).join("/");
  return relativePath.split("/").at(-1)?.toLowerCase() === "lock";
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
  if (
    isElectronCookieDatabaseFile(storageRoot, absolutePath) ||
    isChromiumRuntimeLockFile(storageRoot, absolutePath)
  ) {
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

function readPortableImportSecret(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length >= 8 ? trimmed : null;
}

function normalizeBrowserStaticDataExportInput(
  value: unknown
): ElectronBrowserStaticDataExportInput {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const importSecret = readPortableImportSecret(
    (record as { importSecret?: unknown }).importSecret
  );
  if (!importSecret) {
    throw new Error("Exporting portable browser account data requires an import code.");
  }
  return {
    allowedOrigins: normalizeT3BrowserAllowedOrigins(
      (record as { allowedOrigins?: unknown }).allowedOrigins
    ),
    importSecret,
  };
}

function normalizeBrowserStaticDataImportInput(
  value: unknown
): ElectronBrowserStaticDataImportInput {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    importSecret:
      readPortableImportSecret((record as { importSecret?: unknown }).importSecret) ?? undefined,
  };
}

function allowedOriginSet(allowedOrigins: readonly string[]) {
  return new Set(normalizeT3BrowserAllowedOrigins(allowedOrigins));
}

function cookieAllowedOrigin(cookie: ElectronCookieSnapshot, allowedOrigins: readonly string[]) {
  const origin = cookieOrigin(cookie);
  if (!origin) {
    return null;
  }
  const allowed = allowedOriginSet(allowedOrigins);
  if (allowed.has(origin)) {
    return origin;
  }
  const cookieHost = new URL(origin).hostname.toLowerCase();
  if (!cookieHost.includes(".")) {
    return null;
  }
  for (const allowedOrigin of allowed) {
    const allowedHost = new URL(allowedOrigin).hostname.toLowerCase();
    if (allowedHost === cookieHost || allowedHost.endsWith(`.${cookieHost}`)) {
      return allowedOrigin;
    }
  }
  return null;
}

function cookieMatchesAllowedOrigins(
  cookie: ElectronCookieSnapshot,
  allowedOrigins: readonly string[]
) {
  return cookieAllowedOrigin(cookie, allowedOrigins) !== null;
}

function isChatGptAuthenticationCookie(cookie: ElectronCookieSnapshot) {
  const name = cookie.name.toLowerCase();
  return (
    name === "oai-sc" ||
    name === "oai-session" ||
    name.includes("session-token") ||
    name.includes("access-token") ||
    name.includes("refresh-token") ||
    (name.includes("session") && !name.includes("callback"))
  );
}

function buildChatGptLoginStatePreflightResult(input: {
  allowedOrigins: readonly string[];
  cookies: readonly ElectronCookieSnapshot[];
  storageFileCount?: number;
}): ElectronBrowserLoginStatePreflightResult {
  const matchedOrigins = new Set(
    input.cookies
      .map((cookie) => cookieAllowedOrigin(cookie, input.allowedOrigins))
      .filter((origin): origin is string => origin !== null)
  );
  const storageFileCount = input.storageFileCount ?? 0;
  const authenticationCookieCount = input.cookies.filter(isChatGptAuthenticationCookie).length;
  const status = authenticationCookieCount > 0 ? "loggedIn" : "notLoggedIn";
  return {
    allowedOrigins: normalizeT3BrowserAllowedOrigins(input.allowedOrigins),
    cookieCount: input.cookies.length,
    originCount: matchedOrigins.size,
    provider: "chatgpt",
    status,
    storageFileCount,
    summary:
      status === "loggedIn"
        ? `ChatGPT login preflight found ${authenticationCookieCount} session cookies and ${input.cookies.length} allowlisted cookies across ${matchedOrigins.size} origins.`
        : input.cookies.length > 0
          ? `ChatGPT login preflight found ${input.cookies.length} allowlisted site cookies, but no ChatGPT session cookie. Open ChatGPT in the built-in browser and sign in before export.`
          : "ChatGPT login preflight did not find allowlisted cookies. Open ChatGPT in the built-in browser and sign in before export.",
  };
}

function storageFileMatchesAllowedOrigins(
  file: ElectronBrowserStateFileSnapshot,
  allowedOrigins: readonly string[]
) {
  const normalizedPath = file.path.toLowerCase();
  return normalizeT3BrowserAllowedOrigins(allowedOrigins).some((origin) => {
    const hostname = new URL(origin).hostname.toLowerCase();
    return normalizedPath.includes(hostname);
  });
}

async function exportBrowserStorageFilesForOrigins(
  storageRoot: string,
  allowedOrigins: readonly string[]
) {
  return (await exportBrowserStorageFiles(storageRoot)).filter((file) =>
    storageFileMatchesAllowedOrigins(file, allowedOrigins)
  );
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

function encryptPortableBrowserSessionPayload(input: {
  allowedOrigins: readonly string[];
  importSecret: string;
  payload: ElectronBrowserSessionStatePayload;
}) {
  const portableContract = buildT3BrowserPortableLoginStateContract({
    allowedOrigins: input.allowedOrigins,
  });
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(input.importSecret, salt, portableContract.kdfIterations, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(portableContract.schemaVersion, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(input.payload), "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedPayloadBase64: encrypted.toString("base64"),
    portableContract,
    portableCrypto: {
      authTagBase64: cipher.getAuthTag().toString("base64"),
      ivBase64: iv.toString("base64"),
      saltBase64: salt.toString("base64"),
    },
  };
}

function decryptPortableBrowserSessionPayload(
  bundle: ElectronEncryptedLoginStateBundle,
  input: ElectronBrowserStaticDataImportInput
): Partial<ElectronBrowserSessionStatePayload> {
  if (!bundle.portableContract || !bundle.portableCrypto) {
    throw new Error("Portable browser account data file is missing crypto metadata.");
  }
  const importSecret = readPortableImportSecret(input.importSecret);
  if (!importSecret) {
    throw new Error("Import code is required to restore portable browser account data.");
  }
  try {
    const key = pbkdf2Sync(
      importSecret,
      Buffer.from(bundle.portableCrypto.saltBase64, "base64"),
      bundle.portableContract.kdfIterations,
      32,
      "sha256"
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(bundle.portableCrypto.ivBase64, "base64")
    );
    decipher.setAAD(Buffer.from(bundle.portableContract.schemaVersion, "utf8"));
    decipher.setAuthTag(Buffer.from(bundle.portableCrypto.authTagBase64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(bundle.encryptedPayloadBase64, "base64")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as Partial<ElectronBrowserSessionStatePayload>;
  } catch {
    throw new Error("Portable browser account data could not be decrypted or verified.");
  }
}

async function restoreBrowserStorageFiles(
  storageRoot: string,
  files: readonly ElectronBrowserStateFileSnapshot[],
  options: { clearExisting?: boolean } = {}
) {
  const clearExisting = options.clearExisting ?? true;
  const stagedFiles = files
    .map((file) => {
      const absolutePath = safeRelativeStoragePath(storageRoot, file.path);
      return absolutePath ? { absolutePath, file } : null;
    })
    .filter(
      (entry): entry is { absolutePath: string; file: ElectronBrowserStateFileSnapshot } =>
        entry !== null
    );
  if (clearExisting) {
    await clearBrowserStorageEntries(storageRoot);
  }
  let restoredFiles = 0;
  let restoredBytes = 0;
  for (const { absolutePath, file } of stagedFiles) {
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
    (record.encryption !== T3_BROWSER_SAFE_STORAGE_ENCRYPTION &&
      record.encryption !== T3_BROWSER_PORTABLE_ENCRYPTION) ||
    (record.payloadFormat !== "electron-session-cookies/v1" &&
      record.payloadFormat !== "electron-session-state/v2")
  ) {
    throw new Error("Encrypted browser login-state bundle is unsupported.");
  }
  if (
    record.encryption === T3_BROWSER_PORTABLE_ENCRYPTION &&
    (!record.portableContract || !record.portableCrypto)
  ) {
    throw new Error("Portable browser login-state bundle is missing crypto metadata.");
  }
  return {
    cookieCount: typeof record.cookieCount === "number" ? record.cookieCount : 0,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    encryptedPayloadBase64: record.encryptedPayloadBase64,
    encryption: record.encryption,
    id: typeof record.id === "string" ? record.id : randomUUID(),
    originCount: typeof record.originCount === "number" ? record.originCount : 0,
    payloadFormat: record.payloadFormat,
    portableContract: record.portableContract,
    portableCrypto: record.portableCrypto,
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
    hostOnly: record.hostOnly === true,
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
  ipcMain.handle(BROWSER_LOGIN_STATE_PREFLIGHT_CHANNEL, async (event, input: unknown) => {
    const sessionScope = resolveBrowserStaticDataSessionScope(event.sender, input);
    const allowedOrigins = normalizeT3BrowserAllowedOrigins(
      input && typeof input === "object" && !Array.isArray(input)
        ? (input as { allowedOrigins?: unknown }).allowedOrigins
        : undefined
    );
    await sessionScope.browserSession.flushStorageData();
    const cookies = (await sessionScope.browserSession.cookies.get({})).filter((cookie) =>
      cookieMatchesAllowedOrigins(cookie, allowedOrigins)
    );
    return buildChatGptLoginStatePreflightResult({
      allowedOrigins,
      cookies,
    });
  });

  ipcMain.handle(BROWSER_LOGIN_STATE_EXPORT_CHANNEL, async (event, input: unknown) => {
    const sessionScope = resolveBrowserStaticDataSessionScope(event.sender, input);
    const exportInput = normalizeBrowserStaticDataExportInput(input);
    await sessionScope.browserSession.flushStorageData();
    const cookies = (await sessionScope.browserSession.cookies.get({})).filter((cookie) =>
      cookieMatchesAllowedOrigins(cookie, exportInput.allowedOrigins)
    );
    const preflight = buildChatGptLoginStatePreflightResult({
      allowedOrigins: exportInput.allowedOrigins,
      cookies,
    });
    if (preflight.status !== "loggedIn") {
      throw new Error(preflight.summary);
    }
    await requireAdministratorAuthorizationForBrowserDataExport();
    const storageRoot = resolveSessionStoragePath(sessionScope.browserSession);
    const storageFiles = await exportBrowserStorageFilesForOrigins(
      storageRoot,
      exportInput.allowedOrigins
    );
    const stateByteCount = storageFiles.reduce((total, file) => total + file.size, 0);
    const payload: ElectronBrowserSessionStatePayload = {
      allowedOrigins: exportInput.allowedOrigins,
      cookies: cookies.map((cookie) => ({
        domain: cookie.domain,
        expirationDate: cookie.expirationDate,
        hostOnly: cookie.hostOnly,
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
      storageRoot: sessionScope.storageRoot,
    };
    const origins = new Set(
      payload.cookies
        .map((cookie) => cookieAllowedOrigin(cookie, exportInput.allowedOrigins))
        .filter((origin): origin is string => origin !== null)
    );
    const encryptedPayload = encryptPortableBrowserSessionPayload({
      allowedOrigins: exportInput.allowedOrigins,
      importSecret: exportInput.importSecret,
      payload,
    });
    return {
      cookieCount: payload.cookies.length,
      createdAt: payload.exportedAt,
      encryptedPayloadBase64: encryptedPayload.encryptedPayloadBase64,
      encryption: T3_BROWSER_PORTABLE_ENCRYPTION,
      id: `portable-chatgpt-login-state:${randomUUID()}`,
      originCount: origins.size,
      payloadFormat: "electron-session-state/v2",
      portableContract: encryptedPayload.portableContract,
      portableCrypto: encryptedPayload.portableCrypto,
      stateByteCount,
      stateFileCount: storageFiles.length,
      summary: `Encrypted ${payload.cookies.length} ChatGPT cookies and ${storageFiles.length} allowlisted browser storage files across ${origins.size} origins for portable restore.`,
    } satisfies ElectronEncryptedLoginStateBundle;
  });

  ipcMain.handle(
    BROWSER_LOGIN_STATE_IMPORT_CHANNEL,
    async (event, bundle: unknown, input: unknown) => {
      const sessionScope = resolveBrowserStaticDataSessionScope(event.sender, input);
      const normalizedBundle = normalizeImportedLoginStateBundle(bundle);
      const importInput = normalizeBrowserStaticDataImportInput(input);
      let parsed: Partial<ElectronCookieLoginStatePayload | ElectronBrowserSessionStatePayload>;
      if (normalizedBundle.encryption === T3_BROWSER_PORTABLE_ENCRYPTION) {
        parsed = decryptPortableBrowserSessionPayload(normalizedBundle, importInput);
      } else {
        assertSafeStorageAvailable();
        const decrypted = safeStorage.decryptString(
          Buffer.from(normalizedBundle.encryptedPayloadBase64, "base64")
        );
        parsed = JSON.parse(decrypted) as Partial<
          ElectronCookieLoginStatePayload | ElectronBrowserSessionStatePayload
        >;
      }
      if (
        (parsed.payloadFormat !== "electron-session-cookies/v1" &&
          parsed.payloadFormat !== "electron-session-state/v2") ||
        !Array.isArray(parsed.cookies)
      ) {
        throw new Error("Encrypted browser login-state payload is invalid.");
      }
      const allowedOrigins = normalizeT3BrowserAllowedOrigins(parsed.allowedOrigins);
      let restoredFiles = 0;
      let restoredBytes = 0;
      if (parsed.payloadFormat === "electron-session-state/v2") {
        const storageFiles = Array.isArray(parsed.storageFiles)
          ? parsed.storageFiles
              .map(normalizeImportedStorageFile)
              .filter(
                (file): file is ElectronBrowserStateFileSnapshot =>
                  file !== null && storageFileMatchesAllowedOrigins(file, allowedOrigins)
              )
          : [];
        if (storageFiles.length > 0) {
          const restoredState = await restoreBrowserStorageFiles(
            resolveSessionStoragePath(sessionScope.browserSession),
            storageFiles,
            { clearExisting: normalizedBundle.encryption !== T3_BROWSER_PORTABLE_ENCRYPTION }
          );
          restoredFiles = restoredState.restoredFiles;
          restoredBytes = restoredState.restoredBytes;
        }
      }
      const cookies = parsed.cookies
        .map(normalizeImportedCookie)
        .filter(
          (cookie): cookie is ElectronCookieSnapshot =>
            cookie !== null && cookieMatchesAllowedOrigins(cookie, allowedOrigins)
        );
      const authenticationCookieCount = cookies.filter(isChatGptAuthenticationCookie).length;
      if (authenticationCookieCount === 0 && restoredFiles === 0) {
        throw new Error("Portable browser account data did not contain a ChatGPT session cookie.");
      }
      let importedCookies = 0;
      const origins = new Set<string>();
      for (const cookie of cookies) {
        const details = importedCookieSetDetails(cookie, allowedOrigins);
        if (!details) {
          continue;
        }
        origins.add(cookieAllowedOrigin(cookie, allowedOrigins) ?? details.url);
        await sessionScope.browserSession.cookies.set(details);
        importedCookies += 1;
      }
      await sessionScope.browserSession.flushStorageData();
      return {
        importedCookies,
        originCount: origins.size,
        restoredBytes,
        restoredFiles,
        success: importedCookies > 0 || restoredFiles > 0,
        summary:
          restoredFiles > 0
            ? `Restored ${importedCookies} ChatGPT cookies and ${restoredFiles} allowlisted browser storage files across ${origins.size} origins.`
            : `Restored ${importedCookies} ChatGPT cookies across ${origins.size} origins.`,
      } satisfies ElectronBrowserLoginStateImportResult;
    }
  );

  ipcMain.handle(BROWSER_SITE_DATA_EXPORT_TO_CHROME_CHANNEL, async (event, input: unknown) => {
    const sessionScope = resolveBrowserStaticDataSessionScope(event.sender, input);
    await requireAdministratorAuthorizationForBrowserDataExport();
    const targetUrl =
      input && typeof input === "object" && !Array.isArray(input)
        ? normalizeChromeExportTargetUrl((input as { targetUrl?: unknown }).targetUrl)
        : normalizeChromeExportTargetUrl(null);
    await sessionScope.browserSession.flushStorageData();
    const storageRoot = resolveSessionStoragePath(sessionScope.browserSession);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function debugHashString(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function debugStringMeta(value: string) {
  return {
    length: value.length,
    sha256_16: debugHashString(value),
  };
}

function sanitizeDebugValue(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[depth-limit]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 512 ? `${value.slice(0, 512)}...[truncated:${value.length}]` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeDebugValue(item, depth + 1));
  }
  if (!isRecord(value)) {
    return String(value);
  }
  const redactedKeys = new Set([
    "activationCode",
    "authToken",
    "Authorization",
    "browserFileUnlockCode",
    "download_token",
    "downloadToken",
    "payload_base64",
    "redemption_code",
    "serialized",
    "token",
    "value",
  ]);
  const next: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (redactedKeys.has(key)) {
      next[key] =
        typeof rawValue === "string"
          ? { redacted: true, ...debugStringMeta(rawValue) }
          : "[redacted]";
      continue;
    }
    next[key] = sanitizeDebugValue(rawValue, depth + 1);
  }
  return next;
}

function debugError(error: unknown) {
  return error instanceof Error
    ? {
        message: error.message,
        name: error.name,
        stack: error.stack?.split("\n").slice(0, 8).join("\n") ?? null,
      }
    : { message: String(error), name: typeof error };
}

async function writeOpenHugeConsumerDebugLog(event: string, payload: Record<string, unknown> = {}) {
  try {
    const logDir = join(app.getPath("userData"), "logs");
    await mkdir(logDir, { recursive: true });
    await appendFile(
      join(logDir, OPENHUGE_CONSUMER_DEBUG_LOG_FILE),
      `${JSON.stringify({
        event,
        payload: sanitizeDebugValue(payload),
        pid: process.pid,
        ts: new Date().toISOString(),
      })}\n`,
      "utf8"
    );
  } catch {
    // Debug logging must never break the customer delivery path.
  }
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readEnvString(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

async function readJsonConfigFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

async function readOpenHugeDeliveryConfigFile() {
  const candidates = [
    join(app.getPath("userData"), OPENHUGE_DELIVERY_CONFIG_FILE),
    join(process.cwd(), OPENHUGE_DELIVERY_CONFIG_FILE),
    join(dirname(process.execPath), OPENHUGE_DELIVERY_CONFIG_FILE),
  ];
  for (const candidate of candidates) {
    const config = await readJsonConfigFile(candidate);
    if (isRecord(config)) {
      return config;
    }
  }
  return null;
}

function normalizeOpenHugeDeliveryConfig(
  fileConfig: Record<string, unknown> | null
): OpenHugeDeliveryDesktopConfig | null {
  const baseUrl =
    readEnvString("OPENHUGE_CONTROL_PLANE_BASE_URL", "VITE_OPENHUGE_CONTROL_PLANE_BASE_URL") ??
    readString(fileConfig?.baseUrl) ??
    readString(fileConfig?.controlPlaneBaseUrl);
  const tenantId =
    readEnvString("OPENHUGE_TENANT_ID", "VITE_OPENHUGE_TENANT_ID") ??
    readString(fileConfig?.tenantId);
  const projectId =
    readEnvString("OPENHUGE_PROJECT_ID", "VITE_OPENHUGE_PROJECT_ID") ??
    readString(fileConfig?.projectId);
  const authToken =
    readEnvString("OPENHUGE_CONTROL_PLANE_TOKEN", "VITE_OPENHUGE_CONTROL_PLANE_TOKEN") ??
    readString(fileConfig?.authToken) ??
    readString(fileConfig?.token);
  if (!baseUrl || !tenantId || !projectId || !authToken) {
    return null;
  }
  return {
    authToken,
    baseUrl,
    projectId,
    serviceDays:
      Number.parseInt(readEnvString("OPENHUGE_DELIVERY_SERVICE_DAYS") ?? "", 10) ||
      readPositiveInteger(fileConfig?.serviceDays) ||
      OPENHUGE_DEFAULT_SERVICE_DAYS,
    serviceKind:
      readEnvString("OPENHUGE_DELIVERY_SERVICE_KIND") ??
      readString(fileConfig?.serviceKind) ??
      OPENHUGE_DEFAULT_SERVICE_KIND,
    tenantId,
  };
}

async function resolveOpenHugeDeliveryDesktopConfig() {
  const config = normalizeOpenHugeDeliveryConfig(await readOpenHugeDeliveryConfigFile());
  if (!config) {
    throw new Error(
      `OpenHuge delivery config is missing. Configure ${OPENHUGE_DELIVERY_CONFIG_FILE} under HugeCode userData or set OPENHUGE_CONTROL_PLANE_* environment variables.`
    );
  }
  return config;
}

function openHugeDeliveryUrl(config: OpenHugeDeliveryDesktopConfig, path: string) {
  return `${config.baseUrl.replace(/\/+$/u, "")}${path}`;
}

async function readOpenHugeResponse(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    let message = `OpenHuge request failed with HTTP ${response.status}.`;
    try {
      const parsed = JSON.parse(text) as { message?: unknown; error?: { message?: unknown } };
      message =
        readString(parsed.message) ?? readString(parsed.error?.message) ?? text.trim() ?? message;
    } catch {
      message = text.trim() || message;
    }
    throw new Error(message);
  }
  return text.trim() ? (JSON.parse(text) as unknown) : {};
}

async function openHugeDeliveryJsonRequest(
  config: OpenHugeDeliveryDesktopConfig,
  path: string,
  init: { body?: unknown; method: "GET" | "POST" }
) {
  const startedAt = Date.now();
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.http.json.start", {
    body: init.body,
    method: init.method,
    path,
  });
  const response = await fetch(openHugeDeliveryUrl(config, path), {
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.authToken}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    method: init.method,
  });
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.http.json.response", {
    durationMs: Date.now() - startedAt,
    method: init.method,
    ok: response.ok,
    path,
    status: response.status,
  });
  return readOpenHugeResponse(response);
}

async function openHugeDeliveryBearerRequest(
  config: OpenHugeDeliveryDesktopConfig,
  path: string,
  bearerToken: string
) {
  const startedAt = Date.now();
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.http.artifact.start", {
    bearerToken: debugStringMeta(bearerToken),
    method: "GET",
    path,
  });
  const response = await fetch(openHugeDeliveryUrl(config, path), {
    headers: {
      Accept: "application/octet-stream, application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    method: "GET",
  });
  const text = await response.text();
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.http.artifact.response", {
    artifactText: debugStringMeta(text),
    durationMs: Date.now() - startedAt,
    fileHash: response.headers.get("x-openhuge-artifact-sha256"),
    ok: response.ok,
    path,
    status: response.status,
  });
  if (!response.ok) {
    throw new Error(
      text.trim() || `OpenHuge artifact request failed with HTTP ${response.status}.`
    );
  }
  return {
    fileHash: response.headers.get("x-openhuge-artifact-sha256"),
    text,
  };
}

function readUploadPayload(payload: unknown) {
  const record = isRecord(payload) ? payload : {};
  const artifact = isRecord(record.artifact) ? record.artifact : {};
  const witness = isRecord(record.witness) ? record.witness : {};
  const deliveryId = readString(record.deliveryId);
  const fileName = readString(artifact.fileName);
  const serialized = readString(artifact.serialized);
  const fileHash = readString(witness.fileHash);
  if (!deliveryId || !fileName || !serialized || !fileHash) {
    throw new Error("OpenHuge delivery artifact upload payload is incomplete.");
  }
  return { deliveryId, fileHash, fileName, serialized };
}

function readDeliveryIdPayload(payload: unknown) {
  const record = isRecord(payload) ? payload : {};
  const deliveryId = readString(record.deliveryId);
  if (!deliveryId) {
    throw new Error("OpenHuge delivery id is required.");
  }
  return deliveryId;
}

function readBatchId(response: unknown) {
  const data = isRecord(response) && isRecord(response.data) ? response.data : response;
  return isRecord(data) ? readString(data.batch_id) : null;
}

function readActivationId(response: unknown) {
  const data = isRecord(response) && isRecord(response.data) ? response.data : response;
  return isRecord(data) ? readString(data.activation_id) : null;
}

function readDownloadToken(response: unknown) {
  const data = isRecord(response) && isRecord(response.data) ? response.data : response;
  return isRecord(data)
    ? (readString(data.download_token) ??
        readString(response && isRecord(response) ? response.download_token : null))
    : null;
}

function uploadItemProjection(deliveryId: string, item: Record<string, unknown>, fileHash: string) {
  const status = readString(item.status);
  if (status === "accepted" || status === "duplicate") {
    return {
      deliveryId,
      fileHash,
      status: "exported",
      summary: "OpenHuge accepted the encrypted browser account artifact.",
      updatedAt: readString(item.updated_at),
    };
  }
  if (status === "failed" || status === "rejected") {
    return {
      deliveryId,
      fileHash,
      status: "failed",
      summary: readString(item.error_message) ?? "OpenHuge rejected the encrypted artifact.",
      updatedAt: readString(item.updated_at),
    };
  }
  return {
    deliveryId,
    fileHash,
    status: "prepared",
    summary: "OpenHuge queued the encrypted artifact upload.",
    updatedAt: readString(item.updated_at),
  };
}

async function openHugeDeliveryUploadArtifact(
  config: OpenHugeDeliveryDesktopConfig,
  payload: unknown
) {
  const upload = readUploadPayload(payload);
  const carrierValidUntil = new Date(Date.now() + config.serviceDays * DAY_IN_MS).toISOString();
  const batch = await openHugeDeliveryJsonRequest(config, "/internal/delivery-uploads", {
    body: {
      idempotency_key: `${upload.deliveryId}:${upload.fileHash}`,
      items: [
        {
          artifact_kind: OPENHUGE_ARTIFACT_KIND,
          carrier_valid_until: carrierValidUntil,
          content_type: OPENHUGE_ARTIFACT_CONTENT_TYPE,
          delivery_id: upload.deliveryId,
          file_name: upload.fileName,
          payload_base64: Buffer.from(upload.serialized, "utf8").toString("base64"),
          row_index: 1,
        },
      ],
      project_id: config.projectId,
      provider: OPENHUGE_DEFAULT_PROVIDER,
      source_file_name: `${upload.deliveryId}.jsonl`,
      tenant_id: config.tenantId,
    },
    method: "POST",
  });
  const batchId = readBatchId(batch);
  if (!batchId) {
    throw new Error("OpenHuge did not return a delivery upload batch id.");
  }
  await openHugeDeliveryJsonRequest(
    config,
    `/internal/delivery-uploads/${encodeURIComponent(batchId)}/process`,
    { method: "POST" }
  );
  const items = await openHugeDeliveryJsonRequest(
    config,
    `/internal/delivery-uploads/${encodeURIComponent(batchId)}/items`,
    { method: "GET" }
  );
  const item = (isRecord(items) && Array.isArray(items.data) ? items.data : [])
    .filter(isRecord)
    .find((candidate) => readString(candidate.delivery_id) === upload.deliveryId);
  if (!item) {
    throw new Error("OpenHuge processed the batch, but no upload item was returned.");
  }
  return uploadItemProjection(upload.deliveryId, item, upload.fileHash);
}

async function openHugeDeliveryRedeem(config: OpenHugeDeliveryDesktopConfig, payload: unknown) {
  const activationCode = isRecord(payload) ? readString(payload.activationCode) : null;
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.redeem.start", {
    activationCode: activationCode ? debugStringMeta(activationCode) : null,
  });
  if (!activationCode) {
    throw new Error("Redemption code is required.");
  }
  const activation = await openHugeDeliveryJsonRequest(config, "/v1/delivery-activations/redeem", {
    body: { redemption_code: activationCode },
    method: "POST",
  });
  const activationData: Record<string, unknown> =
    isRecord(activation) && isRecord(activation.data)
      ? activation.data
      : isRecord(activation)
        ? activation
        : {};
  const activationId = readActivationId(activation);
  if (!activationId) {
    throw new Error("OpenHuge activation response did not include activation_id.");
  }
  const grant = await openHugeDeliveryJsonRequest(config, "/v1/delivery-download-grants", {
    body: {
      activation_id: activationId,
      redemption_code: activationCode,
    },
    method: "POST",
  });
  const grantData: Record<string, unknown> =
    isRecord(grant) && isRecord(grant.data) ? grant.data : isRecord(grant) ? grant : {};
  const token = readDownloadToken(grant);
  if (!token) {
    throw new Error("OpenHuge did not return a download token.");
  }
  const download = await openHugeDeliveryBearerRequest(
    config,
    "/v1/delivery-downloads/artifact",
    token
  );
  const artifactRecord = isRecord(grantData.artifact)
    ? grantData.artifact
    : isRecord(activationData.artifact)
      ? activationData.artifact
      : null;
  const fileName = readString(artifactRecord?.file_name) ?? "hugecode-browser-data.hcbrowser";
  const fileHash = readString(download.fileHash) ?? readString(artifactRecord?.sha256);
  const deliveryId = readString(activationData.delivery_id) ?? readString(grantData.delivery_id);
  const artifactId =
    readString(grantData.artifact_id) ??
    readString(activationData.artifact_id) ??
    readString(artifactRecord?.artifact_id);
  const entitlementId =
    readString(grantData.entitlement_id) ?? readString(activationData.entitlement_id);
  const entitlementEndsAt =
    readString(activationData.entitlement_ends_at) ?? readString(grantData.entitlement_ends_at);
  const effectiveUntil =
    readString(grantData.effective_until) ??
    readString(activationData.effective_until) ??
    readString(artifactRecord?.carrier_valid_until);
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.redeem.complete", {
    activationId,
    artifactId,
    artifactByteLength: Buffer.byteLength(download.text, "utf8"),
    deliveryId,
    effectiveUntil,
    entitlementEndsAt,
    entitlementId,
    fileHash,
    fileName,
  });
  return {
    artifact: {
      byteLength: Buffer.byteLength(download.text, "utf8"),
      fileHash,
      fileName,
      serialized: download.text,
    },
    projection: {
      activationCode,
      activationId,
      artifactId,
      browserFileUnlockCode: null,
      deliveryId,
      effectiveUntil,
      entitlementEndsAt,
      entitlementId,
      fileHash,
      status: "redeemed",
      summary:
        "OpenHuge redeemed delivery, issued a download grant, and returned encrypted account data.",
      updatedAt: null,
    },
  };
}

async function openHugeDeliveryReadStatus(config: OpenHugeDeliveryDesktopConfig, payload: unknown) {
  const deliveryId = readDeliveryIdPayload(payload);
  await writeOpenHugeConsumerDebugLog("desktop.openHuge.readStatus.start", { deliveryId });
  return openHugeDeliveryJsonRequest(config, `/v1/deliveries/${encodeURIComponent(deliveryId)}`, {
    method: "GET",
  });
}

async function invokeOpenHugeDelivery(operation: OpenHugeDeliveryOperation, payload: unknown) {
  const config = await resolveOpenHugeDeliveryDesktopConfig();
  if (operation === "prepare") {
    const record = isRecord(payload) ? payload : {};
    return openHugeDeliveryJsonRequest(config, "/internal/deliveries/prepare", {
      body: {
        customer_label: "HugeCode browser handoff",
        project_id: config.projectId,
        provider: readString(record.provider) ?? OPENHUGE_DEFAULT_PROVIDER,
        service_days: config.serviceDays,
        service_kind: config.serviceKind,
        tenant_id: config.tenantId,
      },
      method: "POST",
    });
  }
  if (operation === "uploadArtifact") {
    return openHugeDeliveryUploadArtifact(config, payload);
  }
  if (operation === "redeem") {
    return openHugeDeliveryRedeem(config, payload);
  }
  if (operation === "readStatus" || operation === "submitExportWitness") {
    return openHugeDeliveryReadStatus(config, payload);
  }
  throw new Error(`OpenHuge delivery operation ${operation} is not available from desktop.`);
}

function registerOpenHugeDeliveryIpc() {
  ipcMain.handle(
    OPENHUGE_DELIVERY_INVOKE_CHANNEL,
    async (_event, operation: unknown, payload: unknown = {}) => {
      if (
        operation !== "prepare" &&
        operation !== "uploadArtifact" &&
        operation !== "redeem" &&
        operation !== "readStatus" &&
        operation !== "submitExportWitness"
      ) {
        throw new Error("OpenHuge delivery operation is invalid.");
      }
      const startedAt = Date.now();
      await writeOpenHugeConsumerDebugLog("desktop.openHuge.invoke.start", {
        operation,
        payload,
      });
      try {
        const result = await invokeOpenHugeDelivery(operation, payload);
        await writeOpenHugeConsumerDebugLog("desktop.openHuge.invoke.ok", {
          durationMs: Date.now() - startedAt,
          operation,
          result,
        });
        return result;
      } catch (error) {
        await writeOpenHugeConsumerDebugLog("desktop.openHuge.invoke.error", {
          durationMs: Date.now() - startedAt,
          error: debugError(error),
          operation,
          payload,
        });
        throw error;
      }
    }
  );
}

function registerOpenHugeConsumerDebugIpc() {
  ipcMain.handle(OPENHUGE_CONSUMER_DEBUG_CHANNEL, async (_event, payload: unknown = {}) => {
    const record = isRecord(payload) ? payload : {};
    await writeOpenHugeConsumerDebugLog(
      readString(record.event) ?? "renderer.unknown",
      isRecord(record.payload) ? record.payload : {}
    );
    return {
      logPath: join(app.getPath("userData"), "logs", OPENHUGE_CONSUMER_DEBUG_LOG_FILE),
      ok: true,
    };
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

  ipcMain.handle(BROWSER_CHROME_CLOSE_WINDOW_CHANNEL, (event) => {
    const controller = getBrowserChromeControllerForSender(event.sender);
    if (!controller) {
      return createBrowserChromeIpcErrorResult(controller, "Browser chrome is unavailable.");
    }
    return controller.closeWindow();
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

function registerEmbeddedBrowserIpc() {
  ipcMain.handle(EMBEDDED_BROWSER_SHOW_CHANNEL, (event, payload: unknown = {}) => {
    const browserWindow = getEmbeddedBrowserWindowForSender(event.sender);
    const bounds = readEmbeddedBrowserBounds(payload);
    if (!bounds) {
      throw new Error("Embedded browser bounds are required.");
    }
    const targetUrl = readEmbeddedBrowserTargetUrl(payload);
    const controller = ensureEmbeddedBrowserController(browserWindow, targetUrl);
    controller.authRequired = false;
    controller.view.setBounds(bounds);
    controller.view.setVisible(true);
    const currentUrl = controller.view.webContents.getURL();
    if (!currentUrl || controller.targetUrl !== targetUrl) {
      controller.targetUrl = targetUrl;
      void controller.view.webContents.loadURL(targetUrl);
    }
    return { ok: true };
  });

  ipcMain.handle(EMBEDDED_BROWSER_SET_BOUNDS_CHANNEL, (event, payload: unknown = {}) => {
    const browserWindow = getEmbeddedBrowserWindowForSender(event.sender);
    const controller = embeddedBrowserControllers.get(browserWindow.id);
    const bounds = readEmbeddedBrowserBounds(payload);
    if (!controller || !bounds) {
      return { ok: false };
    }
    controller.view.setBounds(bounds);
    return { ok: true };
  });

  ipcMain.handle(EMBEDDED_BROWSER_HIDE_CHANNEL, (event) => {
    const browserWindow = getEmbeddedBrowserWindowForSender(event.sender);
    const controller = embeddedBrowserControllers.get(browserWindow.id);
    if (controller) {
      controller.view.setVisible(false);
    }
    return { ok: true };
  });
}

function registerOperatorUnlockOverlayIpc() {
  ipcMain.handle(OPERATOR_UNLOCK_OVERLAY_SHOW_CHANNEL, (event) => {
    const hostWindow = getEmbeddedBrowserWindowForSender(event.sender);
    showOperatorUnlockOverlay(hostWindow);
    return { ok: true };
  });

  ipcMain.handle(OPERATOR_UNLOCK_OVERLAY_CLOSE_CHANNEL, (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow || senderWindow.isDestroyed()) {
      return { ok: false };
    }
    if (operatorUnlockOverlayControllers.has(senderWindow.id)) {
      destroyOperatorUnlockOverlay(senderWindow.id);
      return { ok: true };
    }
    const overlayController = findOperatorUnlockOverlayControllerByWindowId(senderWindow.id);
    if (overlayController) {
      destroyOperatorUnlockOverlay(overlayController.hostWindowId);
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle(OPERATOR_UNLOCK_OVERLAY_ATTEMPT_CHANNEL, async (event, payload: unknown = {}) => {
    const overlayWindow = BrowserWindow.fromWebContents(event.sender);
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      return { message: "生产端解锁窗口不可用。", ok: false };
    }
    const controller = findOperatorUnlockOverlayControllerByWindowId(overlayWindow.id);
    if (!controller) {
      return { message: "生产端解锁窗口未绑定主界面。", ok: false };
    }
    const hostWindow = BrowserWindow.fromId(controller.hostWindowId);
    if (!hostWindow || hostWindow.isDestroyed()) {
      return { message: "生产端主界面不可用。", ok: false };
    }
    const password = readOperatorUnlockOverlayAttemptPassword(payload);
    const requestId = randomUUID();
    return new Promise<OperatorUnlockOverlayResult>((resolve) => {
      const timeout = setTimeout(() => {
        pendingOperatorUnlockOverlayRequests.delete(requestId);
        resolve({ message: "生产端解锁响应超时，请重试。", ok: false });
      }, 10_000);
      pendingOperatorUnlockOverlayRequests.set(requestId, {
        hostWindowId: hostWindow.id,
        resolve,
        timeout,
      });
      hostWindow.webContents.send(OPERATOR_UNLOCK_OVERLAY_SUBMIT_CHANNEL, {
        password,
        requestId,
      });
    });
  });

  ipcMain.handle(OPERATOR_UNLOCK_OVERLAY_RESOLVE_CHANNEL, (_event, payload: unknown = {}) => {
    const requestId = readPayloadString(payload, "requestId");
    if (!requestId) {
      return { ok: false };
    }
    const ok = readPayloadBoolean(payload, "ok") === true;
    const message = readPayloadString(payload, "message");
    const request = completeOperatorUnlockOverlayRequest(requestId, { message, ok });
    if (ok && request) {
      destroyOperatorUnlockOverlay(request.hostWindowId);
    }
    return { ok: request !== null };
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

  resetProductWindowZoom(mainWindow);

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

  mainWindow.on("closed", () => {
    destroyEmbeddedBrowserController(mainWindow.id);
    destroyOperatorUnlockOverlay(mainWindow.id);
  });

  void mainWindow.loadURL(resolveRendererUrl());

  if (devServerUrl) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  return mainWindow;
}

app.setName("HugeCode");

void app.whenReady().then(() => {
  configureApplicationMenu();
  registerBrowserStaticDataIpc();
  registerOpenHugeConsumerDebugIpc();
  registerOpenHugeDeliveryIpc();
  registerRuntimeRpcIpc();
  registerBrowserChromeIpc();
  registerEmbeddedBrowserIpc();
  registerOperatorUnlockOverlayIpc();
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
