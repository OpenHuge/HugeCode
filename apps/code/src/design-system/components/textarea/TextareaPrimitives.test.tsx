/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Textarea } from "./TextareaPrimitives";

afterEach(() => {
  cleanup();
});

describe("TextareaPrimitives", () => {
  it("maps the legacy error prop to invalid semantics and keeps the app marker", () => {
    render(<Textarea aria-label="Commit message" error defaultValue="ship it" />);

    const textarea = screen.getByRole("textbox", { name: "Commit message" });

    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(textarea.getAttribute("data-app-textarea")).toBe("true");
    expect(textarea.className).toContain("app-textarea-control");
  });

  it("defaults textareaSize to lg and keeps class passthrough on field and control wrappers", () => {
    const { container } = render(
      <Textarea
        label="Summary"
        className="custom-textarea"
        fieldClassName="custom-field"
        defaultValue="release note"
      />
    );

    const textarea = screen.getByRole("textbox", { name: "Summary" });

    expect(textarea.className).toContain("app-textarea-control");
    expect(textarea.className).toContain("custom-textarea");
    expect(container.querySelector(".app-textarea-field.custom-field")).toBeTruthy();
  });
});
