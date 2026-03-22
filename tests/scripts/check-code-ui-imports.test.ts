import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

async function copyScript(targetRoot: string) {
  const sourcePath = path.join(repoRoot, "scripts", "check-code-ui-imports.mjs");
  const targetPath = path.join(targetRoot, "scripts", "check-code-ui-imports.mjs");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
}

async function writeRepoFile(targetRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "check-code-ui-imports.mjs")],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

async function createFixtureRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "code-ui-imports-"));
  tempRoots.push(tempRoot);
  await copyScript(tempRoot);
  await writeRepoFile(
    tempRoot,
    "apps/code/src/design-system/index.ts",
    'export { Button } from "@ku0/design-system";\n'
  );
  await writeRepoFile(
    tempRoot,
    "apps/code/src/features/example/Example.tsx",
    'import { Button } from "../../../design-system";\nexport function Example() { return <Button type="button">Open</Button>; }\n'
  );
  return tempRoot;
}

describe("check-code-ui-imports", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((rootPath) => rm(rootPath, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("passes when feature tsx files import shared components through the app design-system barrel", async () => {
    const tempRoot = await createFixtureRepo();

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });

  it("fails when a feature tsx file imports shared components directly from @ku0/design-system", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/example/Example.tsx",
      'import { Button } from "@ku0/design-system";\nexport function Example() { return <Button type="button">Open</Button>; }\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("apps/code/src/features/example/Example.tsx");
    expect(result.stderr).toContain("registered app-grammar exception");
  });

  it("allows registered app-grammar exceptions to import shared components directly", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/core-loop/components/CoreLoopAdapters.tsx",
      'import { Text } from "@ku0/design-system";\nexport function CoreLoopAdapters() { return <Text>ok</Text>; }\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });
});
