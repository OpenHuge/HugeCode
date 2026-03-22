import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("app compat theme vars", () => {
  it("keeps semantic compat vars as a shared DS re-export only", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "dsCompatSemanticVars.ts"),
      "utf8"
    );

    expect(source).toContain('from "@ku0/design-system"');
    expect(source).toContain("export { semanticThemeVars as dsCompatSemanticVars }");
    expect(source).not.toContain("export const dsCompatSemanticVars = {");
  });

  it("keeps execution compat vars as a shared DS re-export only", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "executionCompatThemeVars.ts"),
      "utf8"
    );

    expect(source).toContain('from "@ku0/design-system"');
    expect(source).toContain("export { executionThemeVars as executionCompatThemeVars }");
    expect(source).not.toContain("export const executionCompatThemeVars = {");
  });
});
