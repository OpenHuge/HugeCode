/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Input } from "./Input";

describe("Input", () => {
  it("renders label and described-by wiring", () => {
    const markup = renderToStaticMarkup(
      <Input
        label="Email"
        description="Used for notifications"
        errorMessage="Invalid email"
        invalid
      />
    );
    expect(markup).toContain("Email");
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("aria-describedby=");
  });

  it("marks prefix and suffix shell segments when affixes are present", () => {
    const markup = renderToStaticMarkup(
      <Input label="Workspace" prefix="linear.app/" suffix=".dev" defaultValue="my-workspace" />
    );

    expect(markup).toContain('data-has-prefix="true"');
    expect(markup).toContain('data-has-suffix="true"');
  });

  it("renders shared field shell messaging with description and error text", () => {
    const markup = renderToStaticMarkup(
      <Input
        label="Workspace"
        description="Used for local previews"
        errorMessage="Workspace is required"
        invalid
      />
    );

    expect(markup).toContain("Used for local previews");
    expect(markup).toContain("Workspace is required");
  });

  it("allows callers to style the outer field shell separately from the input control", () => {
    const markup = renderToStaticMarkup(
      <Input
        label="Workspace"
        fieldClassName="modal-input-shell"
        className="modal-input-control"
        defaultValue="my-workspace"
      />
    );

    expect(markup).not.toContain("fieldclassname=");
    expect(markup).not.toContain("fieldClassName=");
    expect(markup).toContain("modal-input-shell");
    expect(markup).toContain("modal-input-control");
  });

  it("serializes field shell state markers for invalid, disabled, readonly, and size", () => {
    const markup = renderToStaticMarkup(
      <Input label="Workspace" invalid disabled readOnly inputSize="lg" prefix="@" suffix=".dev" />
    );

    expect(markup).toContain('data-invalid="true"');
    expect(markup).toContain('data-disabled="true"');
    expect(markup).toContain('data-readonly="true"');
    expect(markup).toContain('data-input-size="lg"');
    expect(markup).toContain('data-has-prefix="true"');
    expect(markup).toContain('data-has-suffix="true"');
  });

  it("serializes whether the field starts with a value for fixture validation", () => {
    const emptyMarkup = renderToStaticMarkup(<Input label="Workspace" placeholder="Pick one" />);
    expect(emptyMarkup).toContain('data-has-value="false"');

    const filledMarkup = renderToStaticMarkup(
      <Input label="Workspace" defaultValue="my-workspace" />
    );
    expect(filledMarkup).toContain('data-has-value="true"');
  });

  it("emits normalized value changes without swallowing the native change event", () => {
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <Input
          label="Workspace"
          defaultValue="old-name"
          onValueChange={onValueChange}
          onChange={onChange}
        />
      );
    });

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    act(() => {
      if (!input) {
        return;
      }
      Object.defineProperty(input, "value", {
        configurable: true,
        value: "new-name",
      });
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledWith("new-name");
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("sources shared input component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Input.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.input");
  });
});
