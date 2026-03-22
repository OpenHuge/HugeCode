import { chmodSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const nodeShebang = `#!${process.execPath}`;
const runtimeBinaryName =
  process.platform === "win32" ? "code-runtime-service-rs.exe" : "code-runtime-service-rs";

async function createFixtureWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "runtime-service-dev-"));
  tempRoots.push(workspaceRoot);

  await mkdir(path.join(workspaceRoot, "scripts", "lib"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "packages", "code-runtime-service-rs", "scripts"), {
    recursive: true,
  });
  await mkdir(path.join(workspaceRoot, "bin"), { recursive: true });

  await cp(
    path.join(repoRoot, "packages", "code-runtime-service-rs", "scripts", "dev.mjs"),
    path.join(workspaceRoot, "packages", "code-runtime-service-rs", "scripts", "dev.mjs")
  );
  await cp(
    path.join(repoRoot, "scripts", "lib", "cargo-target-cache.mjs"),
    path.join(workspaceRoot, "scripts", "lib", "cargo-target-cache.mjs")
  );
  await writeFile(
    path.join(workspaceRoot, "packages", "code-runtime-service-rs", "Cargo.toml"),
    [
      "[package]",
      'name = "code-runtime-service-rs"',
      'version = "0.1.0"',
      'edition = "2021"',
      "",
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    path.join(workspaceRoot, "pnpm-workspace.yaml"),
    "packages:\n  - packages/*\n",
    "utf8"
  );

  return workspaceRoot;
}

async function writeShim(targetPath: string, bodyLines: string[]): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${nodeShebang}\n${bodyLines.join("\n")}\n`, "utf8");
  chmodSync(targetPath, 0o755);

  if (process.platform === "win32") {
    const cmdShimPath = `${targetPath}.cmd`;
    await writeFile(
      cmdShimPath,
      `@echo off\r\n"${process.execPath}" "%~dp0\\${path.basename(targetPath)}" %*\r\n`,
      "utf8"
    );
    chmodSync(cmdShimPath, 0o755);
  }
}

describe("code-runtime-service dev script", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        const { rm } = await import("node:fs/promises");
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it.skipIf(process.platform === "win32")(
    "builds behind the shared cargo target guard and runs the built binary directly",
    async () => {
      const workspaceRoot = await createFixtureWorkspace();
      const packageRoot = path.join(workspaceRoot, "packages", "code-runtime-service-rs");
      const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
      const eventLogPath = path.join(workspaceRoot, "events.log");
      const cargoShimPath = path.join(workspaceRoot, "bin", "cargo");
      const runtimeBinaryBody = [
        nodeShebang,
        'const fs = require("node:fs");',
        'fs.appendFileSync(process.env.EVENT_LOG_PATH, `runtime:${Date.now()}:${process.argv.slice(2).join(" ")}\\n`, "utf8");',
        "process.exit(0);",
        "",
      ].join("\n");
      const lockHolderModuleUrl = pathToFileURL(
        path.join(workspaceRoot, "scripts", "lib", "cargo-target-cache.mjs")
      ).href;

      await writeFile(eventLogPath, "", "utf8");
      await writeShim(cargoShimPath, [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        `const targetDir = ${JSON.stringify(targetDir)};`,
        `const runtimeBinaryName = ${JSON.stringify(runtimeBinaryName)};`,
        "const args = process.argv.slice(2);",
        'if (args[0] === "metadata") {',
        '  fs.appendFileSync(process.env.EVENT_LOG_PATH, `cargo:metadata:${Date.now()}\\n`, "utf8");',
        "  process.stdout.write(JSON.stringify({ target_directory: targetDir }));",
        "  process.exit(0);",
        "}",
        'if (args[0] === "build") {',
        '  fs.appendFileSync(process.env.EVENT_LOG_PATH, `cargo:build:${Date.now()}:${args.join(" ")}\\n`, "utf8");',
        '  const binaryPath = path.join(targetDir, "debug", runtimeBinaryName);',
        "  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });",
        `  fs.writeFileSync(binaryPath, ${JSON.stringify(runtimeBinaryBody)}, "utf8");`,
        "  fs.chmodSync(binaryPath, 0o755);",
        "  process.exit(0);",
        "}",
        'process.stderr.write(`unexpected cargo invocation: ${args.join(" ")}\\n`);',
        "process.exit(1);",
      ]);

      const lockHolder = spawn(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          [
            'const fs = await import("node:fs");',
            `const { acquireCargoTargetGuardLock } = await import(${JSON.stringify(lockHolderModuleUrl)});`,
            `const releaseLock = acquireCargoTargetGuardLock({ targetDir: ${JSON.stringify(targetDir)}, timeoutMs: 5_000, pollMs: 10 });`,
            'process.stdout.write("locked\\n");',
            `setTimeout(() => { fs.appendFileSync(${JSON.stringify(eventLogPath)}, \`lock:released:\${Date.now()}\\n\`, "utf8"); releaseLock(); process.exit(0); }, 1000);`,
          ].join("\n"),
        ],
        {
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
          reject(new Error("timed out waiting for lock holder to acquire cargo target lock"));
        }, 5_000);
        let observedLock = false;
        let stderr = "";

        lockHolder.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
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
              `lock holder exited before announcing readiness with code ${code ?? "null"} signal ${signal ?? "null"}: ${stderr}`
            )
          );
        });
        lockHolder.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      const startedAt = Date.now();
      const result = spawnSync(
        process.execPath,
        [path.join(packageRoot, "scripts", "dev.mjs"), "--sample-flag", "123"],
        {
          cwd: packageRoot,
          env: {
            ...process.env,
            EVENT_LOG_PATH: eventLogPath,
            PATH: `${path.join(workspaceRoot, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
          },
          encoding: "utf8",
        }
      );
      const elapsedMs = Date.now() - startedAt;

      if (result.status !== 0) {
        throw new Error(
          `dev script failed with status ${result.status ?? "null"}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
        );
      }
      expect(elapsedMs).toBeGreaterThanOrEqual(900);

      const events = (await readFile(eventLogPath, "utf8"))
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const releaseEvent = events.find((line) => line.startsWith("lock:released:"));
      const metadataEvent = events.find((line) => line.startsWith("cargo:metadata:"));
      const buildEvent = events.find((line) => line.startsWith("cargo:build:"));
      const runtimeEvent = events.find((line) => line.startsWith("runtime:"));

      expect(releaseEvent).toBeTruthy();
      expect(metadataEvent).toBeTruthy();
      expect(buildEvent).toBeTruthy();
      expect(runtimeEvent).toBeTruthy();
      expect(buildEvent).toContain("build --manifest-path");
      expect(buildEvent).not.toContain("cargo run");
      expect(runtimeEvent).toContain(":--sample-flag 123");

      const releasedAt = Number(releaseEvent?.split(":")[2] ?? Number.NaN);
      const buildStartedAt = Number(buildEvent?.split(":")[2] ?? Number.NaN);
      const runtimeStartedAt = Number(runtimeEvent?.split(":")[1] ?? Number.NaN);
      expect(buildStartedAt).toBeGreaterThanOrEqual(releasedAt);
      expect(runtimeStartedAt).toBeGreaterThanOrEqual(buildStartedAt);

      await lockHolderExit;
    }
  );
});
