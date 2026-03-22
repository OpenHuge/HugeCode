import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

async function createFixture() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "check-llm-scaffolding-"));
  tempRoots.push(tempRoot);
  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await mkdir(path.join(tempRoot, "apps", "code", "src"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "check-llm-scaffolding.mjs"),
    path.join(tempRoot, "scripts", "check-llm-scaffolding.mjs")
  );
  return tempRoot;
}

function runGuard(tempRoot: string, changedFiles: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(tempRoot, "scripts", "check-llm-scaffolding.mjs")],
    {
      cwd: tempRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        VALIDATE_CHANGED_FILES_JSON: JSON.stringify(changedFiles),
      },
    }
  );
}

describe("check-llm-scaffolding", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((rootPath) => rm(rootPath, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("fails when changed source files contain omitted-implementation scaffolding", async () => {
    const tempRoot = await createFixture();
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "example.ts"),
      "// rest of the implementation remains unchanged\nexport const value = 1;\n",
      "utf8"
    );

    const result = runGuard(tempRoot, ["apps/code/src/example.ts"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("rest of implementation unchanged");
  });

  it("ignores docs and passes for normal source changes", async () => {
    const tempRoot = await createFixture();
    await mkdir(path.join(tempRoot, "docs"), { recursive: true });
    await writeFile(path.join(tempRoot, "docs", "notes.md"), "same as before\n", "utf8");
    await writeFile(
      path.join(tempRoot, "apps", "code", "src", "example.ts"),
      "export const value = 1;\n",
      "utf8"
    );

    const result = runGuard(tempRoot, ["docs/notes.md", "apps/code/src/example.ts"]);

    expect(result.status).toBe(0);
  });
});
