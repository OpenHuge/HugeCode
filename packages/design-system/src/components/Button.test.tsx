import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "./Button";

describe("Button", () => {
  it("renders loading state accessibly", () => {
    const markup = renderToStaticMarkup(<Button loading>Save</Button>);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
  });

  it("renders icon-only usage", () => {
    const markup = renderToStaticMarkup(
      <IconButton aria-label="Search" icon={<span>+</span>} variant="ghost" />
    );
    expect(markup).toContain('aria-label="Search"');
  });

  it("serializes variant, size, and loading state markers for validation surfaces", () => {
    const markup = renderToStaticMarkup(
      <Button variant="ghost" size="iconSm" loading fullWidth>
        More
      </Button>
    );

    expect(markup).toContain('data-loading="true"');
    expect(markup).toContain('data-variant="ghost"');
    expect(markup).toContain('data-size="iconSm"');
    expect(markup).toContain('data-full-width="true"');
    expect(markup).toContain(">More<");
  });

  it("keeps hover states positionally stable", () => {
    const source = readFileSync(new URL("./Button.css.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/&:hover:not\(:disabled\)"?\s*:\s*\{[\s\S]*transform\s*:/);
  });

  it("sources shared button component tokens from theme semantics", () => {
    const source = readFileSync(new URL("./Button.css.ts", import.meta.url), "utf8");

    expect(source).toContain('from "../themeSemantics"');
    expect(source).toContain("componentThemeVars.button");
  });
});
