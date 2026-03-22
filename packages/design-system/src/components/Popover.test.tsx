import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PopoverMenuItem, PopoverSurface } from "./Popover";

describe("Popover", () => {
  it("renders a popover surface with forwarded semantics", () => {
    const markup = renderToStaticMarkup(
      <PopoverSurface role="menu" aria-label="Thread actions">
        Menu content
      </PopoverSurface>
    );

    expect(markup).toContain(" ds-popover");
    expect(markup).toContain('role="menu"');
    expect(markup).toContain('aria-label="Thread actions"');
    expect(markup).toContain("Menu content");
  });

  it("marks non-modal dialog-like overlays as panel surfaces", () => {
    const markup = renderToStaticMarkup(
      <PopoverSurface role="dialog" aria-label="Branch details">
        Panel content
      </PopoverSurface>
    );

    expect(markup).toContain('data-overlay-kind="panel"');
    expect(markup).toContain('data-overlay-state="open"');
    expect(markup).toContain('aria-modal="false"');
    expect(markup).toContain("Panel content");
  });

  it("renders menu items with icon, disabled state, and active marker", () => {
    const markup = renderToStaticMarkup(
      <PopoverMenuItem role="menuitem" icon={<span>+</span>} active disabled>
        Open in VS Code
      </PopoverMenuItem>
    );

    expect(markup).toContain(" ds-popover-item");
    expect(markup).toContain(" ds-popover-item-icon");
    expect(markup).toContain(" ds-popover-item-label");
    expect(markup).toContain('type="button"');
    expect(markup).toContain('role="menuitem"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('data-active="true"');
    expect(markup).toContain("Open in VS Code");
  });

  it("exposes item spacing and icon sizing through component variables", () => {
    const source = readFileSync(resolve(import.meta.dirname, "Popover.css.ts"), "utf8");

    expect(source).toContain("--ds-popover-item-gap");
    expect(source).toContain("--ds-popover-item-padding-block");
    expect(source).toContain("--ds-popover-item-font-size");
    expect(source).toContain("--ds-popover-item-icon-size");
    expect(source).toContain("--ds-popover-item-icon-color");
  });

  it("keeps menu surfaces visually quiet instead of using glossy floating chrome", () => {
    const source = readFileSync(resolve(import.meta.dirname, "Popover.css.ts"), "utf8");

    expect(source).toContain('backgroundImage: dsVar("--ds-popover-surface-gloss", "none")');
    expect(source).toContain(
      '"0 12px 24px -18px color-mix(in srgb, var(--ds-shadow-color, black) 22%, transparent), 0 1px 2px color-mix(in srgb, var(--ds-shadow-color, black) 10%, transparent)"'
    );
    expect(source).toContain(
      'backdropFilter: dsVar("--ds-popover-backdrop", "blur(10px) saturate(1.04)")'
    );
  });
});
