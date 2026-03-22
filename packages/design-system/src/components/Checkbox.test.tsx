/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Checkbox } from "./Checkbox";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Checkbox", () => {
  it("renders label, description, error wiring, and checked state", () => {
    const markup = renderToStaticMarkup(
      <Checkbox
        label="Enable periodic supervision"
        description="Runs a governance cycle on a fixed schedule"
        errorMessage="This setting cannot be disabled right now"
        checked
        invalid
        onCheckedChange={() => {}}
      />
    );

    expect(markup).toContain("Enable periodic supervision");
    expect(markup).toContain("Runs a governance cycle on a fixed schedule");
    expect(markup).toContain("This setting cannot be disabled right now");
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('checked=""');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("aria-describedby=");
  });

  it("allows app-level styling hooks for the root, input, and label text", () => {
    const markup = renderToStaticMarkup(
      <Checkbox
        label="Inject context"
        className="atlas-panel-toggle"
        inputClassName="atlas-panel-toggle-input"
        labelClassName="atlas-panel-toggle-label"
      />
    );

    expect(markup).toContain("atlas-panel-toggle");
    expect(markup).toContain("atlas-panel-toggle-input");
    expect(markup).toContain("atlas-panel-toggle-label");
  });

  it("serializes checkbox state markers and applies the indeterminate DOM property", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <Checkbox
          label="Enable periodic supervision"
          checked
          disabled
          invalid
          indeterminate
          readOnly
        />
      );
    });

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const rootLabel = container.querySelector("label");

    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(true);
    expect(rootLabel?.getAttribute("data-checked")).toBe("true");
    expect(rootLabel?.getAttribute("data-disabled")).toBe("true");
    expect(rootLabel?.getAttribute("data-invalid")).toBe("true");
    expect(rootLabel?.getAttribute("data-indeterminate")).toBe("true");
  });

  it("sources shared checkbox component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Checkbox.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.checkbox");
  });
});
