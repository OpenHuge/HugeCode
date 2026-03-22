import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const designSystemRoot = path.join(repoRoot, "packages", "design-system");

describe("design-system package exports", () => {
  it("defines an explicit shell-theme-values subpath entry and build input", async () => {
    const packageJsonPath = path.join(designSystemRoot, "package.json");
    const viteConfigPath = path.join(designSystemRoot, "vite.config.ts");
    const shellThemeSourcePath = path.join(designSystemRoot, "src", "shell-theme-values.ts");

    const [packageJsonText, viteConfigText] = await Promise.all([
      fs.readFile(packageJsonPath, "utf8"),
      fs.readFile(viteConfigPath, "utf8"),
    ]);
    const packageJson = JSON.parse(packageJsonText) as {
      exports?: Record<string, { default?: string; types?: string }>;
    };

    expect(packageJson.exports?.["./shell-theme-values"]).toEqual({
      default: "./dist/shell-theme-values.js",
      types: "./src/shell-theme-values.ts",
    });
    expect(viteConfigText).toContain(
      '"shell-theme-values": resolve(__dirname, "src/shell-theme-values.ts")'
    );
    await expect(fs.access(shellThemeSourcePath)).resolves.toBeUndefined();
  });
});
