import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as designSystem from "./index";

const packageRoot = path.resolve(import.meta.dirname, "..");

describe("design-system token pipeline", () => {
  it("keeps a repo-native token source under packages/design-system/tokens", () => {
    expect(fs.existsSync(path.join(packageRoot, "tokens"))).toBe(true);
    expect(fs.existsSync(path.join(packageRoot, "tokens", "$themes.json"))).toBe(true);
  });

  it("checks in generated vanilla-extract artifacts behind a stable facade", () => {
    const generatedDir = path.join(packageRoot, "src", "generated");
    const themeCssPath = path.join(generatedDir, "theme.css.ts");
    const tokenPathsPath = path.join(generatedDir, "tokenPaths.ts");
    const dtcgTokensPath = path.join(generatedDir, "dtcgTokens.json");

    expect(fs.existsSync(generatedDir)).toBe(true);
    expect(fs.existsSync(themeCssPath)).toBe(true);
    expect(fs.existsSync(tokenPathsPath)).toBe(true);
    expect(fs.existsSync(dtcgTokensPath)).toBe(true);

    const themeCssSource = fs.readFileSync(themeCssPath, "utf8");
    const dtcgTokens = JSON.parse(fs.readFileSync(dtcgTokensPath, "utf8")) as {
      $metadata?: { themes?: string[] };
      primitive?: unknown;
      semantic?: unknown;
      themes?: Record<string, unknown>;
    };

    expect(themeCssSource).toContain("createGlobalThemeContract");
    expect(dtcgTokens.$metadata?.themes).toEqual(["light", "dark", "dim"]);
    expect(dtcgTokens.primitive).toBeTruthy();
    expect(dtcgTokens.semantic).toBeTruthy();
    expect(dtcgTokens.themes?.light).toBeTruthy();
  });

  it("exposes DTCG-compatible token artifacts through the public package barrel", () => {
    expect("dtcgTokens" in designSystem).toBe(true);
    const dtcgTokens = (designSystem as { dtcgTokens?: { themes?: Record<string, unknown> } })
      .dtcgTokens;

    expect(dtcgTokens?.themes?.light).toBeTruthy();
    expect(dtcgTokens?.themes?.dark).toBeTruthy();
    expect(dtcgTokens?.themes?.dim).toBeTruthy();
  });

  it("keeps the free Figma bridge codegen asset in sync with the generated map", () => {
    const generatedMapPath = path.join(packageRoot, "src", "generated", "figmaCodegenMap.json");
    const figmaBridgeMapPath = path.resolve(
      packageRoot,
      "..",
      "..",
      "scripts",
      "figma-json-bridge",
      "generated",
      "figmaCodegenMap.js"
    );

    expect(fs.existsSync(generatedMapPath)).toBe(true);
    expect(fs.existsSync(figmaBridgeMapPath)).toBe(true);

    const generatedMap = JSON.parse(fs.readFileSync(generatedMapPath, "utf8"));
    const figmaBridgeSource = fs.readFileSync(figmaBridgeMapPath, "utf8");
    expect(figmaBridgeSource.startsWith("window.__HYPECODE_FIGMA_CODEGEN_MAP__ = ")).toBe(true);

    const bridgeWindow: {
      __HYPECODE_FIGMA_CODEGEN_MAP__?: unknown;
    } = {};
    new Function("window", `${figmaBridgeSource}; return window.__HYPECODE_FIGMA_CODEGEN_MAP__;`)(
      bridgeWindow
    );
    const bridgeMap = bridgeWindow.__HYPECODE_FIGMA_CODEGEN_MAP__;

    expect(bridgeMap).toEqual(generatedMap);
  });
});
