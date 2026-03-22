import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Text } from "./Text";

describe("Text", () => {
  it("renders semantic text markers for size, tone, weight, and transform", () => {
    const markup = renderToStaticMarkup(
      <Text size="meta" tone="muted" weight="semibold" transform="uppercase">
        Status
      </Text>
    );

    expect(markup).toContain('data-family="text"');
    expect(markup).toContain('data-size="meta"');
    expect(markup).toContain('data-tone="muted"');
    expect(markup).toContain('data-weight="semibold"');
    expect(markup).toContain('data-transform="uppercase"');
    expect(markup).toContain(">Status<");
  });

  it("supports alternate elements and monospace truncation markers", () => {
    const markup = renderToStaticMarkup(
      <Text as="p" size="micro" tone="strong" monospace truncate>
        token-budget: 1024
      </Text>
    );

    expect(markup).toContain("<p");
    expect(markup).toContain('data-monospace="true"');
    expect(markup).toContain('data-truncate="true"');
  });

  it("sources shared text component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Text.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.text");
  });
});
