import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

async function createTempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function copyBranchPolicyFixture(targetRoot: string): Promise<void> {
  await mkdir(path.join(targetRoot, "scripts", "lib"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "check-branch-policy.mjs"),
    path.join(targetRoot, "scripts", "check-branch-policy.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "check-output.mjs"),
    path.join(targetRoot, "scripts", "lib", "check-output.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "branch-policy.mjs"),
    path.join(targetRoot, "scripts", "lib", "branch-policy.mjs")
  );
}

function runBranchPolicy(targetRoot: string, args: string[]) {
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "check-branch-policy.mjs"), ...args],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-branch-policy", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("passes for exempt long-lived branches", async () => {
    const tempRoot = await createTempRoot("branch-policy-main-");
    await copyBranchPolicyFixture(tempRoot);

    const result = runBranchPolicy(tempRoot, ["--branch", "main"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Branch policy check passed.");
  });

  it("passes for valid working branches", async () => {
    const tempRoot = await createTempRoot("branch-policy-feat-");
    await copyBranchPolicyFixture(tempRoot);

    const result = runBranchPolicy(tempRoot, ["--branch", "feat/git-workflow-hardening"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("feat/git-workflow-hardening");
  });

  it("passes for GitHub merge-queue synthetic branches", async () => {
    const tempRoot = await createTempRoot("branch-policy-merge-queue-");
    await copyBranchPolicyFixture(tempRoot);

    const result = runBranchPolicy(tempRoot, [
      "--branch",
      "gh-readonly-queue/main/pr-116-e4a318d53ad75eaa223ebb2e6d499b57edbd4400",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("exempt merge-queue branch");
  });

  it("fails for invalid working branch prefixes", async () => {
    const tempRoot = await createTempRoot("branch-policy-invalid-");
    await copyBranchPolicyFixture(tempRoot);

    const result = runBranchPolicy(tempRoot, ["--branch", "feature/git-workflow-hardening"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("feature/git-workflow-hardening");
    expect(result.stderr).toContain("feat|fix|docs|chore|refactor|test|perf|hotfix");
  });

  it("emits structured json for invalid branches", async () => {
    const tempRoot = await createTempRoot("branch-policy-json-");
    await copyBranchPolicyFixture(tempRoot);

    const result = runBranchPolicy(tempRoot, ["--branch", "badbranch", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      check: string;
      errors: string[];
      details?: { branch?: string | null };
    };

    expect(result.status).toBe(1);
    expect(payload.ok).toBe(false);
    expect(payload.check).toBe("check-branch-policy");
    expect(payload.errors[0]).toContain("badbranch");
    expect(payload.details?.branch).toBe("badbranch");
  });
});
