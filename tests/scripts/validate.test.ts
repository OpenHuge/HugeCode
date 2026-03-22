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
  const tempRoot = await mkdtemp(path.join(tmpdir(), "validate-script-"));
  tempRoots.push(tempRoot);

  await mkdir(path.join(tempRoot, "scripts", "lib"), { recursive: true });
  await mkdir(path.join(tempRoot, "bin"), { recursive: true });
  await mkdir(path.join(tempRoot, "apps", "code", "src", "styles"), {
    recursive: true,
  });
  await mkdir(path.join(tempRoot, "packages", "code-runtime-host-contract", "src"), {
    recursive: true,
  });

  await cp(
    path.join(repoRoot, "scripts", "validate.mjs"),
    path.join(tempRoot, "scripts", "validate.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "e2e-map.mjs"),
    path.join(tempRoot, "scripts", "lib", "e2e-map.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "validate-temp-config.mjs"),
    path.join(tempRoot, "scripts", "lib", "validate-temp-config.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "windows-host.mjs"),
    path.join(tempRoot, "scripts", "lib", "windows-host.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "process-tree.mjs"),
    path.join(tempRoot, "scripts", "lib", "process-tree.mjs")
  );
  await writeStyleBudgetProbeScript(tempRoot);
  await writeNoOpScript(tempRoot, "scripts/check-style-color-tokens.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-style-color-sot.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-style-semantic-primitives.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-frontend-file-size.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-no-wildcard-exports.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-style-stack.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-style-module-file-names.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-duplicate-global-selectors.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-stale-style-selectors.mjs");
  await writeNoOpScript(tempRoot, "scripts/check-global-style-boundary.mjs");
  await writeFile(
    path.join(tempRoot, "apps", "code", "src", "styles", "example.css.ts"),
    'export const example = "example";\n',
    "utf8"
  );

  await writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify(
      {
        name: "validate-fixture",
        private: true,
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "apps", "code", "package.json"),
    JSON.stringify(
      {
        name: "@fixture/code",
        private: true,
        scripts: {
          test: "vitest run --config vitest.config.ts",
        },
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "apps", "code", "vitest.config.ts"),
    "export default {};\n",
    "utf8"
  );
  await mkdir(path.join(tempRoot, "packages", "demo", "src"), { recursive: true });
  await writeFile(
    path.join(tempRoot, "packages", "demo", "package.json"),
    JSON.stringify(
      {
        name: "@fixture/demo",
        private: true,
        scripts: {
          test: "vitest run --config vitest.config.ts",
        },
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "packages", "demo", "vitest.config.ts"),
    "export default {};\n",
    "utf8"
  );
  await writeFile(
    path.join(tempRoot, "packages", "code-runtime-host-contract", "src", "codeRuntimeRpc.ts"),
    'export const CODE_RUNTIME_RPC_CONTRACT_VERSION = "test-fixture";\n',
    "utf8"
  );

  await writeCommandShim(tempRoot, "pnpm");
  await writeCommandShim(tempRoot, "node");

  runGit(tempRoot, ["init", "--initial-branch=main"]);
  runGit(tempRoot, ["config", "user.name", "Codex"]);
  runGit(tempRoot, ["config", "user.email", "codex@example.com"]);
  runGit(tempRoot, ["add", "-A"]);
  runGit(tempRoot, ["commit", "-m", "fixture"]);

  return tempRoot;
}

async function writeRepoFile(targetRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function writeCommandShim(targetRoot: string, commandName: string): Promise<void> {
  const binDir = path.join(targetRoot, "bin");
  const scriptBody = `${nodeShebang}
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const args = process.argv.slice(2).join(" ");
const commandLine = \`${commandName} \${args}\`;
fs.appendFileSync(process.env.COMMAND_LOG_PATH, \`\${commandLine}\\n\`, "utf8");
const behaviorPath = process.env.COMMAND_BEHAVIOR_PATH;
let matchedRule = null;
if (behaviorPath && fs.existsSync(behaviorPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(behaviorPath, "utf8"));
    const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
    matchedRule =
      rules.find(
        (rule) =>
          rule &&
          typeof rule === "object" &&
          typeof rule.match === "string" &&
          commandLine.includes(rule.match)
      ) ?? null;
  } catch {}
}
if (matchedRule?.spawnChild === true) {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  if (typeof matchedRule.childPidFile === "string" && matchedRule.childPidFile.length > 0) {
    fs.writeFileSync(matchedRule.childPidFile, String(child.pid), "utf8");
  }
  fs.appendFileSync(process.env.COMMAND_LOG_PATH, \`spawned-child \${child.pid}\\n\`, "utf8");
}
if (matchedRule?.action === "hang") {
  setInterval(() => {}, 1000);
}
if (matchedRule?.action === "sleep") {
  const delayMs =
    Number.isFinite(Number(matchedRule.delayMs)) && Number(matchedRule.delayMs) > 0
      ? Number(matchedRule.delayMs)
      : 1000;
  setTimeout(() => {
    process.exit(Number.isInteger(matchedRule.exitCode) ? matchedRule.exitCode : 0);
  }, delayMs);
}
if (matchedRule?.action === "fail") {
  process.exit(Number.isInteger(matchedRule.exitCode) ? matchedRule.exitCode : 1);
}
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

async function writeNoOpScript(targetRoot: string, relativePath: string): Promise<void> {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, "export {};\n", "utf8");
}

async function writeStyleBudgetProbeScript(targetRoot: string): Promise<void> {
  const targetPath = path.join(targetRoot, "scripts", "check-style-budgets.mjs");
  await writeFile(
    targetPath,
    [
      'import { appendFileSync } from "node:fs";',
      'appendFileSync(process.env.COMMAND_LOG_PATH, "style-budget-ran\\n", "utf8");',
      "",
    ].join("\n"),
    "utf8"
  );
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

function runValidate(targetRoot: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const commandLogPath = path.join(targetRoot, "command-invocations.log");
  return spawnSync(process.execPath, [path.join(targetRoot, "scripts", "validate.mjs"), ...args], {
    cwd: targetRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      PATH: `${path.join(targetRoot, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      COMMAND_LOG_PATH: commandLogPath,
    },
  });
}

async function writeCommandBehavior(
  targetRoot: string,
  rules: Array<Record<string, unknown>>
): Promise<string> {
  const behaviorPath = path.join(targetRoot, "command-behavior.json");
  await writeFile(behaviorPath, `${JSON.stringify({ rules }, null, 2)}\n`, "utf8");
  return behaviorPath;
}

async function readCommandLog(targetRoot: string) {
  return readFile(path.join(targetRoot, "command-invocations.log"), "utf8").catch(
    (error: NodeJS.ErrnoException) => (error.code === "ENOENT" ? "" : Promise.reject(error))
  );
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const VALIDATE_SCRIPT_TEST_TIMEOUT_MS = 60_000;

describe("validate.mjs", { timeout: VALIDATE_SCRIPT_TEST_TIMEOUT_MS }, () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("runs the full gate on a clean checkout when --full is requested", async () => {
    const tempRoot = await createFixtureRepo();

    const result = runValidate(tempRoot, ["--full"]);
    const commandLog = await readFile(path.join(tempRoot, "command-invocations.log"), "utf8");

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:workflow-governance");
    expect(commandLog).toContain("pnpm check:app-circular");
    expect(commandLog).toContain("pnpm check:frontend-file-size:all");
    expect(commandLog).toContain("pnpm check:style-boundary:all");
    expect(commandLog).toContain("pnpm typecheck");
    expect(commandLog).toContain("pnpm test:unit");
    expect(commandLog).not.toContain("node scripts/check-style-color-sot.mjs --all");
    expect(commandLog).not.toContain("node scripts/check-style-semantic-primitives.mjs --all");
    expect(commandLog).not.toContain("node scripts/check-inline-styles.mjs");
    expect(commandLog).not.toContain("node scripts/check-style-stack.mjs");
    if (process.platform !== "win32") {
      expect(commandLog).toContain("node scripts/check-style-color-tokens.mjs");
    }
  });

  it("keeps self-covered guard script changes on targeted validation", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "scripts/check-runtime-sot.mjs", "export {};\n");

    const result = runValidate(tempRoot, []);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("node scripts/check-runtime-sot.mjs");
    expect(commandLog).toContain("pnpm exec oxlint --no-ignore scripts/check-runtime-sot.mjs");
    expect(commandLog).not.toContain("pnpm check:workflow-governance");
    expect(commandLog).not.toContain("pnpm lint");
    expect(commandLog).not.toContain("pnpm format:check");
    expect(commandLog).not.toContain("pnpm typecheck");
    expect(commandLog).not.toContain("pnpm test:unit");
  });

  it("keeps workflow-only changes on targeted validation and runs governance directly", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      ".github/workflows/quality.yml",
      ["name: Quality", "on: [push]", "jobs: {}", ""].join("\n")
    );

    const result = runValidate(tempRoot, []);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:workflow-governance");
    expect(commandLog).not.toContain("pnpm lint");
    expect(commandLog).not.toContain("pnpm format:check");
    expect(commandLog).not.toContain("pnpm typecheck");
    expect(commandLog).not.toContain("pnpm test:unit");
  });

  it("keeps repo-wide unit tests for workspace package manifest changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "packages/demo/package.json",
      `${JSON.stringify(
        {
          name: "@fixture/demo",
          private: true,
          scripts: {
            test: "vitest run --config vitest.config.ts",
            lint: "echo lint",
          },
        },
        null,
        2
      )}\n`
    );

    const result = runValidate(tempRoot, []);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm test:unit");
  });

  it("still skips when there are no local changes and --full is not requested", async () => {
    const tempRoot = await createFixtureRepo();

    const result = runValidate(tempRoot, []);
    const commandLogPath = path.join(tempRoot, "command-invocations.log");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(
      await readFile(commandLogPath, "utf8").catch((error: NodeJS.ErrnoException) =>
        error.code === "ENOENT" ? "" : Promise.reject(error)
      )
    ).toBe("");
  });

  it("uses dedicated validate guard coverage for validate-script-only changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/validate.mjs",
      `${await readFile(path.join(tempRoot, "scripts", "validate.mjs"), "utf8")}\n`
    );
    await writeRepoFile(
      tempRoot,
      "tests/scripts/validate.test.ts",
      `${await readFile(path.join(repoRoot, "tests", "scripts", "validate.test.ts"), "utf8")}\n`
    );

    const result = runValidate(tempRoot, []);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm exec vitest run tests/scripts/validate.test.ts");
    expect(commandLog).not.toContain("pnpm exec vitest related --run --passWithNoTests");
    expect(commandLog).not.toContain("pnpm check:workflow-governance");
    expect(commandLog).not.toContain("pnpm check:app-circular");
    expect(commandLog).not.toContain("pnpm check:frontend-file-size:all");
    expect(commandLog).not.toContain("pnpm check:style-boundary:all");
    expect(commandLog).not.toContain("pnpm typecheck");
    expect(commandLog).not.toContain("pnpm test:unit");
  });

  it("skips repo-wide style budget checks during targeted validation for ordinary style changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/styles/example.css.ts",
      'export const example = "changed";\n'
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).not.toContain("node scripts/check-style-budgets.mjs");
    expect(commandLog).not.toContain("pnpm code:build");
  });

  it("uses change-aware style color checks during standard validation", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/styles/example.css.ts",
      'export const example = "changed";\n'
    );

    const result = runValidate(tempRoot, ["--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("node scripts/check-style-color-tokens.mjs");
    expect(commandLog).not.toContain("node scripts/check-style-color-tokens.mjs --all");
    expect(commandLog).toContain("node scripts/check-style-color-sot.mjs");
    expect(commandLog).not.toContain("node scripts/check-style-color-sot.mjs --all");
    expect(commandLog).toContain("node scripts/check-style-semantic-primitives.mjs");
    expect(commandLog).not.toContain("node scripts/check-style-semantic-primitives.mjs --all");
  });

  it("does not run the style color token guard during standard validation for non-style changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");

    const result = runValidate(tempRoot, ["--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).not.toContain("node scripts/check-style-color-tokens.mjs");
  });

  it("runs the design-system baseline when app design-system surfaces change", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/ModalShell.tsx",
      "export const ModalShell = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs the design-system ownership guard when app design-system adapter surfaces change", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/adapters/index.ts",
      "export const adapters = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("node scripts/check-design-system-ownership.mjs");
  });

  it("runs the design-system ownership guard when the app design-system root barrel changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/index.ts",
      "export const root = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("node scripts/check-design-system-ownership.mjs");
  });

  it("does not run the design-system baseline for ordinary app style changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/styles/example.css.ts",
      'export const example = "changed-again";\n'
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).not.toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system governance fixture coverage through the design-system baseline", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/check-design-system-governance-fixture-coverage.mjs",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system family contracts through the design-system baseline", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/check-design-system-family-contracts.mjs",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system surface semantics through the design-system baseline", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/check-design-system-surface-semantics.mjs",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system surface semantics through the design-system baseline for new app-owned modal, panel, and shell primitives", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/modal/ModalPrimitives.tsx",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system surface semantics through the design-system baseline for normalized compat bridge primitives", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/design-system/components/popover/PopoverPrimitives.tsx",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system family adoption through the design-system baseline", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/check-design-system-family-adoption.mjs",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system family adoption through the design-system baseline for representative adoption surfaces", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/settings/components/sections/SettingsDisplaySection.tsx",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system family adoption through the design-system baseline for Textarea representative adoption surfaces", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/shared/components/FileEditorCard.tsx",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("runs design-system operator adjunct fixture coverage through the design-system baseline", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/check-design-system-operator-adjunct-fixture-coverage.mjs",
      "export const changed = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm check:design-system:baseline");
  });

  it("still skips repo-wide style budget checks during explicitly overridden targeted validation when budget infrastructure changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "scripts/check-style-budgets.mjs",
      'import { appendFileSync } from "node:fs";\nappendFileSync(process.env.COMMAND_LOG_PATH, "style-budget-ran\\nstyle-budget-edited\\n", "utf8");\n'
    );

    const result = runValidate(tempRoot, [
      "--targeted-only",
      "--allow-risky-targeted",
      "--skip-typecheck",
    ]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).not.toContain("node scripts/check-style-budgets.mjs");
  });

  it("still runs style budget checks during targeted validation when strict mode is enabled", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/styles/example.css.ts",
      'export const example = "changed";\n'
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      STYLE_BUDGET_STRICT: "1",
    });
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("node scripts/check-style-budgets.mjs");
  });

  it("fails fast when --targeted-only is used on a high-impact file without an explicit override", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "package.json",
      `${JSON.stringify(
        {
          name: "validate-fixture",
          private: true,
          scripts: {
            validate: "node scripts/validate.mjs",
          },
        },
        null,
        2
      )}\n`
    );

    const result = runValidate(tempRoot, ["--targeted-only"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--allow-risky-targeted");
    expect(commandLog).toBe("");
  });

  it("does not run frontend optimization build for e2e map config changes", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      ".codex/e2e-map.json",
      `${JSON.stringify({ core: ["tests/e2e/src/core.spec.ts"] }, null, 2)}\n`
    );

    const result = runValidate(tempRoot, []);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).not.toContain("pnpm code:build");
  });

  it("formats changed markdown files during targeted validation when code changes are mixed in", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/styles/example.css.ts",
      'export const example = "changed";\n'
    );
    await writeRepoFile(tempRoot, "docs/notes.md", "# Mixed validation\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("docs/notes.md");
  });

  it("runs the changed test placeholder guard when targeted validation includes a test file", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/example.test.ts",
      "it.only('focused', () => expect(true).toBe(true));\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("node scripts/check-test-placeholders.mjs");
  });

  it("runs changed root-level vitest files directly instead of routing them through vitest related", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "tests/scripts/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm exec vitest run --passWithNoTests tests/scripts/example.test.ts"
    );
    expect(commandLog).not.toContain(
      "pnpm exec vitest related --run --passWithNoTests tests/scripts/example.test.ts"
    );
  });

  it("runs validate script guard tests when validator files change", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "tests/scripts/validate-temp-config.test.ts",
      "it('extra', () => {});\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm exec vitest run tests/scripts/validate.test.ts");
  });

  it("runs the dedicated review-pack regression when runtime review flow files change", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/facades/runtimeRemoteExecutionFacade.ts",
      "export const runtimeRemoteExecutionFacade = true;\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm test:runtime:review-pack-selection");
  });

  it("routes tauri runtime parity checks through the cargo target guard wrapper", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "packages/code-runtime-host-contract/src/codeRuntimeRpc.ts",
      'export const CODE_RUNTIME_RPC_CONTRACT_VERSION = "updated-fixture";\n'
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "node scripts/run-cargo-with-target-guard.mjs --cwd apps/code-tauri/src-tauri test --manifest-path Cargo.toml tests::rpc_capabilities_payload_matches_frozen_spec_and_gap_allowlist"
    );
  });

  it("deduplicates the dedicated review-pack regression from root related runs", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "tests/scripts/review-pack-selection-flow.test.ts",
      "export {};\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm test:runtime:review-pack-selection");
    expect(commandLog).not.toContain(
      "pnpm exec vitest related --run --passWithNoTests tests/scripts/review-pack-selection-flow.test.ts"
    );
  });

  it("runs explicit apps/code test-file targets directly when they finish in time", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/example.test.ts"
    );
    expect(commandLog).not.toContain(
      "pnpm -C apps/code exec vitest related --run --passWithNoTests"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).not.toContain("Falling back to `pnpm -C apps/code test`");
  });

  it("passes through an explicit apps/code direct-test maxWorkers override", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      VALIDATE_APPS_CODE_RELATED_MAX_WORKERS: "50%",
    });
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=50% src/example.test.ts"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code test");
  });

  it("uses the browser-specific apps/code direct-test maxWorkers override when browser targets are present", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.browser.test.tsx", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      VALIDATE_APPS_CODE_RELATED_BROWSER_MAX_WORKERS: "25%",
    });
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=25% src/example.browser.test.tsx"
    );
  });

  it("uses the jsdom-specific apps/code direct-test maxWorkers override when no browser targets are present", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      VALIDATE_APPS_CODE_RELATED_JSDOM_MAX_WORKERS: "60%",
    });
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=60% src/example.test.ts"
    );
  });

  it("runs changed apps/code tests directly and prunes matching source targets during mixed validation", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/example.test.ts"
    );
    expect(commandLog).not.toContain(
      "pnpm -C apps/code exec vitest related --run --passWithNoTests"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("prunes apps/code source targets when a changed qualified colocated test covers the same feature file", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/composer/components/ComposerInput.tsx",
      "export const ComposerInput = 1;\n"
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/composer/components/ComposerInput.lazy.test.tsx",
      "export {};\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/features/composer/components/ComposerInput.lazy.test.tsx"
    );
    expect(commandLog).not.toContain(
      "pnpm -C apps/code exec vitest related --run --passWithNoTests --maxWorkers=75% src/features/composer/components/ComposerInput.tsx"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("falls back to the apps/code package test when uncovered source targets remain", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");
    await writeRepoFile(tempRoot, "apps/code/src/other.ts", "export const other = 2;\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm -C apps/code test");
    expect(commandLog).not.toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/example.test.ts"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(result.stderr).toContain("[validate] apps/code incremental dedupe:");
    expect(result.stderr).toContain("[validate] apps/code incremental fallback:");
  });

  it("runs the apps/code package fallback only once when more than one outer chunk is needed", async () => {
    const tempRoot = await createFixtureRepo();
    for (let index = 0; index < 81; index += 1) {
      await writeRepoFile(
        tempRoot,
        `apps/code/src/example-${index}.ts`,
        `export const value${index} = ${index};\n`
      );
    }

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog.match(/pnpm -C apps\/code test/g)?.length).toBe(1);
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(result.stderr).toContain("[validate] apps/code incremental fallback:");
  });

  it("prunes deeper apps/code source targets when changed tests already cover the same feature scope", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/types/autoDrive.ts",
      "export const autoDrive = 1;\n"
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/facades/runtimeAutoDriveContext.test.ts",
      "export {};\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/application/runtime/facades/runtimeAutoDriveContext.test.ts"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("prunes apps/code test-support helpers when changed colocated tests already cover them", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/services/exampleTestUtils.ts",
      "export const helper = 1;\n"
    );
    await writeRepoFile(tempRoot, "apps/code/src/services/example-a.test.ts", "export {};\n");
    await writeRepoFile(tempRoot, "apps/code/src/services/example-b.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/services/example-a.test.ts src/services/example-b.test.ts"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("routes standalone apps/code source changes to matching tracked test files", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/example.test.ts"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("routes standalone apps/code runtime source changes to the runtime test slice", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/facades/runtimeAgentControlFacade.ts",
      "export const runtimeAgentControlFacade = 1;\n"
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/facades/runtimeMissionControlFacade.test.ts",
      "export {};\n"
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/ports/tauriAppSettings.test.ts",
      "export {};\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/application/runtime/facades/runtimeMissionControlFacade.test.ts"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("routes apps/code shared test helpers to the local settings test slice", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/settings/components/SettingsView.test.shared.tsx",
      "export const shared = true;\n"
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/settings/components/SettingsView.test.tsx",
      "export {};\n"
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/features/settings/components/sections/SettingsGitSection.test.tsx",
      "export {};\n"
    );

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C apps/code exec vitest run --passWithNoTests --maxWorkers=75% src/features/settings/components/sections/SettingsGitSection.test.tsx src/features/settings/components/SettingsView.test.tsx"
    );
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(commandLog).not.toContain("pnpm -C apps/code test");
    expect(result.stderr).toContain("[validate] apps/code incremental pruning:");
  });

  it("skips unchanged apps/code targeted validation on a cache hit", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    await writeRepoFile(tempRoot, "apps/code/src/example.test.ts", "export {};\n");

    const firstResult = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    expect(firstResult.status).toBe(0);

    const secondResult = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(secondResult.status).toBe(0);
    expect(commandLog.match(/pnpm -C apps\/code exec vitest run --passWithNoTests/g)?.length).toBe(
      1
    );
    expect(secondResult.stderr).toContain("[validate] apps/code targeted-tests cache hit:");
  });

  it("preserves apps/code targeted cache hits when direct targets span more than one outer chunk", async () => {
    const tempRoot = await createFixtureRepo();
    for (let index = 0; index < 81; index += 1) {
      await writeRepoFile(tempRoot, `apps/code/src/example-${index}.test.ts`, "export {};\n");
    }

    const firstResult = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    expect(firstResult.status).toBe(0);

    const secondResult = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(secondResult.status).toBe(0);
    expect(commandLog.match(/pnpm -C apps\/code exec vitest run --passWithNoTests/g)?.length).toBe(
      2
    );
    expect(secondResult.stderr).toContain("[validate] apps/code targeted-tests cache hit:");
  });

  it("falls back to the apps/code package test when no direct slice can be derived", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm -C apps/code test");
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(result.stderr).toContain("[validate] apps/code incremental fallback:");
  });

  it("fails validation when the apps/code package fallback test fails", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    const behaviorPath = await writeCommandBehavior(tempRoot, [
      {
        match: "pnpm -C apps/code test",
        action: "fail",
        exitCode: 3,
      },
    ]);

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      COMMAND_BEHAVIOR_PATH: behaviorPath,
    });
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(1);
    expect(commandLog).toContain("pnpm -C apps/code test");
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(result.stderr).toContain("Vitest fallback full package test (apps/code) failed");
  });

  it("fails deterministically when the apps/code package fallback test times out", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    const behaviorPath = await writeCommandBehavior(tempRoot, [
      {
        match: "pnpm -C apps/code test",
        action: "hang",
      },
    ]);

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      COMMAND_BEHAVIOR_PATH: behaviorPath,
      VALIDATE_APPS_CODE_FALLBACK_TIMEOUT_MS: "50",
    });
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(1);
    expect(commandLog).toContain("pnpm -C apps/code test");
    expect(commandLog).not.toContain("pnpm -C apps/code exec vitest related --run");
    expect(result.stderr).toContain("Vitest fallback full package test (apps/code) timed out");
  });

  it("leaves non-apps/code packages on vitest related without triggering the fallback", async () => {
    const tempRoot = await createFixtureRepo();
    await writeRepoFile(tempRoot, "packages/demo/src/example.test.ts", "export {};\n");

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain(
      "pnpm -C packages/demo exec vitest related --run --passWithNoTests"
    );
    expect(commandLog).not.toContain("pnpm -C packages/demo test");
  });

  it("kills descendant processes when the apps/code package fallback test times out", async () => {
    const tempRoot = await createFixtureRepo();
    const childPidFile = path.join(tempRoot, "hung-child.pid");
    await writeRepoFile(tempRoot, "apps/code/src/example.ts", "export const value = 1;\n");
    const behaviorPath = await writeCommandBehavior(tempRoot, [
      {
        match: "pnpm -C apps/code test",
        action: "hang",
        spawnChild: true,
        childPidFile,
      },
    ]);

    const result = runValidate(tempRoot, ["--targeted-only", "--skip-typecheck"], {
      COMMAND_BEHAVIOR_PATH: behaviorPath,
      VALIDATE_APPS_CODE_FALLBACK_TIMEOUT_MS: "50",
    });
    const commandLog = await readCommandLog(tempRoot);
    const childPid = Number.parseInt(await readFile(childPidFile, "utf8"), 10);

    expect(result.status).toBe(1);
    expect(commandLog).toContain("spawned-child");
    expect(Number.isInteger(childPid)).toBe(true);
    expect(isPidAlive(childPid)).toBe(false);
  });
});
