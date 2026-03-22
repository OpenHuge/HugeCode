/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getExportedStyleBlock, readRelativeSource } from "../../../test/styleSource";
import { ComposerAccessDropdown } from "./ComposerAccessDropdown";

afterEach(() => {
  cleanup();
});

describe("ComposerAccessDropdown", () => {
  it("uses the app design-system Select adapter with compact trigger density and selection callbacks", () => {
    const onSelectAccessMode = vi.fn();

    render(
      <ComposerAccessDropdown accessMode="on-request" onSelectAccessMode={onSelectAccessMode} />
    );

    const trigger = screen.getByRole("button", { name: "Agent access" });
    expect(trigger.getAttribute("data-trigger-density")).toBe("compact");

    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: "Agent access" })).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: "Full access" }));

    expect(onSelectAccessMode).toHaveBeenCalledWith("full-access");
  });

  it("treats the icon and label chrome as one interaction target", () => {
    const onSelectAccessMode = vi.fn();
    const { container } = render(
      <ComposerAccessDropdown accessMode="on-request" onSelectAccessMode={onSelectAccessMode} />
    );

    const trigger = screen.getByRole("button", { name: "Agent access" });
    const shell = container.firstElementChild as HTMLElement | null;
    expect(shell).toBeTruthy();
    if (!shell) {
      throw new Error("Expected composer access shell");
    }

    expect(screen.queryByRole("listbox", { name: "Agent access" })).toBeNull();

    fireEvent.pointerDown(shell);

    expect(screen.getByRole("listbox", { name: "Agent access" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the access control on a shared shell surface instead of a transparent split target", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerAccessDropdown.styles.css.ts");
    const selectSource = readRelativeSource(import.meta.dirname, "ComposerSelectMenu.css.ts");
    const shellRule = getExportedStyleBlock(source, "shell");

    expect(shellRule).toContain('cursor: "pointer"');
    expect(source).toContain("grouped: {");
    expect(source).toContain('borderRadius: "0"');
    expect(source).toContain('padding: "1px 10px 1px 8px"');
    expect(source).toContain('overflow: "hidden"');
    expect(source).toContain('background: "transparent"');
    expect(source).not.toContain('borderLeft: "1px solid');
    expect(source).not.toContain('borderRight: "1px solid');
    expect(source).toContain("&:has([aria-expanded='true'])");
    expect(source).toContain("standalone: {");
    expect(source).toContain('borderRadius: "999px"');
    expect(source).toContain(
      'border: "1px solid color-mix(in srgb, var(--ds-border-subtle) 76%, transparent)"'
    );
    expect(source).toContain('padding: "1px 7px 1px 8px"');
    expect(source).toContain('overflow: "hidden"');
    expect(source).toContain('boxShadow: "none"');
    expect(source).toContain("vars: flatTriggerChromeVars");
    expect(source).toContain("export const menu = style([");
    expect(source).toContain("flatMenu,");
    expect(source).toContain("export const option = style([compactOption]);");
    expect(selectSource).toContain("export const flatTriggerChromeVars = {");
    expect(selectSource).toContain('"--ds-select-trigger-backdrop": "none"');
    expect(selectSource).toContain('"--ds-select-trigger-gloss": "none"');
    expect(selectSource).toContain('"--ds-select-menu-bg"');
    expect(selectSource).toContain('"--ds-select-menu-gloss": "none"');
    expect(selectSource).toContain('"--ds-select-menu-shadow": overlayValues.menuShadow');
    expect(selectSource).toContain('"--ds-select-menu-backdrop": overlayValues.menuBackdrop');
    expect(selectSource).toContain('"--ds-select-option-selected-shadow": "none"');
    expect(selectSource).toContain('"--ds-select-option-selected-bg"');
  });

  it("binds the access dropdown to the shared composer menu contract", () => {
    const source = readRelativeSource(import.meta.dirname, "ComposerAccessDropdown.tsx");

    expect(source).toContain('"composer-select-trigger"');
    expect(source).toContain('"composer-select-menu"');
    expect(source).toContain('"composer-select-option"');
    expect(source).toContain('data-ui-select-trigger="true"');
    expect(source).toContain("data-ds-select-anchor");
  });
});
