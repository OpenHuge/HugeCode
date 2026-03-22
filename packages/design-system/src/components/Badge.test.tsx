import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders restrained status content", () => {
    const markup = renderToStaticMarkup(<Badge tone="success">Ready</Badge>);
    expect(markup).toContain("Ready");
  });

  it("renders muted chip content", () => {
    const markup = renderToStaticMarkup(
      <Badge tone="neutral" shape="chip" size="lg">
        Dark
      </Badge>
    );
    expect(markup).toContain("Dark");
  });

  it("serializes default and explicit badge state markers for shared chip language", () => {
    const defaultMarkup = renderToStaticMarkup(<Badge>Ready</Badge>);

    expect(defaultMarkup).toContain('data-tone="neutral"');
    expect(defaultMarkup).toContain('data-shape="pill"');
    expect(defaultMarkup).toContain('data-size="sm"');

    const explicitMarkup = renderToStaticMarkup(
      <Badge tone="warning" shape="chip" size="lg">
        Needs review
      </Badge>
    );

    expect(explicitMarkup).toContain('data-tone="warning"');
    expect(explicitMarkup).toContain('data-shape="chip"');
    expect(explicitMarkup).toContain('data-size="lg"');
  });

  it("sources shared badge component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Badge.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.badge");
  });
});
