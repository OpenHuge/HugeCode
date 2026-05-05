import type {
  BrowserChromeCommandResult,
  BrowserChromeSnapshot,
  BrowserChromeTabState,
} from "../../electron/browserChromeState";

export type { BrowserChromeCommandResult, BrowserChromeSnapshot, BrowserChromeTabState };

export type BrowserChromeBridgeGlobal = {
  activateTab(input: { tabId: string }): Promise<BrowserChromeCommandResult>;
  closeTab(input: { tabId: string }): Promise<BrowserChromeCommandResult>;
  closeWindow(): Promise<BrowserChromeCommandResult>;
  createTab(input?: {
    activate?: boolean;
    url?: string | null;
  }): Promise<BrowserChromeCommandResult>;
  getSnapshot(): Promise<BrowserChromeSnapshot>;
  goBack(input?: { tabId?: string | null }): Promise<BrowserChromeCommandResult>;
  goForward(input?: { tabId?: string | null }): Promise<BrowserChromeCommandResult>;
  navigate(input: { tabId?: string | null; url: string }): Promise<BrowserChromeCommandResult>;
  reload(input?: { tabId?: string | null }): Promise<BrowserChromeCommandResult>;
  stop(input?: { tabId?: string | null }): Promise<BrowserChromeCommandResult>;
  subscribe(listener: (snapshot: BrowserChromeSnapshot) => void): () => void;
};

export function getT3BrowserChromeBridge() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.hugeCodeDesktopHost?.browserChrome ?? null;
}
