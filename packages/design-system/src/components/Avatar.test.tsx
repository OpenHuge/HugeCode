import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readDesignSystemSource } from "../test/readDesignSystemSource";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("renders fallback content with serialized family markers", () => {
    const markup = renderToStaticMarkup(<Avatar fallback="JD" size="sm" shape="rounded" />);

    expect(markup).toContain('data-family="avatar"');
    expect(markup).toContain('data-size="sm"');
    expect(markup).toContain('data-shape="rounded"');
    expect(markup).toContain('data-has-image="false"');
    expect(markup).toContain("JD");
  });

  it("renders image avatars without dropping the accessible alt text", () => {
    const markup = renderToStaticMarkup(
      <Avatar src="https://example.com/avatar.png" alt="Jane Doe" size="lg" />
    );

    expect(markup).toContain('data-size="lg"');
    expect(markup).toContain('data-shape="circle"');
    expect(markup).toContain('data-has-image="true"');
    expect(markup).toContain('alt="Jane Doe"');
    expect(markup).toContain('src="https://example.com/avatar.png"');
  });

  it("sources shared avatar component tokens from theme semantics", () => {
    const source = readDesignSystemSource("components/Avatar.css.ts");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.avatar");
  });
});
