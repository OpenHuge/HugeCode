import { act } from "react";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  T3WorkspaceAssistantEntries,
  T3WorkspaceAssistantThreadRows,
  type T3WorkspaceAssistantPage,
} from "./T3WorkspaceAssistantEntries";

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
});

function renderAssistantEntries(
  options: {
    browserDataImported?: boolean;
    browserImportBusy?: boolean;
    onImportBrowserData?: () => void;
    onLoginChatGptAccount?: () => void;
    onOpenBrowser?: () => void;
  } = {}
) {
  const container = document.createElement("div");
  const onImportBrowserData = options.onImportBrowserData ?? vi.fn();
  const onLoginChatGptAccount = options.onLoginChatGptAccount ?? vi.fn();
  const onNotice = vi.fn();
  const onOpenBrowser = options.onOpenBrowser ?? vi.fn();
  document.body.append(container);
  const root = createRoot(container);
  function Harness() {
    const [activePage, setActivePage] = useState<T3WorkspaceAssistantPage>("home");
    return (
      <T3WorkspaceAssistantEntries
        activePage={activePage}
        browserDataImported={options.browserDataImported ?? true}
        browserImportBusy={options.browserImportBusy ?? false}
        locale="zh"
        routes={[]}
        onApplyRelayRoute={vi.fn()}
        onAssistantPageChange={setActivePage}
        onImportBrowserData={onImportBrowserData}
        onLoginChatGptAccount={onLoginChatGptAccount}
        onOpenBrowser={onOpenBrowser}
        onNotice={onNotice}
      />
    );
  }
  act(() => {
    root.render(<Harness />);
  });
  mountedRoot = root;
  mountedContainer = container;
  return {
    container,
    onImportBrowserData,
    onLoginChatGptAccount,
    onNotice,
    onOpenBrowser,
  };
}

function renderAssistantEntriesWithPage(
  activePage: T3WorkspaceAssistantPage,
  options: { browserDataImported?: boolean; onOpenBrowser?: () => void } = {}
) {
  const container = document.createElement("div");
  const onAssistantPageChange = vi.fn();
  const onOpenBrowser = options.onOpenBrowser ?? vi.fn();
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <T3WorkspaceAssistantEntries
        activePage={activePage}
        browserDataImported={options.browserDataImported ?? true}
        browserImportBusy={false}
        locale="zh"
        routes={[]}
        onApplyRelayRoute={vi.fn()}
        onAssistantPageChange={onAssistantPageChange}
        onImportBrowserData={vi.fn()}
        onLoginChatGptAccount={vi.fn()}
        onOpenBrowser={onOpenBrowser}
        onNotice={vi.fn()}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container, onAssistantPageChange };
}

function renderAssistantThreadRows(activePage: T3WorkspaceAssistantPage = "home") {
  const container = document.createElement("div");
  const onOpenAssistantPage = vi.fn();
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <T3WorkspaceAssistantThreadRows
        activePage={activePage}
        locale="zh"
        onOpenAssistantPage={onOpenAssistantPage}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container, onOpenAssistantPage };
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("T3WorkspaceAssistantEntries", () => {
  it("gates startup entries behind browser account data import", () => {
    const onImportBrowserData = vi.fn();
    const onLoginChatGptAccount = vi.fn();
    const { container } = renderAssistantEntries({
      browserDataImported: false,
      onImportBrowserData,
      onLoginChatGptAccount,
    });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(container.querySelectorAll(".t3-main-entry-card")).toHaveLength(0);
    expect(container.textContent).toContain("导入账户数据 或 登录 ChatGPT 账户");
    expect(container.textContent).toContain("导入账户数据");
    expect(container.textContent).toContain("登录 ChatGPT 账户");
    expect(container.textContent).not.toContain("账户池管理");
    expect(container.textContent).not.toContain("中转助手");

    click(buttons[0]!);
    click(buttons[1]!);

    expect(onImportBrowserData).toHaveBeenCalledOnce();
    expect(onLoginChatGptAccount).toHaveBeenCalledOnce();
  });

  it("renders compact startup cards before assistant operations", () => {
    const { container } = renderAssistantEntries();
    const startupCards = Array.from(container.querySelectorAll(".t3-main-entry-card"));

    expect(startupCards).toHaveLength(3);
    expect(startupCards[0]?.className).toContain("browser");
    expect(startupCards[1]?.className).toContain("account");
    expect(startupCards[2]?.className).toContain("relay");
    expect(container.textContent).toContain("账户池管理");
    expect(container.textContent).toContain("中转助手");
    expect(container.textContent).toContain("浏览器");
    expect(container.textContent).not.toContain("Pro 20x");
    expect(container.textContent).not.toContain("TokenFlux");
  });

  it("opens the account rental operation page from the startup card", () => {
    const { container, onNotice } = renderAssistantEntries();
    const accountEntry = container.querySelector(".t3-main-entry-card.account");
    expect(accountEntry).not.toBeNull();

    click(accountEntry!);

    expect(container.textContent).toContain("账户列表");
    expect(container.textContent).toContain("Pro 20x");
    expect(container.textContent).toContain("Pro 5x");
    expect(container.textContent).toContain("一键租用");
    expect(container.textContent).toContain("auth.json 待提供");
    expect(container.querySelectorAll(".t3-main-entry-card")).toHaveLength(0);

    const rentButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("一键租用") ?? false
    );
    expect(rentButton).not.toBeNull();
    click(rentButton!);

    expect(container.textContent).toContain("已租用");
    expect(onNotice).toHaveBeenCalledWith("Pro 20x 已选中，等待导入 auth.json 后可完成交付。");
  });

  it("opens the relay operation page from the startup card", () => {
    const { container } = renderAssistantEntries();
    const relayEntry = container.querySelector(".t3-main-entry-card.relay");
    expect(relayEntry).not.toBeNull();

    click(relayEntry!);

    expect(container.textContent).toContain("TokenFlux");
    expect(container.textContent).toContain("设为内置 Codex 中转");
    expect(container.querySelectorAll(".t3-main-entry-card")).toHaveLength(0);
  });

  it("opens an operation page from externally controlled state", () => {
    const { container, onAssistantPageChange } = renderAssistantEntriesWithPage("relay");

    expect(container.textContent).toContain("TokenFlux");
    expect(container.textContent).toContain("设为内置 Codex 中转");

    const backButton = container.querySelector("button[aria-label='返回启动入口']");
    expect(backButton).not.toBeNull();
    click(backButton!);

    expect(onAssistantPageChange).toHaveBeenCalledWith("home");
  });

  it("opens the browser page from the startup card", () => {
    const onOpenBrowser = vi.fn();
    const { container, onAssistantPageChange } = renderAssistantEntriesWithPage("home", {
      onOpenBrowser,
    });

    const browserEntry = container.querySelector(".t3-main-entry-card.browser button");
    expect(browserEntry).not.toBeNull();
    click(browserEntry!);

    expect(onOpenBrowser).toHaveBeenCalledOnce();
    expect(onAssistantPageChange).not.toHaveBeenCalled();
  });

  it("imports browser files from the startup browser entry", () => {
    const onImportBrowserData = vi.fn();
    const { container } = renderAssistantEntries({ onImportBrowserData });

    const importButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("导入浏览器文件") ?? false
    );
    expect(importButton).not.toBeNull();
    click(importButton!);

    expect(onImportBrowserData).toHaveBeenCalledOnce();
  });

  it("shows ChatGPT local browser import action after browser data is imported", () => {
    const onLoginChatGptAccount = vi.fn();
    const { container } = renderAssistantEntries({
      browserDataImported: true,
      onLoginChatGptAccount,
    });

    const chatGptButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("打开 ChatGPT 内置浏览器") ?? false
    );
    expect(chatGptButton).not.toBeNull();
    click(chatGptButton!);

    expect(onLoginChatGptAccount).toHaveBeenCalledOnce();
  });

  it("routes assistant thread rows to their operation pages", () => {
    const { container, onOpenAssistantPage } = renderAssistantThreadRows("account-rental");
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons[0]?.className).toContain("active");
    click(buttons[0]!);
    click(buttons[1]!);

    expect(onOpenAssistantPage).toHaveBeenNthCalledWith(1, "account-rental");
    expect(onOpenAssistantPage).toHaveBeenNthCalledWith(2, "relay");
  });
});
