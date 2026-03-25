import { chmodSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const nodeShebang = `#!${process.execPath}`;

async function createFixtureRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "run-turbo-affected-"));
  tempRoots.push(tempRoot);

  await mkdir(path.join(tempRoot, "scripts", "lib"), { recursive: true });
  await mkdir(path.join(tempRoot, "node_modules", ".bin"), { recursive: true });

  await cp(
    path.join(repoRoot, "scripts", "run-turbo-affected.mjs"),
    path.join(tempRoot, "scripts", "run-turbo-affected.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "git-base-ref.mjs"),
    path.join(tempRoot, "scripts", "lib", "git-base-ref.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "local-bin.mjs"),
    path.join(tempRoot, "scripts", "lib", "local-bin.mjs")
  );

  await writeTurboShim(tempRoot);
  await writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify({ name: "run-turbo-affected-fixture", private: true }, null, 2),
    "utf8"
  );

  runGit(tempRoot, ["init", "--initial-branch=main"]);
  runGit(tempRoot, ["config", "user.name", "Codex"]);
  runGit(tempRoot, ["config", "user.email", "codex@example.com"]);
  runGit(tempRoot, ["add", "-A"]);
  runGit(tempRoot, ["commit", "-m", "fixture"]);

  return tempRoot;
}

async function writeTurboShim(targetRoot: string) {
  const shimPath = path.join(targetRoot, "node_modules", ".bin", "turbo");
  await writeFile(
    shimPath,
    `${nodeShebang}
const fs = require("node:fs");
const payload = {
  args: process.argv.slice(2),
  turboScmBase: process.env.TURBO_SCM_BASE ?? null,
};
fs.appendFileSync(process.env.COMMAND_LOG_PATH, \`\${JSON.stringify(payload)}\\n\`, "utf8");
`,
    "utf8"
  );
  chmodSync(shimPath, 0o755);

  if (process.platform === "win32") {
    const cmdShimPath = path.join(targetRoot, "node_modules", ".bin", "turbo.cmd");
    await writeFile(
      cmdShimPath,
      `@echo off\r\n"${process.execPath}" "%~dp0\\turbo" %*\r\n`,
      "utf8"
    );
    chmodSync(cmdShimPath, 0o755);
  }
}

async function writeRepoFile(targetRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

function runGit(targetRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: targetRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

function runAffected(targetRoot: string, args: string[]) {
  const commandLogPath = path.join(targetRoot, "command-invocations.log");
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "run-turbo-affected.mjs"), ...args],
    {
      cwd: targetRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        COMMAND_LOG_PATH: commandLogPath,
        PATH: `${path.join(targetRoot, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      },
    }
  );
}

describe("run-turbo-affected.mjs", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("uses the sibling branch as the affected base for a clean stacked worktree-style branch", async () => {
    const tempRoot = await createFixtureRepo();
    runGit(tempRoot, ["checkout", "-b", "feature/parent"]);
    await writeRepoFile(tempRoot, "packages/demo/src/example.ts", "export const value = 1;\n");
    runGit(tempRoot, ["add", "-A"]);
    runGit(tempRoot, ["commit", "-m", "parent change"]);
    runGit(tempRoot, ["checkout", "-b", "feature/stacked-worktree"]);

    const result = runAffected(tempRoot, ["build"]);
    const commandLog = await readFile(path.join(tempRoot, "command-invocations.log"), "utf8");
    const invocation = JSON.parse(commandLog.trim()) as {
      args: string[];
      turboScmBase: string | null;
    };

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Using affected base ref (sibling-local): feature/parent");
    expect(invocation.args).toEqual(["run", "build", "--affected"]);
    expect(invocation.turboScmBase).toBe("feature/parent");
  });
});
