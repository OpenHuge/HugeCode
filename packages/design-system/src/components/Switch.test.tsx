import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("renders label, description, error wiring, and checked state", () => {
    const markup = renderToStaticMarkup(
      <Switch
        label="Enable live supervision"
        description="Runs checks while the task is active"
        errorMessage="Unavailable while offline"
        checked
        invalid
        onCheckedChange={() => undefined}
      />
    );

    expect(markup).toContain("Enable live supervision");
    expect(markup).toContain("Runs checks while the task is active");
    expect(markup).toContain("Unavailable while offline");
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('checked=""');
    expect(markup).toContain('aria-invalid="true"');
  });

  it("serializes switch state markers and styling hooks", () => {
    const markup = renderToStaticMarkup(
      <Switch
        label="Enable live supervision"
        className="live-switch"
        controlClassName="live-switch-control"
        labelClassName="live-switch-label"
        checked
        disabled
      />
    );

    expect(markup).toContain("live-switch");
    expect(markup).toContain("live-switch-control");
    expect(markup).toContain("live-switch-label");
    expect(markup).toContain('data-checked="true"');
    expect(markup).toContain('data-disabled="true"');
  });

  it("sources shared switch component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Switch.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.switch");
  });
});
