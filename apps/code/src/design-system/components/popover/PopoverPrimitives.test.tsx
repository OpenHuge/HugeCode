/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PopoverMenuItem, PopoverSurface } from "./PopoverPrimitives";

afterEach(() => {
  cleanup();
});

describe("PopoverPrimitives", () => {
  it("preserves shared popover surface semantics and adds app-owned markers", () => {
    render(
      <PopoverSurface role="menu" aria-label="Workspace actions" className="custom-popover">
        Menu content
      </PopoverSurface>
    );

    const surface = screen.getByRole("menu", { name: "Workspace actions" });

    expect(surface).toBeTruthy();
    expect(surface.className).toContain("app-popover-surface");
    expect(surface.className).toContain("custom-popover");
    expect(surface.getAttribute("data-app-popover-surface")).toBe("true");
    expect(surface.getAttribute("data-overlay-surface")).toBe("true");
  });

  it("preserves shared popover item behavior and adds app-owned markers", () => {
    const onClick = vi.fn();

    render(
      <PopoverMenuItem role="menuitem" className="custom-item" onClick={onClick}>
        Rename workspace
      </PopoverMenuItem>
    );

    const item = screen.getByRole("menuitem", { name: "Rename workspace" });
    fireEvent.click(item);

    expect(item.className).toContain("app-popover-item");
    expect(item.className).toContain("custom-item");
    expect(item.getAttribute("data-app-popover-item")).toBe("true");
    expect(item.getAttribute("data-overlay-item")).toBe("true");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
