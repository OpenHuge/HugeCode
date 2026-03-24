import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const classifierScriptPath = path.join(repoRoot, "scripts", "classify-electron-beta-scope.mjs");

function runGit(tempRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: tempRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
}

async function writeRepoFile(tempRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(tempRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function createFixtureRepo() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "electron-beta-scope-"));
  tempRoots.push(tempRoot);

  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await cp(
    classifierScriptPath,
    path.join(tempRoot, "scripts", "classify-electron-beta-scope.mjs")
  );
  await writeRepoFile(tempRoot, "README.md", "# fixture\n");

  runGit(tempRoot, ["init", "--initial-branch=main"]);
  runGit(tempRoot, ["config", "user.name", "Codex"]);
  runGit(tempRoot, ["config", "user.email", "codex@example.com"]);
  runGit(tempRoot, ["add", "-A"]);
  runGit(tempRoot, ["commit", "-m", "fixture"]);

  return tempRoot;
}

async function commitChange(tempRoot: string, relativePath: string) {
  const targetPath = path.join(tempRoot, relativePath);
  let nextContent = `changed ${relativePath}\n`;

  try {
    const existingContent = await readFile(targetPath, "utf8");
    nextContent = `${existingContent}\n// changed ${relativePath}\n`;
  } catch {}

  await writeRepoFile(tempRoot, relativePath, nextContent);
  runGit(tempRoot, ["add", "-A"]);
  runGit(tempRoot, ["commit", "-m", `change ${relativePath}`]);
}

function runClassifier(tempRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(tempRoot, "scripts", "classify-electron-beta-scope.mjs")],
    {
      cwd: tempRoot,
      encoding: "utf8",
    }
  );
}

function parseOutput(stdout: string) {
  return Object.fromEntries(
    stdout
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => {
        const [key, value] = line.split("=", 2);
        return [key, value];
      })
  );
}

describe("classify-electron-beta-scope", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("treats workflow-wrapper changes as verify-only", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChange(tempRoot, ".github/workflows/electron-beta.yml");

    const result = runClassifier(tempRoot);

    expect(result.status).toBe(0);
    expect(parseOutput(result.stdout)).toEqual({
      electron_package_required: "false",
      electron_verify_required: "true",
    });
  });

  it("treats package-owned changes as verify plus packaging", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChange(tempRoot, "apps/code-electron/src/main.ts");

    const result = runClassifier(tempRoot);

    expect(result.status).toBe(0);
    expect(parseOutput(result.stdout)).toEqual({
      electron_package_required: "true",
      electron_verify_required: "true",
    });
  });

  it("treats classifier script edits as verify-only governance changes", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChange(tempRoot, "scripts/classify-electron-beta-scope.mjs");

    const result = runClassifier(tempRoot);

    expect(result.status).toBe(0);
    expect(parseOutput(result.stdout)).toEqual({
      electron_package_required: "false",
      electron_verify_required: "true",
    });
  });
});
