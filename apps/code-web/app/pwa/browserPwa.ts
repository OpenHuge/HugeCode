import { useEffect, useState } from "react";

export type PwaDisplayMode = "browser" | "minimal-ui" | "standalone" | "window-controls-overlay";
export type ManualInstallPlatform = "ios" | "safari-desktop" | null;

export const CODE_WEB_PWA_INSTALL_DISMISS_STORAGE_KEY = "hugecode.web.pwa-install-dismissed.v1";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform?: string;
};

export interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

declare global {
  interface WindowEventMap {
    appinstalled: Event;
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISPLAY_MODE_QUERIES = [
  ["window-controls-overlay", "(display-mode: window-controls-overlay)"],
  ["standalone", "(display-mode: standalone)"],
  ["minimal-ui", "(display-mode: minimal-ui)"],
] as const;
const WORKSPACE_PATHNAME = "/app";

function readNavigatorLike() {
  return typeof navigator === "undefined" ? null : navigator;
}

export function resolveServiceWorkerPath(appVersion = __APP_VERSION__) {
  const query = new URLSearchParams({ app: appVersion });
  return `/sw.js?${query.toString()}`;
}

export function detectPwaDisplayMode(): PwaDisplayMode {
  if (typeof window === "undefined") {
    return "browser";
  }

  for (const [mode, query] of DISPLAY_MODE_QUERIES) {
    if (window.matchMedia(query).matches) {
      return mode;
    }
  }

  const nav = readNavigatorLike() as (Navigator & { standalone?: boolean }) | null;
  if (nav?.standalone === true) {
    return "standalone";
  }

  return "browser";
}

export function isStandaloneLikeDisplayMode(displayMode: PwaDisplayMode): boolean {
  return displayMode === "standalone" || displayMode === "window-controls-overlay";
}

export function detectManualInstallPlatform(
  userAgent = readNavigatorLike()?.userAgent ?? ""
): ManualInstallPlatform {
  const ua = userAgent.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(ua);
  const isMac = /macintosh|mac os x/.test(ua);
  const isSafari =
    /safari/.test(ua) &&
    !/crios|chrome|android|fxios|firefox|edgios|edga|edg\//.test(ua) &&
    !/opr\//.test(ua);

  if (isAppleMobile && isSafari) {
    return "ios";
  }

  if (isMac && isSafari) {
    return "safari-desktop";
  }

  return null;
}

export function readNavigatorOnlineStatus(): boolean {
  const nav = readNavigatorLike();
  return typeof nav?.onLine === "boolean" ? nav.onLine : true;
}

export function subscribeToNavigatorOnlineStatus(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useNavigatorOnlineStatus() {
  const [online, setOnline] = useState(() => readNavigatorOnlineStatus());

  useEffect(() => {
    return subscribeToNavigatorOnlineStatus(() => {
      setOnline(readNavigatorOnlineStatus());
    });
  }, []);

  return online;
}

export function applyPwaDocumentState(
  state: {
    displayMode: PwaDisplayMode;
    online: boolean;
  },
  doc = typeof document === "undefined" ? null : document
) {
  if (!doc) {
    return;
  }

  doc.documentElement.dataset.pwaDisplayMode = state.displayMode;
  doc.documentElement.dataset.pwaInstalled = isStandaloneLikeDisplayMode(state.displayMode)
    ? "true"
    : "false";
  doc.documentElement.dataset.pwaOnline = state.online ? "true" : "false";
}

export function readDismissedInstallPrompt() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(CODE_WEB_PWA_INSTALL_DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDismissedInstallPrompt(dismissed: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!dismissed) {
      window.localStorage.removeItem(CODE_WEB_PWA_INSTALL_DISMISS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CODE_WEB_PWA_INSTALL_DISMISS_STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures; they should not block the active session.
  }
}

export function resolveLaunchNavigationTarget(options: {
  currentUrl: string;
  targetUrl: string | URL | null | undefined;
}) {
  const { currentUrl, targetUrl } = options;
  if (!targetUrl) {
    return null;
  }

  const current = new URL(currentUrl);
  const target = new URL(String(targetUrl), current);
  if (target.origin !== current.origin) {
    return null;
  }

  if (current.pathname === WORKSPACE_PATHNAME && target.pathname === WORKSPACE_PATHNAME) {
    return null;
  }

  if (
    current.pathname === target.pathname &&
    current.search === target.search &&
    current.hash === target.hash
  ) {
    return null;
  }

  return `${target.pathname}${target.search}${target.hash}`;
}
