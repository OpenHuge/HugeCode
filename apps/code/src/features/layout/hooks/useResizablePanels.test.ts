/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useResizablePanels } from "./useResizablePanels";

type HookResult = ReturnType<typeof useResizablePanels>;

type RenderedHook = {
  result: HookResult;
  unmount: () => void;
};

function renderResizablePanels(): RenderedHook {
  let result: HookResult | undefined;

  function Test() {
    result = useResizablePanels();
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(Test));
  });

  return {
    get result() {
      if (!result) {
        throw new Error("Hook not rendered");
      }
      return result;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useResizablePanels", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = "";
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads stored sizes and clamps to bounds", () => {
    window.localStorage.setItem("codexmonitor.sidebarWidth", "999");
    window.localStorage.setItem("codexmonitor.rightPanelWidth", "100");
    window.localStorage.setItem("codexmonitor.planPanelHeight", "not-a-number");

    const hook = renderResizablePanels();

    expect(hook.result.sidebarWidth).toBe(420);
    expect(hook.result.rightPanelWidth).toBe(320);
    expect(hook.result.planPanelHeight).toBe(220);

    hook.unmount();
  });

  it("persists sidebar width changes on mouseup and clamps max", () => {
    const hook = renderResizablePanels();

    act(() => {
      hook.result.onSidebarResizeStart({
        clientX: 0,
        clientY: 0,
      } as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 4000, clientY: 0 }));
    });

    expect(hook.result.sidebarWidth).toBe(420);
    expect(window.localStorage.getItem("codexmonitor.sidebarWidth")).toBeNull();

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(window.localStorage.getItem("codexmonitor.sidebarWidth")).toBe("420");

    hook.unmount();
  });

  it("uses live width variable for right panel drag and commits on mouseup", () => {
    const hook = renderResizablePanels();

    act(() => {
      hook.result.onRightPanelResizeStart({
        clientX: 0,
        clientY: 0,
      } as React.MouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: -80, clientY: 0 }));
    });

    expect(document.documentElement.style.getPropertyValue("--right-panel-width-live")).toBe(
      "440px"
    );
    expect(hook.result.rightPanelWidth).toBe(360);
    expect(window.localStorage.getItem("codexmonitor.rightPanelWidth")).toBeNull();

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(hook.result.rightPanelWidth).toBe(440);
    expect(window.localStorage.getItem("codexmonitor.rightPanelWidth")).toBe("440");
    expect(document.documentElement.style.getPropertyValue("--right-panel-width-live")).toBe("");

    hook.unmount();
  });

  it("uses the narrower right panel default when no value is stored", () => {
    const hook = renderResizablePanels();

    expect(hook.result.rightPanelWidth).toBe(360);

    hook.unmount();
  });

  it("falls back to defaults when localStorage access throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage unavailable");
    });

    const hook = renderResizablePanels();

    expect(hook.result.sidebarWidth).toBe(260);
    expect(hook.result.rightPanelWidth).toBe(360);
    expect(hook.result.planPanelHeight).toBe(220);

    hook.unmount();
  });
});
