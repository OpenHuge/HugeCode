import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type {
  BrowserChromeBridgeGlobal,
  BrowserChromeCommandResult,
  BrowserChromeSnapshot,
} from "../runtime/t3BrowserChromeBridge";
import {
  T3_BROWSER_CHATGPT_LOGIN_WITNESS_STORAGE_KEY,
  T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY,
} from "../runtime/t3BrowserLoginWitness";
import {
  BrowserLaunchPage,
  normalizeAddressInput,
  T3_LDXP_BROWSER_DRAFT_STORAGE_KEY,
} from "./BrowserLaunchPage";

const defaultProps = {
  initialAppId: null,
  initialAppKey: null,
  initialAppLabel: "ldxp.cn AI 充值",
  initialChatGptAssistant: false,
  initialContinuityMode: "remote-session-handoff",
  initialContinuityStatus: "ready",
  initialDeviceCount: "2",
  initialIsolationMode: null,
  initialLdxpAssistant: true,
  initialProfileId: "current-browser",
  initialProfileLabel: "Current browser profile",
  initialProvider: "custom",
  initialTargetUrl: "https://pay.ldxp.cn/shop/ku0",
};

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
  window.localStorage.clear();
  delete window.hugeCodeDesktopHost;
});

function renderBrowserLaunchPage(props: Partial<typeof defaultProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(<BrowserLaunchPage {...defaultProps} {...props} />);
  });
  mountedRoot = root;
  mountedContainer = container;
  return container;
}

async function renderBrowserLaunchPageAsync(props: Partial<typeof defaultProps> = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<BrowserLaunchPage {...defaultProps} {...props} />);
  });
  mountedRoot = root;
  mountedContainer = container;
  return container;
}

function installBrowserChromeBridge(initialSnapshot: BrowserChromeSnapshot) {
  let snapshot = initialSnapshot;
  let nextTabId = snapshot.tabs.length + 1;
  const listeners = new Set<(nextSnapshot: BrowserChromeSnapshot) => void>();
  const publish = () => {
    for (const listener of listeners) {
      listener(snapshot);
    }
  };
  const result = (): BrowserChromeCommandResult => ({ ok: true, snapshot });
  const bridge: BrowserChromeBridgeGlobal = {
    async activateTab({ tabId }) {
      snapshot = {
        ...snapshot,
        activeTabId: tabId,
      };
      publish();
      return result();
    },
    async closeTab({ tabId }) {
      const tabs = snapshot.tabs.filter((tab) => tab.id !== tabId);
      snapshot =
        tabs.length > 0
          ? {
              activeTabId: tabs.some((tab) => tab.id === snapshot.activeTabId)
                ? snapshot.activeTabId
                : tabs[0].id,
              tabs,
            }
          : {
              activeTabId: `tab-${nextTabId}`,
              tabs: [
                {
                  canGoBack: false,
                  canGoForward: false,
                  id: `tab-${nextTabId++}`,
                  loading: false,
                  securityState: "internal",
                  title: "New Tab",
                  url: "",
                },
              ],
            };
      publish();
      return result();
    },
    async createTab(input = {}) {
      const url = input.url ?? "";
      const tab = {
        canGoBack: false,
        canGoForward: false,
        id: `tab-${nextTabId++}`,
        loading: false,
        securityState: url.startsWith("https://") ? "secure" : "internal",
        title: url ? new URL(url).hostname : "New Tab",
        url,
      } satisfies BrowserChromeSnapshot["tabs"][number];
      snapshot = {
        activeTabId: input.activate === false ? snapshot.activeTabId : tab.id,
        tabs: [...snapshot.tabs, tab],
      };
      publish();
      return result();
    },
    async getSnapshot() {
      return snapshot;
    },
    async goBack() {
      snapshot = {
        ...snapshot,
        tabs: snapshot.tabs.map((tab) =>
          tab.id === snapshot.activeTabId ? { ...tab, canGoBack: false, canGoForward: true } : tab
        ),
      };
      publish();
      return result();
    },
    async goForward() {
      snapshot = {
        ...snapshot,
        tabs: snapshot.tabs.map((tab) =>
          tab.id === snapshot.activeTabId ? { ...tab, canGoBack: true, canGoForward: false } : tab
        ),
      };
      publish();
      return result();
    },
    async navigate({ tabId, url }) {
      const targetTabId = tabId ?? snapshot.activeTabId;
      snapshot = {
        activeTabId: targetTabId,
        tabs: snapshot.tabs.map((tab) =>
          tab.id === targetTabId
            ? {
                ...tab,
                canGoBack: true,
                loading: false,
                securityState: "secure",
                title: new URL(url).hostname,
                url,
              }
            : tab
        ),
      };
      publish();
      return result();
    },
    async reload() {
      return result();
    },
    async stop() {
      return result();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  window.hugeCodeDesktopHost = { browserChrome: bridge };
  return bridge;
}

describe("BrowserLaunchPage", () => {
  it("normalizes Chrome-style address input and searches plain keywords", () => {
    expect(normalizeAddressInput("chatgpt.com")).toBe("https://chatgpt.com/");
    expect(normalizeAddressInput("openai codex")).toBe(
      "https://www.google.com/search?q=openai+codex"
    );
    expect(normalizeAddressInput("chatgpt")).toBe("https://www.google.com/search?q=chatgpt");
  });

  it("renders the generic browser as a Chrome-style home page pointed at ChatGPT", () => {
    const container = renderBrowserLaunchPage({
      initialChatGptAssistant: false,
      initialLdxpAssistant: false,
      initialProvider: "chatgpt",
      initialTargetUrl: "https://chatgpt.com/",
    });

    expect(container.querySelector(".browser-product-shell-chrome")).not.toBeNull();
    expect(container.querySelector(".browser-product-sidebar")).toBeNull();
    expect(container.querySelector(".browser-product-google-logo")?.textContent).toBe("Google");
    expect(container.textContent).toContain("Gmail");
    expect(container.textContent).toContain("Images");
    expect(container.textContent).toContain("Customize Chrome");
    expect(container.textContent).toContain("ChatGPT");
    expect(container.textContent).not.toContain("Product continuity");
    expect(container.textContent).not.toContain("ChatGPT CDK 兑换检查");
    expect(
      Array.from(container.querySelectorAll("input")).some(
        (input) => input.value === "https://chatgpt.com/"
      )
    ).toBe(true);
  });

  it("renders the ChatGPT assistant only when launched through the separate assistant entry", () => {
    const container = renderBrowserLaunchPage({
      initialChatGptAssistant: true,
      initialLdxpAssistant: false,
      initialProvider: "chatgpt",
      initialTargetUrl: "https://chatgpt.com/",
    });

    expect(container.querySelector(".browser-product-shell-chrome")).not.toBeNull();
    expect(container.textContent).toContain("ChatGPT CDK 兑换检查");
    expect(container.textContent).toContain("本机浏览器登录内置 Codex");
  });

  it("renders desktop browser tabs through the mocked Chrome bridge", async () => {
    installBrowserChromeBridge({
      activeTabId: "tab-1",
      tabs: [
        {
          canGoBack: true,
          canGoForward: false,
          id: "tab-1",
          loading: false,
          securityState: "secure",
          title: "ChatGPT",
          url: "https://chatgpt.com/",
        },
      ],
    });

    const container = await renderBrowserLaunchPageAsync({
      initialChatGptAssistant: false,
      initialLdxpAssistant: false,
      initialProvider: "chatgpt",
      initialTargetUrl: "https://chatgpt.com/",
    });

    expect(container.querySelector(".browser-product-shell-desktop")).not.toBeNull();
    expect(container.textContent).toContain("ChatGPT");
    expect(container.querySelector('[aria-label="Back"]')?.getAttribute("aria-disabled")).toBe(
      "false"
    );
    expect(container.querySelector('[aria-label="Forward"]')?.getAttribute("aria-disabled")).toBe(
      "true"
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[aria-label="New tab"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("New Tab");
    expect(container.querySelector(".browser-product-google-logo")?.textContent).toBe("Google");
  });

  it("records a manual ChatGPT login witness after account data import", async () => {
    window.localStorage.setItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY, "1");
    installBrowserChromeBridge({
      activeTabId: "tab-1",
      tabs: [
        {
          canGoBack: false,
          canGoForward: false,
          id: "tab-1",
          loading: false,
          securityState: "secure",
          title: "ChatGPT",
          url: "https://chatgpt.com/",
        },
      ],
    });

    const container = await renderBrowserLaunchPageAsync({
      initialChatGptAssistant: false,
      initialLdxpAssistant: false,
      initialProvider: "chatgpt",
      initialTargetUrl: "https://chatgpt.com/",
    });

    expect(container.textContent).toContain("MANUAL_WITNESS_REQUIRED");

    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.includes("Record witness"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("VERIFIED");
    expect(
      JSON.parse(window.localStorage.getItem(T3_BROWSER_CHATGPT_LOGIN_WITNESS_STORAGE_KEY) ?? "{}")
    ).toEqual(
      expect.objectContaining({
        provider: "chatgpt",
        status: "VERIFIED",
      })
    );
  });

  it("navigates the active desktop tab through the mocked Chrome bridge", async () => {
    installBrowserChromeBridge({
      activeTabId: "tab-1",
      tabs: [
        {
          canGoBack: false,
          canGoForward: false,
          id: "tab-1",
          loading: false,
          securityState: "internal",
          title: "New Tab",
          url: "",
        },
      ],
    });

    const container = await renderBrowserLaunchPageAsync({
      initialChatGptAssistant: false,
      initialLdxpAssistant: false,
      initialProvider: "custom",
      initialTargetUrl: "",
    });
    const githubShortcut = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".browser-product-quick-start")
    ).find((button) => button.textContent?.includes("GitHub"));

    await act(async () => {
      githubShortcut?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("github.com");
    expect(container.querySelector('[aria-label="Back"]')?.getAttribute("aria-disabled")).toBe(
      "false"
    );
  });

  it("renders ldxp as a focused payment and pickup assistant without generic browser chrome", () => {
    const container = renderBrowserLaunchPage();

    expect(container.querySelector(".browser-product-topbar")).toBeNull();
    expect(container.querySelector(".browser-product-toolbar")).toBeNull();
    expect(container.querySelector(".browser-product-sidebar")).toBeNull();
    expect(container.querySelector(".browser-product-address")).toBeNull();
    expect(container.textContent).not.toContain("Open Site");
    expect(container.textContent).not.toContain("Copy URL");

    expect(container.textContent).toContain("站点名称");
    expect(container.textContent).toContain("pay.ldxp.cn");
    expect(container.textContent).toContain("用户付款单");
    expect(container.textContent).toContain("中转站老板操作台");
    expect(container.textContent).toContain("用户应付");
    expect(container.textContent).toContain("从 ldxp 收银台粘贴付款码");
    expect(container.textContent).toContain("收款码");
    expect(container.textContent).toContain("确认用户已支付");
    expect(container.textContent).toContain("取货兑换流程");
    expect(container.textContent).toContain("粘贴 ldxp.cn 支付后的订单页或发货提示。");
    expect(container.textContent).not.toContain("Paste the ldxp.cn cashier");
    expect(container.textContent).not.toContain("Paste the paid ldxp.cn page prompt");
    expect(container.textContent).not.toContain("Paste the paid order page text");
  });

  it("restores ldxp draft details and flags mismatched transaction inputs", () => {
    window.localStorage.setItem(
      T3_LDXP_BROWSER_DRAFT_STORAGE_KEY,
      JSON.stringify({
        fulfillmentText: "",
        paid: false,
        paymentText: `
          商品：普通会员
          金额：￥1.00
          付款码：https://example.com/pay/not-ldxp
        `,
      })
    );

    const container = renderBrowserLaunchPage();

    expect(container.textContent).toContain("智能交易检查");
    expect(container.textContent).toContain("付款链接不是 ldxp.cn");
    expect(container.textContent).toContain("金额不是 ¥0.10");
    expect(container.textContent).toContain("商品名不像 AI 充值测试商品");
    expect(container.textContent).toContain("需修正");
  });
});
