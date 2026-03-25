import { spawnSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

async function copyDiagnoseFixture(targetRoot: string): Promise<void> {
  await mkdir(path.join(targetRoot, "scripts", "lib"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "diagnose-project.mjs"),
    path.join(targetRoot, "scripts", "diagnose-project.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "branch-policy.mjs"),
    path.join(targetRoot, "scripts", "lib", "branch-policy.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "packages-workspace-hygiene.mjs"),
    path.join(targetRoot, "scripts", "lib", "packages-workspace-hygiene.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "check-output.mjs"),
    path.join(targetRoot, "scripts", "lib", "check-output.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "git-base-ref.mjs"),
    path.join(targetRoot, "scripts", "lib", "git-base-ref.mjs")
  );
}

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

function withPrependedPath(env: NodeJS.ProcessEnv, prependDir: string): NodeJS.ProcessEnv {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
  const nextEnv: NodeJS.ProcessEnv = {
    ...env,
    [pathKey]: `${prependDir}${path.delimiter}${env[pathKey] ?? ""}`,
  };

  for (const key of Object.keys(nextEnv)) {
    if (key !== pathKey && key.toLowerCase() === "path") {
      delete nextEnv[key];
    }
  }

  return nextEnv;
}

function runDiagnose(targetRoot: string) {
  const pnpmBinDir = path.join(targetRoot, ".test-bin");
  return spawnSync(process.execPath, [path.join(targetRoot, "scripts", "diagnose-project.mjs")], {
    cwd: targetRoot,
    encoding: "utf8",
    env: withPrependedPath(process.env, pnpmBinDir),
  });
}

async function installFakePnpm(targetRoot: string, mode: "clean" | "mutated") {
  const binDir = path.join(targetRoot, ".test-bin");
  await mkdir(binDir, { recursive: true });

  const scriptPath = path.join(binDir, "pnpm");
  const mutatedOutput =
    "ERR_PNPM_MODIFIED_DEPENDENCY Packages in the store have been mutated\\n\\nThese packages are modified:\\nrollup@4.59.0\\nstorybook@10.2.13\\n";
  const script = `#!/bin/sh
if [ "$1" = "store" ] && [ "$2" = "status" ]; then
  ${mode === "mutated" ? `printf '${mutatedOutput}' 1>&2\n  exit 1` : "exit 0"}
fi
echo "Unexpected pnpm invocation: $@" 1>&2
exit 1
`;
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);

  if (process.platform === "win32") {
    const cmdShimPath = path.join(binDir, "pnpm.cmd");
    const cmdShim = `@echo off
if "%1"=="store" if "%2"=="status" (
${mode === "mutated" ? "  1>&2 echo ERR_PNPM_MODIFIED_DEPENDENCY Packages in the store have been mutated\r\n  1>&2 echo.\r\n  1>&2 echo These packages are modified:\r\n  1>&2 echo rollup@4.59.0\r\n  1>&2 echo storybook@10.2.13\r\n  exit /b 1" : "  exit /b 0"}
)
1>&2 echo Unexpected pnpm invocation: %*
exit /b 1
`;
    await writeFile(cmdShimPath, cmdShim, "utf8");
    await chmod(cmdShimPath, 0o755);
  }
}

async function createFixtureRepo(prefix: string, pnpmMode: "clean" | "mutated" = "clean") {
  const tempRoot = await createTempRoot(prefix);
  await copyDiagnoseFixture(tempRoot);
  await installFakePnpm(tempRoot, pnpmMode);

  await mkdir(path.join(tempRoot, "packages", "code-runtime-service-rs", "src"), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });

  await writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify(
      {
        name: "diagnose-project-fixture",
        private: true,
        scripts: {
          "repo:doctor": "node scripts/diagnose-project.mjs",
          "preflight:codex": "node scripts/codex-preflight.mjs",
          "check:branch-policy": "node scripts/check-branch-policy.mjs",
          "collab:status": "node scripts/collab-sync-loop.mjs --status-only --json",
          "collab:sync": "node scripts/collab-sync-loop.mjs",
          "collab:sync:fast": "node scripts/collab-sync-loop.mjs --validate-profile fast",
          "collab:sync:full": "node scripts/collab-sync-loop.mjs --validate-profile full",
          validate: "node scripts/validate.mjs",
          "validate:fast": "node scripts/validate.mjs --targeted-only --skip-typecheck",
          "test:e2e:collab": "node scripts/run-e2e-category.mjs collab",
        },
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "dev-code-runtime-gateway-web-all.mjs"),
    'process.env.CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC ?? "0";\n',
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "validate.mjs"),
    "console.log('validate');\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "scripts", "check-rust-file-size.mjs"),
    "console.log('rust-size');\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "turn_runtime_plan.rs"),
    "// fixture\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "local_codex_exec_turn.rs"),
    "// fixture\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "live_skills.rs"),
    "// fixture\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "provider_requests.rs"),
    "// fixture\n",
    "utf8"
  );

  runGit(tempRoot, ["init", "--initial-branch=main"]);
  runGit(tempRoot, ["config", "user.name", "Codex"]);
  runGit(tempRoot, ["config", "user.email", "codex@example.com"]);
  runGit(tempRoot, ["add", "-A"]);
  runGit(tempRoot, ["commit", "-m", "fixture"]);

  return tempRoot;
}

describe("diagnose-project", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("prints workflow and branch policy diagnostics", async () => {
    const tempRoot = await createFixtureRepo("diagnose-project-");

    const result = runDiagnose(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Branch policy");
    expect(result.stdout).toContain("Comparison base");
    expect(result.stdout).toContain("Workflow scripts");
    expect(result.stdout).toContain('Branch "main" is exempt');
  });

  it("reports the sibling branch as the comparison base for a clean stacked branch", async () => {
    const tempRoot = await createFixtureRepo("diagnose-project-stacked-");
    runGit(tempRoot, ["checkout", "-b", "feat/parent"]);
    await writeFile(
      path.join(tempRoot, "packages", "code-runtime-service-rs", "src", "parent.rs"),
      "// parent\n",
      "utf8"
    );
    runGit(tempRoot, ["add", "-A"]);
    runGit(tempRoot, ["commit", "-m", "parent change"]);
    runGit(tempRoot, ["checkout", "-b", "feat/stacked-worktree"]);

    const result = runDiagnose(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Comparison base");
    expect(result.stdout).toContain("feat/parent");
    expect(result.stdout).toContain("sibling-local");
  });

  it("fails when pnpm store status reports mutated packages", async () => {
    const tempRoot = await createFixtureRepo("diagnose-project-mutated-", "mutated");

    const result = runDiagnose(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("pnpm store");
    expect(result.stdout).toContain("mutated");
    expect(result.stdout).toContain("pnpm install --force");
  });
});
