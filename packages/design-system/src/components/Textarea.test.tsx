import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders accessible description and error wiring", () => {
    const markup = renderToStaticMarkup(
      <Textarea
        label="Summary"
        description="A short commit summary"
        errorMessage="Summary is required"
        invalid
      />
    );
    expect(markup).toContain("Summary");
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("aria-describedby=");
  });

  it("keeps description visible alongside error messaging in the shared field shell", () => {
    const markup = renderToStaticMarkup(
      <Textarea
        label="Summary"
        description="A short commit summary"
        errorMessage="Summary is required"
        invalid
      />
    );

    expect(markup).toContain("A short commit summary");
    expect(markup).toContain("Summary is required");
  });

  it("allows callers to style the outer field shell separately from the textarea control", () => {
    const markup = renderToStaticMarkup(
      <Textarea
        label="Summary"
        fieldClassName="modal-textarea-shell"
        className="modal-textarea-control"
        defaultValue="ship it"
      />
    );

    expect(markup).not.toContain("fieldclassname=");
    expect(markup).not.toContain("fieldClassName=");
    expect(markup).toContain("modal-textarea-shell");
    expect(markup).toContain("modal-textarea-control");
  });
});
