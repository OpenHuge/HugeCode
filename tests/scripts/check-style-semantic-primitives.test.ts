import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-style-semantic-primitives.mjs",
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
    [path.join(targetRoot, "scripts", "check-style-semantic-primitives.mjs"), "--all"],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-style-semantic-primitives", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("fails on raw typography and motion literals in repo-owned style modules", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "semantic-style-guard-"));
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
        '  fontSize: "11px",',
        "  lineHeight: 1.35,",
        '  transition: "background 140ms ease, color 140ms ease",',
        '  outline: "1px solid var(--color-ring, rgba(80, 113, 190, 0.45))",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/Example.css.ts");
    expect(result.stderr).toContain("fontSize");
    expect(result.stderr).toContain("lineHeight");
    expect(result.stderr).toContain("transition");
    expect(result.stderr).toContain("outline");
  });

  it('fails on transition: "all" even when it uses semantic duration tokens', async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "semantic-style-guard-"));
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
        '  transition: "all var(--duration-fast) var(--ease-smooth)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("transition");
  });

  it("allows semantic typography and motion token usage", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "semantic-style-guard-"));
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
        '  fontSize: "var(--font-size-chrome)",',
        '  lineHeight: "var(--line-height-chrome)",',
        '  transition: "background var(--duration-fast) var(--ease-smooth), color var(--duration-fast) var(--ease-smooth)",',
        '  outline: "var(--focus-ring-button)",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Style semantic primitive guard: no violations detected.");
  });

  it("scans apps/code-web style modules during full-repo semantic checks", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "semantic-style-guard-"));
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
        '  fontSize: "11px",',
        '  boxShadow: "0 12px 36px rgba(0, 0, 0, 0.2)",',
        '  transition: "background-color 160ms ease, color 160ms ease",',
        "});",
        "",
      ].join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code-web/app/web.css.ts");
    expect(result.stderr).toContain("fontSize");
    expect(result.stderr).toContain("boxShadow");
    expect(result.stderr).toContain("transition");
  });
});
