import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field, joinFieldMessageIds } from "./Field";
import { Input } from "./Input";

describe("Field", () => {
  it("wires label semantics to the supplied htmlFor", () => {
    const markup = renderToStaticMarkup(
      <Field label="Workspace name" htmlFor="workspace-name">
        <Input id="workspace-name" value="" onValueChange={() => undefined} />
      </Field>
    );

    expect(markup).toContain("<label");
    expect(markup).toContain('for="workspace-name"');
    expect(markup).toContain("Workspace name");
  });

  it("renders description and error messages together when provided", () => {
    const markup = renderToStaticMarkup(
      <Field
        label="Workspace name"
        htmlFor="workspace-name"
        description="Used in the sidebar and launchpad."
        errorMessage="Name is required."
      >
        <Input id="workspace-name" value="" onValueChange={() => undefined} />
      </Field>
    );

    expect(markup).toContain("Used in the sidebar and launchpad.");
    expect(markup).toContain("Name is required.");
  });

  it("joins message ids without introducing empty segments", () => {
    expect(joinFieldMessageIds("field-description", undefined, "field-error")).toBe(
      "field-description field-error"
    );
    expect(joinFieldMessageIds(undefined, undefined)).toBeUndefined();
  });
});
