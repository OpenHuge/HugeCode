// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PopoverMenuItem, PopoverSurface } from "./Popover";

afterEach(() => {
  cleanup();
});

describe("Popover", () => {
  it("exposes shared popover surface semantics through @ku0/ui", () => {
    render(
      <PopoverSurface role="menu" aria-label="Shared popover">
        Shared menu
      </PopoverSurface>
    );

    expect(screen.getByRole("menu", { name: "Shared popover" })).toBeTruthy();
    expect(screen.getByText("Shared menu")).toBeTruthy();
  });

  it("forwards shared menu item behavior through @ku0/ui", () => {
    const onClick = vi.fn();

    render(
      <PopoverMenuItem role="menuitem" onClick={onClick}>
        Open review queue
      </PopoverMenuItem>
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Open review queue" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
