/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Tooltip } from "./Tooltip";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

function expectElement<T extends Element>(value: T | null): T {
  expect(value).not.toBeNull();
  return value as T;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Tooltip", () => {
  it("shows and hides tooltip content around a semantic trigger", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <Tooltip content="Stage changes">
          <button type="button">Stage</button>
        </Tooltip>
      );
    });

    const trigger = expectElement(container.querySelector("button"));
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      trigger.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    const mouseTooltip = expectElement(container.querySelector('[role="tooltip"]'));
    expect(mouseTooltip.textContent).toBe("Stage changes");
    expect(trigger.getAttribute("aria-describedby")).toBe(mouseTooltip.getAttribute("id"));

    act(() => {
      trigger.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    const focusTooltip = expectElement(container.querySelector('[role="tooltip"]'));
    expect(focusTooltip.textContent).toBe("Stage changes");

    act(() => {
      trigger.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("preserves an existing aria-describedby chain on the trigger", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <Tooltip content="Open actions" side="bottom">
          <button type="button" aria-describedby="existing-help">
            Actions
          </button>
        </Tooltip>
      );
    });

    const trigger = expectElement(container.querySelector("button"));

    act(() => {
      trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });

    const tooltip = expectElement(container.querySelector('[role="tooltip"]'));
    expect(tooltip.getAttribute("data-side")).toBe("bottom");
    expect(trigger.getAttribute("aria-describedby")).toBe(
      `existing-help ${tooltip.getAttribute("id")}`
    );

    act(() => {
      root.unmount();
    });
  });

  it("sources shared tooltip component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Tooltip.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.tooltip");
  });
});
