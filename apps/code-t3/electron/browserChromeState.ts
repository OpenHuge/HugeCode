const GOOGLE_SEARCH_URL = "https://www.google.com/search";

export type BrowserChromeSecurityState = "insecure" | "internal" | "secure" | "unknown";

export type BrowserChromeTabState = {
  canGoBack: boolean;
  canGoForward: boolean;
  id: string;
  loading: boolean;
  securityState: BrowserChromeSecurityState;
  title: string;
  url: string;
};

export type BrowserChromeSnapshot = {
  activeTabId: string;
  tabs: BrowserChromeTabState[];
};

export type BrowserChromeCommandResult =
  | {
      ok: true;
      snapshot: BrowserChromeSnapshot;
    }
  | {
      errorMessage: string;
      ok: false;
      snapshot: BrowserChromeSnapshot;
    };

export function normalizeBrowserChromeNavigationInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//iu.test(trimmed)) {
    const parsed = new URL(trimmed);
    return parsed.toString();
  }
  if (shouldOpenAsGoogleSearch(trimmed)) {
    const searchUrl = new URL(GOOGLE_SEARCH_URL);
    searchUrl.searchParams.set("q", trimmed);
    return searchUrl.toString();
  }
  return new URL(`https://${trimmed}`).toString();
}

export function resolveBrowserChromeSecurityState(url: string): BrowserChromeSecurityState {
  if (!url.trim()) {
    return "internal";
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      return "secure";
    }
    if (parsed.protocol === "http:") {
      return "insecure";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function createBrowserChromeTabState(input: {
  canGoBack?: boolean;
  canGoForward?: boolean;
  id: string;
  loading?: boolean;
  title?: string;
  url?: string;
}): BrowserChromeTabState {
  const url = input.url ?? "";
  return {
    canGoBack: input.canGoBack ?? false,
    canGoForward: input.canGoForward ?? false,
    id: input.id,
    loading: input.loading ?? false,
    securityState: resolveBrowserChromeSecurityState(url),
    title: input.title?.trim() || fallbackBrowserChromeTitle(url),
    url,
  };
}

export function closeBrowserChromeTabState(
  snapshot: BrowserChromeSnapshot,
  tabId: string,
  replacementTab: BrowserChromeTabState
): BrowserChromeSnapshot {
  const existingIndex = snapshot.tabs.findIndex((tab) => tab.id === tabId);
  if (existingIndex === -1) {
    return snapshot;
  }
  const remainingTabs = snapshot.tabs.filter((tab) => tab.id !== tabId);
  if (remainingTabs.length === 0) {
    return {
      activeTabId: replacementTab.id,
      tabs: [replacementTab],
    };
  }
  if (snapshot.activeTabId !== tabId) {
    return {
      activeTabId: snapshot.activeTabId,
      tabs: remainingTabs,
    };
  }
  const nextActiveIndex = Math.min(existingIndex, remainingTabs.length - 1);
  return {
    activeTabId: remainingTabs[nextActiveIndex]?.id ?? remainingTabs[0].id,
    tabs: remainingTabs,
  };
}

export function fallbackBrowserChromeTitle(url: string) {
  if (!url.trim()) {
    return "New Tab";
  }
  try {
    return new URL(url).hostname || "New Tab";
  } catch {
    return "New Tab";
  }
}

function shouldOpenAsGoogleSearch(value: string) {
  if (/\s/u.test(value)) {
    return true;
  }
  if (value === "localhost" || value.includes(".") || value.includes(":")) {
    return false;
  }
  return true;
}
