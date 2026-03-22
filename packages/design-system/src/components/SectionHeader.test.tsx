import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders title meta and actions", () => {
    const markup = renderToStaticMarkup(
      <SectionHeader
        title="Mission signals"
        meta="Mission control live"
        actions={<button type="button">Refresh</button>}
      />
    );

    expect(markup).toContain("Mission signals");
    expect(markup).toContain("Mission control live");
    expect(markup).toContain("Refresh");
  });

  it("supports semantic heading titles", () => {
    const markup = renderToStaticMarkup(
      <SectionHeader title="Launch readiness" titleAs="h2" meta="Ready" />
    );

    expect(markup).toContain("<h2");
    expect(markup).toContain("Launch readiness");
  });
});
