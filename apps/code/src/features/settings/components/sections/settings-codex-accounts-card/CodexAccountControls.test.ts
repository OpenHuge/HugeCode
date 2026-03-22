import { describe, expect, it } from "vitest";
import { readRelativeSource } from "../../../../../test/styleSource";

const source = readRelativeSource(import.meta.dirname, "./CodexAccountControls.css.ts");

describe("CodexAccountControls styles", () => {
  it("keeps account-pool selects aligned with the flat system chrome", () => {
    expect(source).toContain('"--ds-select-trigger-gloss": "none"');
    expect(source).toContain('"--ds-select-trigger-shadow": "none"');
    expect(source).toContain('"--ds-select-trigger-backdrop": "none"');
    expect(source).toContain('"--ds-select-menu-gloss": "none"');
    expect(source).toContain('"--ds-select-menu-shadow": "none"');
    expect(source).toContain('"--ds-select-menu-backdrop": "none"');
    expect(source).not.toContain("--apm-shadow-md");
  });
});
