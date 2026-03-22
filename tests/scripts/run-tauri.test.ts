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

async function createFixtureWorkspace(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "run-tauri-script-"));
  tempRoots.push(workspaceRoot);

  await mkdir(path.join(workspaceRoot, "scripts", "lib"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "apps", "code-tauri", "scripts"), { recursive: true });
  await mkdir(path.join(workspaceRoot, "node_modules", ".bin"), { recursive: true });

  await cp(
    path.join(repoRoot, "apps", "code-tauri", "scripts", "run-tauri.mjs"),
    path.join(workspaceRoot, "apps", "code-tauri", "scripts", "run-tauri.mjs")
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

describe("code-tauri run-tauri script", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        const { rm } = await import("node:fs/promises");
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("serializes one-shot tauri builds behind the shared cargo target guard", async () => {
    const workspaceRoot = await createFixtureWorkspace();
    const appRoot = path.join(workspaceRoot, "apps", "code-tauri");
    const eventLogPath = path.join(workspaceRoot, "events.log");
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const lockHolderModuleUrl = pathToFileURL(
      path.join(workspaceRoot, "scripts", "lib", "cargo-target-cache.mjs")
    ).href;

    await writeShim(path.join(workspaceRoot, "node_modules", ".bin", "tauri"), [
      'const fs = require("node:fs");',
      'fs.appendFileSync(process.env.EVENT_LOG_PATH, `tauri:${Date.now()}:${process.argv.slice(2).join(" ")}\\n`, "utf8");',
    ]);
    await writeFile(eventLogPath, "", "utf8");

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
          `setTimeout(() => { fs.appendFileSync(${JSON.stringify(eventLogPath)}, \`lock:released:\${Date.now()}\\n\`, "utf8"); releaseLock(); process.exit(0); }, 300);`,
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

    const result = spawnSync(
      process.execPath,
      [path.join(appRoot, "scripts", "run-tauri.mjs"), "build"],
      {
        cwd: appRoot,
        env: {
          ...process.env,
          EVENT_LOG_PATH: eventLogPath,
        },
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const events = (await readFile(eventLogPath, "utf8"))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const releaseEvent = events.find((line) => line.startsWith("lock:released:"));
    const tauriEvent = events.find((line) => line.startsWith("tauri:"));

    expect(releaseEvent).toBeTruthy();
    expect(tauriEvent).toBeTruthy();
    expect(tauriEvent).toContain(":build");

    const releasedAt = Number(releaseEvent?.split(":")[2] ?? Number.NaN);
    const tauriStartedAt = Number(tauriEvent?.split(":")[1] ?? Number.NaN);
    expect(tauriStartedAt).toBeGreaterThanOrEqual(releasedAt);
    await lockHolderExit;
  });
});
