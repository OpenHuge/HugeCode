import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { BrowserLaunchPage, T3_LDXP_BROWSER_DRAFT_STORAGE_KEY } from "./BrowserLaunchPage";

const defaultProps = {
  initialAppId: null,
  initialAppKey: null,
  initialAppLabel: "ldxp.cn AI 充值",
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

describe("BrowserLaunchPage", () => {
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
