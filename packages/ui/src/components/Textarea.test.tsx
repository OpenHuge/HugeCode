// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("maps legacy helper and error props onto shared textarea semantics", () => {
    render(
      <Textarea
        label="Summary"
        helperText="A short commit summary"
        error="Summary is required"
        defaultValue="ship it"
      />
    );

    const textarea = screen.getByRole("textbox", { name: "Summary" });

    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Summary is required")).toBeTruthy();
    expect(screen.queryByText("A short commit summary")).toBeNull();
  });

  it("keeps helper text visible when there is no error", () => {
    render(
      <Textarea
        label="Notes"
        helperText="Use this field for longer operator context."
        defaultValue="ready"
      />
    );

    expect(screen.getByRole("textbox", { name: "Notes" })).toBeTruthy();
    expect(screen.getByText("Use this field for longer operator context.")).toBeTruthy();
  });
});
