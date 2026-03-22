import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { RadioGroup } from "./RadioGroup";

describe("RadioGroup", () => {
  it("renders group labeling, descriptions, and checked state", () => {
    const markup = renderToStaticMarkup(
      <RadioGroup
        label="Execution path"
        description="Choose how the agent should run"
        errorMessage="Pick one option"
        invalid
        value="remote"
        options={[
          { value: "local", label: "Local runtime" },
          { value: "remote", label: "Remote runtime", description: "Default backend" },
        ]}
      />
    );

    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain("Execution path");
    expect(markup).toContain("Choose how the agent should run");
    expect(markup).toContain("Pick one option");
    expect(markup).toContain("Remote runtime");
    expect(markup).toContain('checked=""');
  });

  it("renders card variants and state markers for disabled options", () => {
    const markup = renderToStaticMarkup(
      <RadioGroup
        variant="card"
        defaultValue="pair"
        options={[
          { value: "pair", label: "Pair", leadingLabel: "1" },
          { value: "delegate", label: "Delegate", disabled: true, leadingLabel: "2" },
        ]}
      />
    );

    expect(markup).toContain('data-checked="true"');
    expect(markup).toContain('data-disabled="true"');
    expect(markup).toContain(">✓<");
  });

  it("sources shared radio-group component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/RadioGroup.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.radioGroup");
  });
});
