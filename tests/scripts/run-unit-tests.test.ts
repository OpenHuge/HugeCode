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
  const tempRoot = await mkdtemp(path.join(tmpdir(), "run-unit-tests-"));
  tempRoots.push(tempRoot);

  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await mkdir(path.join(tempRoot, "bin"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "run-unit-tests.mjs"),
    path.join(tempRoot, "scripts", "run-unit-tests.mjs")
  );

  await writeCommandShim(tempRoot, "pnpm");
  return tempRoot;
}

async function writeCommandShim(targetRoot: string, commandName: string): Promise<void> {
  const binDir = path.join(targetRoot, "bin");
  const scriptBody = `${nodeShebang}
const fs = require("node:fs");
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

async function writeCommandBehavior(
  targetRoot: string,
  rules: Array<Record<string, unknown>>
): Promise<string> {
  const behaviorPath = path.join(targetRoot, "command-behavior.json");
  await writeFile(behaviorPath, `${JSON.stringify({ rules }, null, 2)}\n`, "utf8");
  return behaviorPath;
}

function runUnitTests(targetRoot: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const commandLogPath = path.join(targetRoot, "command-invocations.log");
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "run-unit-tests.mjs"), ...args],
    {
      cwd: targetRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        ...env,
        PATH: `${path.join(targetRoot, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
        COMMAND_LOG_PATH: commandLogPath,
      },
    }
  );
}

async function readCommandLog(targetRoot: string) {
  return readFile(path.join(targetRoot, "command-invocations.log"), "utf8");
}

describe("run-unit-tests.mjs", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("runs root-only tests first and then workspace tests through Turbo", async () => {
    const tempRoot = await createFixtureRepo();

    const result = runUnitTests(tempRoot, []);
    const commandLog = await readCommandLog(tempRoot);
    const commandLines = commandLog.trim().split(/\r?\n/u);

    expect(result.status).toBe(0);
    expect(commandLines).toHaveLength(2);
    expect(commandLines[0]).toBe("pnpm exec vitest run --config vitest.root.config.ts");
    expect(commandLines[1]).toContain("pnpm exec turbo run test");
    expect(commandLines[1]).toContain("--filter=@ku0/code");
    expect(commandLines[1]).toContain("--filter=@ku0/code-workspace-client");
    expect(commandLines[1]).toContain("--filter=@ku0/shared");
    expect(commandLog).not.toContain("--maxWorkers=1");
  });

  it("forwards coverage flags to both the root and workspace runners", async () => {
    const tempRoot = await createFixtureRepo();

    const result = runUnitTests(tempRoot, ["--coverage"]);
    const commandLog = await readCommandLog(tempRoot);

    expect(result.status).toBe(0);
    expect(commandLog).toContain("pnpm exec vitest run --config vitest.root.config.ts --coverage");
    expect(commandLog).toContain("pnpm exec turbo run test");
    expect(commandLog).toContain("-- --coverage");
  });

  it("fails fast when the root test phase fails", async () => {
    const tempRoot = await createFixtureRepo();
    const behaviorPath = await writeCommandBehavior(tempRoot, [
      {
        match: "pnpm exec vitest run --config vitest.root.config.ts",
        action: "fail",
        exitCode: 7,
      },
    ]);

    const result = runUnitTests(tempRoot, [], { COMMAND_BEHAVIOR_PATH: behaviorPath });
    const commandLog = await readCommandLog(tempRoot);
    const commandLines = commandLog.trim().split(/\r?\n/u);

    expect(result.status).toBe(1);
    expect(commandLines).toHaveLength(1);
    expect(commandLines[0]).toBe("pnpm exec vitest run --config vitest.root.config.ts");
    expect(result.stderr).toContain("Root unit tests failed with exit code 7");
  });
});
