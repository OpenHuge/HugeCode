import { chmodSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const nodeShebang = `#!${process.execPath}`;

async function createTempRoot(prefix: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), prefix));
  tempRoots.push(tempRoot);
  return tempRoot;
}

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

async function copySyncScript(targetRepo: string): Promise<void> {
  const scriptsDir = path.join(targetRepo, "scripts");
  await mkdir(path.join(scriptsDir, "lib"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "collab-sync-loop.mjs"),
    path.join(scriptsDir, "collab-sync-loop.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "check-branch-policy.mjs"),
    path.join(scriptsDir, "check-branch-policy.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "check-output.mjs"),
    path.join(scriptsDir, "lib", "check-output.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "branch-policy.mjs"),
    path.join(scriptsDir, "lib", "branch-policy.mjs")
  );
}

async function createCommandShim(targetRepo: string, commandName: string): Promise<void> {
  const binDir = path.join(targetRepo, "bin");
  await mkdir(binDir, { recursive: true });

  const scriptBody = `${nodeShebang}
const fs = require("node:fs");
const args = process.argv.slice(2).join(" ");
fs.appendFileSync(process.env.COMMAND_LOG_PATH, \`${commandName} \${args}\\n\`, "utf8");
`;
  const shimPath = path.join(binDir, commandName);
  await writeFile(shimPath, scriptBody, "utf8");
  chmodSync(shimPath, 0o755);

  if (process.platform === "win32") {
    const cmdShimPath = path.join(binDir, `${commandName}.cmd`);
    await writeFile(
      cmdShimPath,
      `@echo off\r\n"${process.execPath}" "%~dp0\\${commandName}" %*\r\n`,
      "utf8"
    );
    chmodSync(cmdShimPath, 0o755);
  }
}

async function createTrackedRepo(prefix: string) {
  const tempRoot = await createTempRoot(prefix);
  const remotePath = path.join(tempRoot, "remote.git");
  const localPath = path.join(tempRoot, "local");

  runGit(tempRoot, ["init", "--bare", remotePath]);
  runGit(tempRoot, ["clone", remotePath, "local"]);
  runGit(localPath, ["config", "user.name", "Codex"]);
  runGit(localPath, ["config", "user.email", "codex@example.com"]);
  runGit(localPath, ["switch", "-c", "main"]);

  await copySyncScript(localPath);
  await writeFile(path.join(localPath, "README.md"), "# fixture\n", "utf8");
  runGit(localPath, ["add", "-A"]);
  runGit(localPath, ["commit", "-m", "initial"]);
  runGit(localPath, ["push", "-u", "origin", "main"]);

  return { tempRoot, remotePath, localPath };
}

async function createPeerClone(tempRoot: string, remotePath: string, name: string) {
  const peerPath = path.join(tempRoot, name);
  runGit(tempRoot, ["clone", remotePath, name]);
  runGit(peerPath, ["config", "user.name", "Peer"]);
  runGit(peerPath, ["config", "user.email", "peer@example.com"]);
  runGit(peerPath, ["switch", "main"]);
  return peerPath;
}

function runSync(localPath: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(localPath, "scripts", "collab-sync-loop.mjs"), ...args],
    {
      cwd: localPath,
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
      },
    }
  );
}

describe("collab-sync-loop", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("reports a clean synced repository via --status-only --json", async () => {
    const { localPath } = await createTrackedRepo("collab-sync-clean-");

    const result = runSync(localPath, ["--status-only", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      mode: string;
      status: { ahead: number; behind: number; dirty: boolean; branch: string };
    };

    expect(result.status).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.mode).toBe("status-only");
    expect(payload.status.branch).toBe("main");
    expect(payload.status.ahead).toBe(0);
    expect(payload.status.behind).toBe(0);
    expect(payload.status.dirty).toBe(false);
  });

  it("reports behind status after remote updates are fetched", async () => {
    const { tempRoot, remotePath, localPath } = await createTrackedRepo("collab-sync-behind-");
    const peerPath = await createPeerClone(tempRoot, remotePath, "peer");

    await writeFile(path.join(peerPath, "peer.txt"), "peer change\n", "utf8");
    runGit(peerPath, ["add", "-A"]);
    runGit(peerPath, ["commit", "-m", "peer update"]);
    runGit(peerPath, ["push", "origin", "main"]);

    const result = runSync(localPath, ["--status-only", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      status: { behind: number; ahead: number; dirty: boolean };
    };

    expect(result.status).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.status.behind).toBe(1);
    expect(payload.status.ahead).toBe(0);
    expect(payload.status.dirty).toBe(false);
  });

  it("fails with structured output when --fail-if-behind is set", async () => {
    const { tempRoot, remotePath, localPath } = await createTrackedRepo("collab-sync-behind-fail-");
    const peerPath = await createPeerClone(tempRoot, remotePath, "peer");

    await writeFile(path.join(peerPath, "peer.txt"), "peer change\n", "utf8");
    runGit(peerPath, ["add", "-A"]);
    runGit(peerPath, ["commit", "-m", "peer update"]);
    runGit(peerPath, ["push", "origin", "main"]);

    const result = runSync(localPath, ["--status-only", "--json", "--fail-if-behind"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      code: string;
      status: { behind: number };
    };

    expect(result.status).toBe(1);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("behind_remote");
    expect(payload.status.behind).toBe(1);
  });

  it("reports dirty worktree state via --status-only --json", async () => {
    const { localPath } = await createTrackedRepo("collab-sync-dirty-");

    await writeFile(path.join(localPath, "README.md"), "# dirty\n", "utf8");

    const result = runSync(localPath, ["--status-only", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      status: { dirty: boolean; dirtyEntries: string[] };
    };

    expect(result.status).toBe(0);
    expect(payload.ok).toBe(true);
    expect(payload.status.dirty).toBe(true);
    expect(payload.status.dirtyEntries).toEqual(expect.arrayContaining(["M README.md"]));
  });

  it("fails with structured output when --fail-if-dirty is set", async () => {
    const { localPath } = await createTrackedRepo("collab-sync-dirty-fail-");

    await writeFile(path.join(localPath, "README.md"), "# dirty\n", "utf8");

    const result = runSync(localPath, ["--status-only", "--json", "--fail-if-dirty"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      code: string;
      status: { dirty: boolean };
    };

    expect(result.status).toBe(1);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("dirty_worktree");
    expect(payload.status.dirty).toBe(true);
  });

  it("maps --validate-profile fast to pnpm validate:fast", async () => {
    const { localPath } = await createTrackedRepo("collab-sync-validate-profile-");
    const commandLogPath = path.join(localPath, "command-invocations.log");

    await createCommandShim(localPath, "pnpm");
    await writeFile(path.join(localPath, "README.md"), "# dirty\n", "utf8");

    const result = runSync(
      localPath,
      ["--validate-profile", "fast", "--skip-commit", "--no-push"],
      {
        PATH: `${path.join(localPath, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
        COMMAND_LOG_PATH: commandLogPath,
      }
    );
    const commandLog = await readFile(commandLogPath, "utf8");

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm validate:fast");
  });

  it("fails before mutating git operations when branch naming is invalid", async () => {
    const { localPath } = await createTrackedRepo("collab-sync-invalid-branch-");
    runGit(localPath, ["switch", "-c", "feature/not-allowed"]);

    const result = runSync(localPath, ["--skip-validate", "--skip-commit", "--no-push", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      code: string;
      branchPolicy?: { branch: string | null };
    };

    expect(result.status).toBe(1);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("invalid_branch_policy");
    expect(payload.branchPolicy).toEqual(
      expect.objectContaining({
        branch: "feature/not-allowed",
      })
    );
  });
});
