import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { T3OperatorUnlockDialog } from "./T3OperatorUnlockDialog";

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

function renderDialog(onUnlock: (password: string) => boolean) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(<T3OperatorUnlockDialog open={true} onClose={vi.fn()} onUnlock={onUnlock} />);
  });
  mountedRoot = root;
  mountedContainer = container;
  return container;
}

function changeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pressEnter(input: HTMLInputElement) {
  input.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" })
  );
}

describe("T3OperatorUnlockDialog", () => {
  it("submits the operator password when Enter is pressed", () => {
    const onUnlock = vi.fn((password: string) => password === "operator-secret");
    const container = renderDialog(onUnlock);
    const input = container.querySelector<HTMLInputElement>("input[aria-label='生产端本地密码']");

    expect(input).not.toBeNull();
    act(() => {
      changeInputValue(input!, "operator-secret");
      pressEnter(input!);
    });

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith("operator-secret");
    expect(input?.value).toBe("");
  });

  it("keeps the dialog open with an error when Enter submits a wrong password", () => {
    const onUnlock = vi.fn(() => false);
    const container = renderDialog(onUnlock);
    const input = container.querySelector<HTMLInputElement>("input[aria-label='生产端本地密码']");

    expect(input).not.toBeNull();
    act(() => {
      changeInputValue(input!, "wrong-secret");
      pressEnter(input!);
    });

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("生产端本地密码不正确。");
  });
});
