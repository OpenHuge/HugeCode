import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

async function createFixture() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "check-test-placeholders-"));
  tempRoots.push(tempRoot);
  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await mkdir(path.join(tempRoot, "apps", "code", "src"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "check-test-placeholders.mjs"),
    path.join(tempRoot, "scripts", "check-test-placeholders.mjs")
  );
  return tempRoot;
}

function runGuard(tempRoot: string, changedFiles?: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(tempRoot, "scripts", "check-test-placeholders.mjs")],
    {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ...(changedFiles
          ? {
              VALIDATE_CHANGED_FILES_JSON: JSON.stringify(changedFiles),
            }
          : {}),
      },
    }
  );
}

describe("check-test-placeholders", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((rootPath) => rm(rootPath, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("fails on trivial assertions and focused tests", async () => {
    const tempRoot = await createFixture();
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "example.test.ts"),
      "it.only('focused', () => expect(true).toBe(true));\n",
      "utf8"
    );

    const result = runGuard(tempRoot, ["apps/code/src/example.test.ts"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("it.only(");
    expect(result.stderr).toContain("expect(true).toBe(true)");
  });

  it("scans only changed test files when validate provides a changed-file list", async () => {
    const tempRoot = await createFixture();
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "bad.test.ts"),
      "it.only('focused', () => expect(true).toBe(true));\n",
      "utf8"
    );
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "good.test.ts"),
      "it('works', () => expect(1).toBe(1));\n",
      "utf8"
    );

    const result = runGuard(tempRoot, ["apps/code/src/good.test.ts"]);

    expect(result.status).toBe(0);
  });

  it("ignores the guard's own fixture-based tests during full scans", async () => {
    const tempRoot = await createFixture();
    await mkdir(path.join(tempRoot, "tests", "scripts"), { recursive: true });
    await writeFile(
      path.join(tempRoot, "tests", "scripts", "check-test-placeholders.test.ts"),
      "it.only('fixture', () => expect(true).toBe(true));\n",
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });
});
