import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "scripts/check-global-style-boundary.mjs",
  "scripts/check-stale-style-selectors.mjs",
];

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

function runScript(targetRoot: string, relativeScriptPath: string) {
  return spawnSync(process.execPath, [path.join(targetRoot, relativeScriptPath), "--all"], {
    cwd: targetRoot,
    encoding: "utf8",
  });
}

function runGit(targetRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: targetRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
}

describe("style boundary guards", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("prints actionable output when globalStyle expands outside approved files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-boundary-guards-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    runGit(tempRoot, ["init"]);

    const rogueStylePath = path.join(
      tempRoot,
      "apps",
      "code",
      "src",
      "features",
      "example",
      "Example.css.ts"
    );
    await mkdir(path.dirname(rogueStylePath), { recursive: true });
    await writeFile(
      rogueStylePath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(".example-bad", { color: "red" });',
        "",
      ].join("\n"),
      "utf8"
    );

    runGit(tempRoot, ["add", "."]);

    const result = runScript(tempRoot, "scripts/check-global-style-boundary.mjs");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/Example.css.ts");
    expect(result.stderr).toContain("globalStyle count increased from 0 to 1");
  });

  it("prints actionable output when a new global selector class is stale", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-boundary-guards-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    runGit(tempRoot, ["init"]);

    const staleStylePath = path.join(tempRoot, "apps", "code", "src", "styles", "example.css.ts");
    await mkdir(path.dirname(staleStylePath), { recursive: true });
    await writeFile(
      staleStylePath,
      [
        'import { globalStyle } from "@vanilla-extract/css";',
        "",
        'globalStyle(".example-unused", { color: "red" });',
        "",
      ].join("\n"),
      "utf8"
    );

    runGit(tempRoot, ["add", "."]);

    const result = runScript(tempRoot, "scripts/check-stale-style-selectors.mjs");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/styles/example.css.ts");
    expect(result.stderr).toContain(".example-unused");
    expect(result.stderr).toContain("not referenced by any current source file");
  });
});
