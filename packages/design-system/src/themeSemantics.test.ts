import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("themeSemantics source of truth", () => {
  it("does not depend on legacy alias token families", () => {
    const source = readFileSync(path.resolve(import.meta.dirname, "themeSemantics.ts"), "utf8");

    expect(source).not.toMatch(/--surface-/u);
    expect(source).not.toMatch(/--text-/u);
    expect(source).not.toMatch(/--border-/u);
    expect(source).not.toMatch(/--brand-/u);
  });
});
