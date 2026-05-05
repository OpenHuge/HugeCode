import type { BrowserChromeSnapshot } from "../runtime/t3BrowserChromeBridge";

export const EMPTY_BROWSER_CHROME_SNAPSHOT: BrowserChromeSnapshot = {
  activeTabId: "new-tab",
  tabs: [
    {
      canGoBack: false,
      canGoForward: false,
      id: "new-tab",
      loading: false,
      securityState: "internal",
      title: "New Tab",
      url: "",
    },
  ],
};
