import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-style-color-sot.mjs",
  "scripts/lib/style-guard-config.mjs",
];

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "check-style-color-sot.mjs"), "--all"],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-style-color-sot", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("fails on legacy aliases and raw color fallbacks in downstream style modules", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-color-sot-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const stylePath = path.join(tempRoot, "apps", "code", "src", "styles", "Example.css.ts");
    await mkdir(path.dirname(stylePath), { recursive: true });
    await writeFile(
      stylePath,
      [
        'import { style } from "@vanilla-extract/css";',
        "",
        "export const example = style({",
        '  color: "var(--text-strong)",',
        '  borderColor: "var(--border-subtle, rgba(13, 13, 13, 0.08))",',
        '  backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, transparent)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/Example.css.ts");
    expect(result.stderr).toContain("legacy-alias");
    expect(result.stderr).toContain("raw-color-fallback");
    expect(result.stderr).toContain("legacy-color-mix");
  });

  it("fails on legacy compat aliases in downstream style modules", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-color-sot-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const stylePath = path.join(tempRoot, "apps", "code", "src", "styles", "Example.css.ts");
    await mkdir(path.dirname(stylePath), { recursive: true });
    await writeFile(
      stylePath,
      [
        'import { style } from "@vanilla-extract/css";',
        "",
        "export const example = style({",
        '  color: "var(--text-secondary)",',
        '  background: "var(--surface-1)",',
        '  borderColor: "var(--border-subtle-soft)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/Example.css.ts");
    expect(result.stderr).toContain("legacy-alias");
  });

  it("fails on raw color literals inside the app style boundary", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-color-sot-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const stylePath = path.join(tempRoot, "apps", "code", "src", "styles", "canvas.css.ts");
    await mkdir(path.dirname(stylePath), { recursive: true });
    await writeFile(
      stylePath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--shell-surface-sidebar": "rgba(18, 18, 18, 0.92)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/canvas.css.ts");
    expect(result.stderr).toContain("raw-color-literal");
  });

  it("scans apps/code-web style modules during full-repo checks", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-color-sot-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const stylePath = path.join(tempRoot, "apps", "code-web", "app", "web.css.ts");
    await mkdir(path.dirname(stylePath), { recursive: true });
    await writeFile(
      stylePath,
      [
        'import { style } from "@vanilla-extract/css";',
        "",
        "export const webShell = style({",
        '  color: "#f3f5f7",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code-web/app/web.css.ts");
    expect(result.stderr).toContain("raw-color-literal");
  });

  it("allows source-of-truth and compatibility boundary files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-color-sot-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--ds-text-strong": "var(--text-strong)",',
        '  "--ds-focus-ring": "color-mix(in srgb, var(--brand-primary) 60%, transparent)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Style color/source-of-truth guard: no violations detected.");
  });

  it("fails when the compatibility boundary reintroduces retired compat aliases", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-color-sot-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const aliasPath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "styles",
      "tokens",
      "dsAliases.css.ts"
    );
    await mkdir(path.dirname(aliasPath), { recursive: true });
    await writeFile(
      aliasPath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(":root", {',
        '  "--ds-text-strong": "var(--text-strong)",',
        '  "--surface-1": "var(--surface-card)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/tokens/dsAliases.css.ts");
    expect(result.stderr).toContain("retired-compat-alias");
  });
});
