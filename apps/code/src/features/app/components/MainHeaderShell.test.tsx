/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MainHeaderShell } from "./MainHeaderShell";

describe("MainHeaderShell", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the lightweight toolbar shell contract for home and workspace surfaces", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 64,
      top: 0,
      right: 800,
      bottom: 64,
      left: 0,
      toJSON: () => ({}),
    });

    const { container, unmount } = render(
      <div className="main">
        <MainHeaderShell
          className="custom-shell"
          leadingNode={<button type="button">Open sidebar</button>}
          identityNode={<span>Workspace identity</span>}
          actionsNode={<button type="button">Open settings</button>}
        />
      </div>
    );

    const header = container.querySelector("header");
    const main = container.querySelector(".main");
    expect(header).toBeTruthy();
    expect(header?.getAttribute("data-main-header-surface")).toBe("kanna-toolbar");
    expect(header?.className).toContain("custom-shell");
    expect(container.querySelector('[data-main-header-leading="true"]')).toBeTruthy();
    expect(container.querySelector('[data-main-header-identity="true"]')).toBeTruthy();
    expect(container.querySelector('[data-main-header-actions="true"]')).toBeTruthy();
    expect(main?.style.getPropertyValue("--main-topbar-height")).toBe("64px");

    unmount();
    expect(main?.style.getPropertyValue("--main-topbar-height")).toBe("");
  });
});
