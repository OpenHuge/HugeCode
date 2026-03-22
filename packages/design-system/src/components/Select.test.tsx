import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Select } from "./Select";

describe("Select", () => {
  it("renders an accessible trigger with the selected label", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Model"
        options={[
          { value: "gpt-5.3", label: "GPT-5.3 Codex" },
          { value: "gpt-5.2", label: "GPT-5.2 Codex" },
        ]}
        value="gpt-5.3"
      />
    );

    expect(markup).toContain('aria-label="Model"');
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('data-ui-select-root="true"');
    expect(markup).toContain('data-ui-select-trigger="true"');
    expect(markup).toContain('data-ui-select-trigger-label="true"');
    expect(markup).toContain('data-ui-select-trigger-caret="true"');
    expect(markup).toContain("GPT-5.3 Codex");
  });

  it("summarizes multi-select values when multiple options are selected", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Routing accounts"
        multiple
        options={[
          { value: "acc-1", label: "Account 1" },
          { value: "acc-2", label: "Account 2" },
          { value: "acc-3", label: "Account 3" },
        ]}
        values={["acc-1", "acc-2"]}
      />
    );

    expect(markup).toContain("2 selected");
  });

  it("supports placeholder and disabled trigger states", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Workspace"
        options={[{ value: "main", label: "Main workspace" }]}
        placeholder="Select workspace"
        disabled
      />
    );

    expect(markup).toContain("Select workspace");
    expect(markup).toContain("disabled");
  });

  it("exposes a compact trigger density for Figma-backed selector chips", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Status"
        triggerDensity="compact"
        options={[{ value: "updated", label: "Updated" }]}
        value="updated"
      />
    );

    expect(markup).toContain('data-trigger-density="compact"');
  });

  it("renders selected leading visuals inside the shared trigger chrome", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Editor"
        options={[{ value: "vscode", label: "VS Code", leading: <span data-editor-icon="true" /> }]}
        value="vscode"
      />
    );

    expect(markup).toContain('data-ui-select-trigger-leading="true"');
    expect(markup).toContain('data-editor-icon="true"');
  });

  it("supports custom trigger rendering while preserving shared select wiring", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Editor"
        options={[{ value: "vscode", label: "VS Code" }]}
        value="vscode"
        renderTrigger={({ ref, selectionLabel, caret, ...triggerProps }) => (
          <button {...triggerProps} ref={ref} data-custom-select-trigger="true">
            <span>{selectionLabel}</span>
            {caret}
          </button>
        )}
      />
    );

    expect(markup).toContain('data-custom-select-trigger="true"');
    expect(markup).toContain('aria-haspopup="listbox"');
  });

  it("renders label, description, and invalid state wiring like other form fields", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Workspace"
        label="Workspace"
        description="Choose the active workspace"
        errorMessage="Workspace is required"
        invalid
        options={[{ value: "main", label: "Main workspace" }]}
        value="main"
      />
    );

    expect(markup).toContain(">Workspace<");
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("Workspace is required");
  });

  it("serializes trigger state markers for density, placeholder, and selected values", () => {
    const placeholderMarkup = renderToStaticMarkup(
      <Select
        ariaLabel="Priority"
        triggerDensity="compact"
        options={[{ value: "p1", label: "Urgent" }]}
        placeholder="Select priority"
      />
    );

    expect(placeholderMarkup).toContain('data-trigger-density="compact"');
    expect(placeholderMarkup).toContain('data-placeholder="true"');
    expect(placeholderMarkup).toContain('data-has-value="false"');

    const selectedMarkup = renderToStaticMarkup(
      <Select
        ariaLabel="Priority"
        triggerDensity="compact"
        options={[{ value: "p1", label: "Urgent" }]}
        value="p1"
      />
    );

    expect(selectedMarkup).toContain('data-placeholder="false"');
    expect(selectedMarkup).toContain('data-has-value="true"');
  });

  it("sources shared select component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Select.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.select");
    expect(source).toContain("--ds-select-trigger-border");
    expect(source).toContain("--ds-select-menu-backdrop");
  });

  it("keeps select trigger and menu on shared liquid-glass chrome tokens", () => {
    const source = readDesignSystemSource("components/Select.css.ts");

    expect(source).toContain("--ds-select-trigger-backdrop");
    expect(source).toContain("--ds-select-trigger-gloss");
    expect(source).toContain('backdropFilter: "var(--ds-select-trigger-backdrop)"');
    expect(source).toContain('WebkitBackdropFilter: "var(--ds-select-trigger-backdrop)"');
    expect(source).toContain("--ds-select-menu-gloss");
    expect(source).toContain("WebkitBackdropFilter: `var(--ds-select-menu-backdrop,");
  });

  it("keeps portaled menus readable by providing menu and option fallbacks outside the trigger root", () => {
    const source = readDesignSystemSource("components/Select.css.ts");

    expect(source).toContain("const selectMenuDefaults = {");
    expect(source).toContain("const selectOptionDefaults = {");
    expect(source).toContain("var(--ds-select-menu-bg,");
    expect(source).toContain("var(--ds-select-menu-border,");
    expect(source).toContain("var(--ds-select-menu-shadow,");
    expect(source).toContain("var(--ds-select-menu-backdrop,");
    expect(source).toContain("var(--ds-select-option-hover-bg,");
    expect(source).toContain("var(--ds-select-option-selected-bg,");
    expect(source).toContain("var(--ds-select-option-label-overflow,");
  });
});
