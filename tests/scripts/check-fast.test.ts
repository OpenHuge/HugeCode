import { chmodSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const nodeShebang = `#!${process.execPath}`;
const rustcVersion = "rustc 1.90.0 (fixture)";

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

async function createFixtureWorkspace(): Promise<string> {
  const workspaceRoot = await realpath(await mkdtemp(path.join(tmpdir(), "check-fast-script-")));
  tempRoots.push(workspaceRoot);

  await mkdir(path.join(workspaceRoot, "scripts", "lib"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "apps", "code-tauri", "scripts"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "apps", "code-tauri", "src-tauri", "src"), {
    recursive: true,
  });
  await mkdir(path.join(workspaceRoot, "bin"), { recursive: true });

  await cp(
    path.join(repoRoot, "apps", "code-tauri", "scripts", "check-fast.mjs"),
    path.join(workspaceRoot, "apps", "code-tauri", "scripts", "check-fast.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "cargo-target-cache.mjs"),
    path.join(workspaceRoot, "scripts", "lib", "cargo-target-cache.mjs")
  );

  await writeFile(
    path.join(workspaceRoot, "pnpm-workspace.yaml"),
    "packages:\n  - apps/*\n",
    "utf8"
  );
  await writeFile(
    path.join(workspaceRoot, "apps", "code-tauri", "src-tauri", "Cargo.toml"),
    [
      "[package]",
      'name = "code-tauri"',
      'version = "0.1.0"',
      'edition = "2021"',
      "",
      "[dependencies]",
      "",
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(workspaceRoot, "apps", "code-tauri", "src-tauri", "src", "main.rs"),
    "fn main() {}\n",
    "utf8"
  );

  await writeCommandShim(workspaceRoot, "cargo", [
    'const fs = require("node:fs");',
    'fs.appendFileSync(process.env.CARGO_LOG_PATH, `cargo ${process.argv.slice(2).join(" ")}\\n`, "utf8");',
  ]);
  await writeCommandShim(workspaceRoot, "rustc", [
    `process.stdout.write(${JSON.stringify(`${rustcVersion}\n`)});`,
  ]);

  return workspaceRoot;
}

async function writeCommandShim(
  workspaceRoot: string,
  commandName: string,
  bodyLines: string[]
): Promise<void> {
  const scriptPath = path.join(workspaceRoot, "bin", commandName);
  await writeFile(scriptPath, `${nodeShebang}\n${bodyLines.join("\n")}\n`, "utf8");
  chmodSync(scriptPath, 0o755);

  if (process.platform === "win32") {
    const cmdShimPath = path.join(workspaceRoot, "bin", `${commandName}.cmd`);
    await writeFile(
      cmdShimPath,
      `@echo off\r\n"${process.execPath}" "%~dp0\\${commandName}" %*\r\n`,
      "utf8"
    );
    chmodSync(cmdShimPath, 0o755);
  }
}

async function computeRustSignature(rustRoot: string): Promise<string> {
  const trackedConfig = new Set(["Cargo.toml", "Cargo.lock", "tauri.conf.json", "build.rs"]);
  const files: string[] = [];
  await scanRustFiles(rustRoot, files, trackedConfig);
  files.sort();

  const hash = createHash("sha256");
  for (const filePath of files) {
    const content = await readFile(filePath);
    hash.update(path.relative(rustRoot, filePath));
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function scanRustFiles(
  dir: string,
  files: string[],
  trackedConfig: Set<string>,
  rustRoot = dir
): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "target" && entry.name !== ".git") {
        await scanRustFiles(absolutePath, files, trackedConfig, rustRoot);
      }
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith(".rs") || trackedConfig.has(path.relative(rustRoot, absolutePath)))
    ) {
      files.push(absolutePath);
    }
  }
}

describe("code-tauri check-fast script", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        const { rm } = await import("node:fs/promises");
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("skips duplicate cargo check after waiting for the shared target-dir lock", async () => {
    const workspaceRoot = await createFixtureWorkspace();
    const appRoot = path.join(workspaceRoot, "apps", "code-tauri");
    const rustRoot = path.join(appRoot, "src-tauri");
    const cacheFile = path.join(appRoot, ".cache", "check-fast-cache.json");
    const cargoLogPath = path.join(workspaceRoot, "cargo.log");
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const signature = await computeRustSignature(rustRoot);
    const lockHolderModuleUrl = pathToFileURL(
      path.join(workspaceRoot, "scripts", "lib", "cargo-target-cache.mjs")
    ).href;

    await mkdir(path.dirname(cargoLogPath), { recursive: true });
    await writeFile(cargoLogPath, "", "utf8");

    const lockHolder = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `import { mkdirSync, writeFileSync } from "node:fs";`,
          `import path from "node:path";`,
          `const { acquireCargoTargetGuardLock } = await import(${JSON.stringify(lockHolderModuleUrl)});`,
          `const targetDir = ${JSON.stringify(targetDir)};`,
          `const cacheFile = ${JSON.stringify(cacheFile)};`,
          `const releaseLock = acquireCargoTargetGuardLock({ targetDir, timeoutMs: 5_000, pollMs: 10 });`,
          `process.stdout.write("locked\\n");`,
          `setTimeout(() => {`,
          `  mkdirSync(path.dirname(cacheFile), { recursive: true });`,
          `  writeFileSync(cacheFile, JSON.stringify({`,
          `    signature: ${JSON.stringify(signature)},`,
          `    rustcVersion: ${JSON.stringify(rustcVersion)},`,
          `    targetDir,`,
          `    checkedAt: new Date().toISOString(),`,
          `    elapsedMs: 12,`,
          `  }, null, 2), "utf8");`,
          `}, 500);`,
          `setTimeout(() => { releaseLock(); }, 3_000);`,
          `setTimeout(() => process.exit(0), 3_200);`,
        ].join("\n"),
      ],
      {
        cwd: workspaceRoot,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    const lockHolderExit = new Promise<void>((resolve, reject) => {
      let stderr = "";
      lockHolder.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      lockHolder.on("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `lock holder failed with code ${code ?? "null"} signal ${signal ?? "null"}: ${stderr}`
          )
        );
      });
      lockHolder.on("error", reject);
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timed out waiting for lock holder to acquire the cargo target lock"));
      }, 5_000);
      let observedLock = false;
      lockHolder.stdout.on("data", (chunk) => {
        if (!chunk.toString().includes("locked")) {
          return;
        }
        observedLock = true;
        clearTimeout(timeout);
        resolve();
      });
      lockHolder.on("exit", (code, signal) => {
        clearTimeout(timeout);
        if (observedLock) {
          return;
        }
        reject(
          new Error(
            `lock holder exited before announcing readiness with code ${code ?? "null"} signal ${signal ?? "null"}`
          )
        );
      });
      lockHolder.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const result = spawnSync(process.execPath, [path.join(appRoot, "scripts", "check-fast.mjs")], {
      cwd: appRoot,
      env: {
        ...withPrependedPath(process.env, path.join(workspaceRoot, "bin")),
        CARGO_LOG_PATH: cargoLogPath,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /another process already checked the current Rust inputs|no Rust source\/config change detected/
    );
    expect(await readFile(cargoLogPath, "utf8")).toBe("");
    await lockHolderExit;
  });
});
