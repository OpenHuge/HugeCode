import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./DropdownMenu";

describe("DropdownMenu", () => {
  it("renders dropdown menu triggers with menu-button semantics by default", () => {
    const markup = renderToStaticMarkup(<DropdownMenuTrigger open>More</DropdownMenuTrigger>);

    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('data-family="dropdown-menu"');
    expect(markup).toContain("More");
  });

  it("renders dropdown menu content with menu semantics by default", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenuContent aria-label="Workspace actions">Menu content</DropdownMenuContent>
    );

    expect(markup).toContain('role="menu"');
    expect(markup).toContain('aria-label="Workspace actions"');
    expect(markup).toContain('data-family="dropdown-menu"');
    expect(markup).toContain("Menu content");
  });

  it("renders dropdown items with menuitem defaults and active markers", () => {
    const markup = renderToStaticMarkup(
      <DropdownMenuItem icon={<span>+</span>} active disabled>
        Open in VS Code
      </DropdownMenuItem>
    );

    expect(markup).toContain('type="button"');
    expect(markup).toContain('role="menuitem"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('data-active="true"');
    expect(markup).toContain("Open in VS Code");
  });

  it("sources shared dropdown menu chrome tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Popover.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.popover");
  });

  it("keeps popover surfaces and items on the shared liquid-glass menu chrome", () => {
    const source = readDesignSystemSource("components/Popover.css.ts");

    expect(source).toContain("--ds-popover-backdrop");
    expect(source).toContain("--ds-popover-surface-gloss");
    expect(source).toContain('WebkitBackdropFilter: dsVar("--ds-popover-backdrop"');
    expect(source).toContain("--ds-popover-item-hover");
    expect(source).toContain("--ds-popover-item-active");
    expect(source).toContain('borderRadius: dsVar("--ds-popover-item-radius", "10px")');
  });

  it("keeps overlay enter motion and minimum hit-area rules on the shared popover contract", () => {
    const source = readDesignSystemSource("components/Popover.css.ts");

    expect(source).toContain("@starting-style");
    expect(source).toContain('minHeight: dsVar("--ds-popover-item-hit-area"');
    expect(source).toContain('data-overlay-state="open"');
  });
});
