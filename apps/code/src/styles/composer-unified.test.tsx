// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

describe("composer unified surface spacing", () => {
  afterEach(() => {});

  it("keeps home and workspace composer surfaces aligned on top padding", () => {
    const source = readFileSync(resolve(import.meta.dirname, "composer-unified.css.ts"), "utf8");

    expect(source).toContain('"padding-top": "0"');
    expect(source).toContain('padding: "0 var(--composer-surface-inline-padding) 12px"');
    expect(source).toContain('applyGlobalStyle(".composer-surface--workspace"');
    expect(source).toContain('padding: "0"');
    expect(source).not.toContain('padding: "0 0 16px"');
  });
});
