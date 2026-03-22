import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Surface } from "./Surface";

describe("Surface", () => {
  it("renders compositional surface content", () => {
    const markup = renderToStaticMarkup(<Surface tone="elevated">Inspector</Surface>);
    expect(markup).toContain("Inspector");
  });

  it("supports semantic depth overrides independently from tone", () => {
    const markup = renderToStaticMarkup(
      <Surface tone="subtle" depth="floating">
        Floating inspector
      </Surface>
    );

    expect(markup).toContain("Floating inspector");
    expect(markup).toMatch(/class="[^"]+"/);
  });
});
