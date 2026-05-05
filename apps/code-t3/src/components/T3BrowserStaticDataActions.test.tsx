import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  T3_OPERATOR_UNLOCK_STORAGE_KEY,
  T3_P0_RUNTIME_ROLE_MODE_CARRIER,
} from "../runtime/t3P0RuntimeRole";
import { T3BrowserStaticDataActions } from "./T3BrowserStaticDataActions";

let mountedRoot: Root | null = null;
let mountedContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (mountedRoot) {
    act(() => mountedRoot?.unmount());
  }
  mountedRoot = null;
  mountedContainer?.remove();
  mountedContainer = null;
  window.localStorage.removeItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER);
  window.sessionStorage.removeItem(T3_OPERATOR_UNLOCK_STORAGE_KEY);
});

function renderActions(
  options: { accountImportCode?: string; role?: "customer" | "operator" | "developer" } = {}
) {
  if (options.role) {
    window.localStorage.setItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER, options.role);
  }
  const container = document.createElement("div");
  const onCheckLoginState = vi.fn();
  const onAccountImportCodeChange = vi.fn();
  const onExport = vi.fn();
  const onOpenChatGpt = vi.fn();
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <T3BrowserStaticDataActions
        accountImportCode={options.accountImportCode ?? "delivery-code"}
        busy={false}
        loginStateStatus="loggedIn"
        onAccountImportCodeChange={onAccountImportCodeChange}
        onCheckLoginState={onCheckLoginState}
        onExport={onExport}
        onOpenChatGpt={onOpenChatGpt}
      />
    );
  });
  mountedRoot = root;
  mountedContainer = container;
  return { container, onAccountImportCodeChange, onCheckLoginState, onExport, onOpenChatGpt };
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("T3BrowserStaticDataActions", () => {
  it("keeps customer mode on ChatGPT open without export controls", () => {
    const { container, onOpenChatGpt, onCheckLoginState, onExport } = renderActions();
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(container.textContent).toContain("Open ChatGPT");
    expect(container.textContent).not.toContain("Login ready");
    expect(container.textContent).not.toContain("Export account file");
    expect(container.querySelector("input[aria-label='文件解锁码']")).toBeNull();
    expect(buttons).toHaveLength(1);
    click(buttons[0]!);

    expect(onOpenChatGpt).toHaveBeenCalledOnce();
    expect(onCheckLoginState).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("preserves account data export controls for operator mode", () => {
    const { container, onCheckLoginState, onExport } = renderActions({ role: "operator" });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(container.textContent).toContain("Open ChatGPT");
    expect(container.textContent).toContain("Login ready");
    expect(container.textContent).toContain("Export account file");
    expect(container.querySelector("input[aria-label='文件解锁码']")).not.toBeNull();
    expect(buttons).toHaveLength(3);
    click(buttons[1]!);
    click(buttons[2]!);

    expect(onCheckLoginState).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it("requires a file unlock code for operator account data export", () => {
    const { container, onExport } = renderActions({ accountImportCode: "", role: "operator" });
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons[2]?.getAttribute("aria-disabled")).toBe("true");
    click(buttons[2]!);

    expect(onExport).not.toHaveBeenCalled();
  });
});
