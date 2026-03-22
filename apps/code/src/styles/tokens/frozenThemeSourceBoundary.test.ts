import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function listTypeScriptFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(resolved);
    }
    return (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) &&
      !resolved.endsWith(".test.ts") &&
      !resolved.endsWith(".test.tsx")
      ? [resolved]
      : [];
  });
}

function readTokenSource(fileName: string) {
  return readFileSync(path.resolve(import.meta.dirname, fileName), "utf8");
}

describe("frozen theme source boundaries", () => {
  it("allows only frozen token installers to import app-local theme values and contract files", () => {
    const tokenFiles = listTypeScriptFiles(import.meta.dirname);
    const normalizedImports = tokenFiles
      .map((absolutePath) => {
        const source = readFileSync(absolutePath, "utf8");
        const relativePath = path.relative(import.meta.dirname, absolutePath);
        return {
          relativePath,
          importsThemeContract:
            source.includes('from "./themeContract.css"') ||
            source.includes('from "./themeContract.css.ts"'),
          importsThemeValues:
            source.includes('from "./themeValues"') || source.includes('from "./themeValues.ts"'),
        };
      })
      .filter((entry) => entry.importsThemeContract || entry.importsThemeValues);

    expect(
      normalizedImports
        .filter((entry) => entry.importsThemeValues)
        .map((entry) => entry.relativePath)
    ).toEqual(["themeContract.css.ts", "themes.css.ts"]);
    expect(
      normalizedImports
        .filter((entry) => entry.importsThemeContract)
        .map((entry) => entry.relativePath)
    ).toEqual(["themes.css.ts"]);
  });

  it("keeps the legacy alias bridge mapped from shared compat vars only", () => {
    const source = readTokenSource("dsAliases.css.ts");

    expect(source).toContain('from "./dsCompatSemanticVars"');
    expect(source).not.toContain("themeValues");
    expect(source).not.toContain("themeContract");
  });

  it("marks the frozen theme files as compatibility-only sources with explicit ownership comments", () => {
    const themeValuesSource = readTokenSource("themeValues.ts");
    const themeContractSource = readTokenSource("themeContract.css.ts");
    const themesSource = readTokenSource("themes.css.ts");

    expect(themeValuesSource).toContain(
      "Only themes.css.ts and themeContract.css.ts may import this file."
    );
    expect(themeContractSource).toContain("Only themes.css.ts may import this file.");
    expect(themesSource).toContain(
      "This is the only runtime installer allowed to consume themeContract/themeValues."
    );
  });
});
