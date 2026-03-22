import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = ["scripts/check-inline-styles.mjs", "scripts/check-style-stack.mjs"];

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

function runScript(
  targetRoot: string,
  relativeScriptPath: string,
  changedFiles: string[] | null = null
) {
  return spawnSync(process.execPath, [path.join(targetRoot, relativeScriptPath)], {
    cwd: targetRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(changedFiles ? { VALIDATE_CHANGED_FILES_JSON: JSON.stringify(changedFiles) } : {}),
    },
  });
}

describe("incremental style guard targeting", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("limits inline-style scanning to changed files when validate provides a change set", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-guard-targeting-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const changedPath = path.join(tempRoot, "apps", "code", "src", "Changed.tsx");
    const unchangedViolationPath = path.join(tempRoot, "apps", "code", "src", "Unchanged.tsx");
    await mkdir(path.dirname(changedPath), { recursive: true });
    await writeFile(changedPath, "export function Changed() { return <div />; }\n", "utf8");
    await writeFile(
      unchangedViolationPath,
      'export function Unchanged() { return <div style={{ color: "red" }} />; }\n',
      "utf8"
    );

    const targetedResult = runScript(tempRoot, "scripts/check-inline-styles.mjs", [
      "apps/code/src/Changed.tsx",
    ]);
    const fullResult = runScript(tempRoot, "scripts/check-inline-styles.mjs");

    expect(targetedResult.status).toBe(0);
    expect(fullResult.status).toBe(1);
  });

  it("limits style-stack scanning to changed files when validate provides a change set", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-guard-targeting-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const changedPath = path.join(tempRoot, "apps", "code", "src", "Changed.tsx");
    const unchangedViolationPath = path.join(tempRoot, "docs", "tailwind.md");
    await mkdir(path.dirname(changedPath), { recursive: true });
    await mkdir(path.dirname(unchangedViolationPath), { recursive: true });
    await writeFile(changedPath, "export function Changed() { return null; }\n", "utf8");
    await writeFile(unchangedViolationPath, "@apply text-sm;\n", "utf8");

    const targetedResult = runScript(tempRoot, "scripts/check-style-stack.mjs", [
      "apps/code/src/Changed.tsx",
    ]);
    const fullResult = runScript(tempRoot, "scripts/check-style-stack.mjs");

    expect(targetedResult.status).toBe(0);
    expect(fullResult.status).toBe(1);
  });

  it("ignores banned style-stack fixture strings inside test files", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "style-guard-targeting-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureTestPath = path.join(tempRoot, "tests", "scripts", "fixture.test.ts");
    await mkdir(path.dirname(fixtureTestPath), { recursive: true });
    await writeFile(
      fixtureTestPath,
      'const fixture = "@apply text-sm;";\nexport { fixture };\n',
      "utf8"
    );

    const result = runScript(tempRoot, "scripts/check-style-stack.mjs");

    expect(result.status).toBe(0);
  });
});
