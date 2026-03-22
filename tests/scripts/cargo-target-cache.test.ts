import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  acquireCargoTargetGuardLock,
  enforceCargoTargetDirBudget,
  prepareCargoTargetDirForBuild,
  resolveWorkspaceCargoTargetDir,
} from "../../scripts/lib/cargo-target-cache.mjs";

const tempRoots: string[] = [];

function createTempWorkspace(): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "cargo-target-guard-"));
  tempRoots.push(workspaceRoot);
  writeFileSync(path.join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf8");
  return workspaceRoot;
}

function createFile(filePath: string, sizeBytes: number): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.alloc(sizeBytes, 1));
}

describe("cargo target cache guard", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        const { rm } = await import("node:fs/promises");
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("resolves the shared cargo target directory from the workspace root", () => {
    const workspaceRoot = createTempWorkspace();
    const packageRoot = path.join(workspaceRoot, "apps", "code-tauri");
    mkdirSync(packageRoot, { recursive: true });

    expect(resolveWorkspaceCargoTargetDir({ startDir: packageRoot })).toBe(
      path.join(workspaceRoot, ".cache", "cargo-target")
    );
  });

  it("prunes incremental artifacts before dropping the whole target directory", () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    createFile(path.join(targetDir, "debug", "incremental", "state.bin"), 32 * 1024);
    createFile(path.join(targetDir, "debug", "deps", "keep.bin"), 4 * 1024);

    const result = enforceCargoTargetDirBudget({
      startDir: workspaceRoot,
      targetDir,
      maxSizeBytes: 8 * 1024,
      minFreeBytes: 0,
      hardMinFreeBytes: 0,
      scanIntervalMs: 0,
    });

    expect(result.action).toBe("pruned-incremental");
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(() => readFileSync(path.join(targetDir, "debug", "deps", "keep.bin"))).not.toThrow();
    expect(() => readFileSync(path.join(targetDir, "debug", "incremental", "state.bin"))).toThrow();
  });

  it("clears the target directory when non-incremental artifacts still exceed the budget", () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    createFile(path.join(targetDir, "debug", "deps", "keep.bin"), 32 * 1024);

    const result = enforceCargoTargetDirBudget({
      startDir: workspaceRoot,
      targetDir,
      maxSizeBytes: 8 * 1024,
      minFreeBytes: 0,
      hardMinFreeBytes: 0,
      scanIntervalMs: 0,
    });

    expect(result.action).toBe("cleaned-all");
    expect(result.sizeBytes).toBe(0);
    expect(
      readFileSync(path.join(path.dirname(targetDir), "cargo-target-guard.json"), "utf8")
    ).toContain('"action": "cleaned-all"');
  });

  it("creates and releases a shared cargo target lock", () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const lockPath = path.join(workspaceRoot, ".cache", "cargo-target.lock");

    const releaseLock = acquireCargoTargetGuardLock({
      targetDir,
      timeoutMs: 50,
      pollMs: 1,
    });

    expect(existsSync(path.join(lockPath, "owner.json"))).toBe(true);
    releaseLock();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("reclaims stale cargo target locks from dead owners", () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const lockPath = path.join(workspaceRoot, ".cache", "cargo-target.lock");
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(
      path.join(lockPath, "owner.json"),
      JSON.stringify({
        pid: 999_999,
        acquiredAtMs: Date.now(),
        targetDir,
      }),
      "utf8"
    );

    const releaseLock = acquireCargoTargetGuardLock({
      targetDir,
      timeoutMs: 50,
      pollMs: 1,
      staleAfterMs: 60_000,
    });

    const owner = JSON.parse(readFileSync(path.join(lockPath, "owner.json"), "utf8"));
    expect(owner.pid).toBe(process.pid);
    releaseLock();
  });

  it("marks lock acquisitions that had to wait for another process", async () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const moduleUrl = pathToFileURL(
      path.join(import.meta.dirname, "..", "..", "scripts", "lib", "cargo-target-cache.mjs")
    ).href;

    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `const { acquireCargoTargetGuardLock } = await import(${JSON.stringify(moduleUrl)});`,
          `const releaseLock = acquireCargoTargetGuardLock({ targetDir: ${JSON.stringify(targetDir)}, timeoutMs: 5_000, pollMs: 10 });`,
          'process.stdout.write("locked\\n");',
          "setTimeout(() => { releaseLock(); process.exit(0); }, 300);",
        ].join("\n"),
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const childExit = new Promise<void>((resolve, reject) => {
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `lock-holder child failed with code ${code ?? "null"} signal ${signal ?? "null"}: ${stderr}`
          )
        );
      });
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timed out waiting for child process to acquire cargo target lock"));
      }, 5_000);
      let observedLock = false;
      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.stdout.on("data", (chunk) => {
        if (!chunk.toString().includes("locked")) {
          return;
        }
        observedLock = true;
        clearTimeout(timeout);
        resolve();
      });
      child.on("exit", (code, signal) => {
        clearTimeout(timeout);
        if (observedLock) {
          return;
        }
        reject(
          new Error(
            `child process exited before acquiring cargo target lock with code ${code ?? "null"} signal ${signal ?? "null"}: ${stderr}`
          )
        );
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const releaseLock = acquireCargoTargetGuardLock({
      targetDir,
      timeoutMs: 5_000,
      pollMs: 10,
    });

    expect(releaseLock.waitedForLock).toBe(true);
    releaseLock();
    await childExit;
  });

  it("reuses a warm target dir after waiting instead of re-running cleanup", async () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    createFile(path.join(targetDir, "debug", "deps", "keep.bin"), 2 * 1024 * 1024);
    const moduleUrl = pathToFileURL(
      path.join(import.meta.dirname, "..", "..", "scripts", "lib", "cargo-target-cache.mjs")
    ).href;

    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `const { acquireCargoTargetGuardLock } = await import(${JSON.stringify(moduleUrl)});`,
          `const releaseLock = acquireCargoTargetGuardLock({ targetDir: ${JSON.stringify(targetDir)}, timeoutMs: 5_000, pollMs: 10 });`,
          'process.stdout.write("locked\\n");',
          "setTimeout(() => { releaseLock(); process.exit(0); }, 300);",
        ].join("\n"),
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    const childExit = new Promise<void>((resolve, reject) => {
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `lock-holder child failed with code ${code ?? "null"} signal ${signal ?? "null"}: ${stderr}`
          )
        );
      });
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timed out waiting for child process to acquire cargo target lock"));
      }, 5_000);
      let observedLock = false;
      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.stdout.on("data", (chunk) => {
        if (!chunk.toString().includes("locked")) {
          return;
        }
        observedLock = true;
        clearTimeout(timeout);
        resolve();
      });
      child.on("exit", (code, signal) => {
        clearTimeout(timeout);
        if (observedLock) {
          return;
        }
        reject(
          new Error(
            `child process exited before acquiring cargo target lock with code ${code ?? "null"} signal ${signal ?? "null"}: ${stderr}`
          )
        );
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const logs: string[] = [];
    const { releaseLock, waitedForLock } = prepareCargoTargetDirForBuild({
      startDir: workspaceRoot,
      targetDir,
      env: {
        ...process.env,
        HYPECODE_CARGO_TARGET_MAX_SIZE_MB: "1",
      },
      log: (message) => {
        logs.push(message);
      },
    });

    expect(waitedForLock).toBe(true);
    expect(logs.some((message) => message.includes("reusing warm cargo target dir"))).toBe(true);
    expect(() => readFileSync(path.join(targetDir, "debug", "deps", "keep.bin"))).not.toThrow();

    releaseLock();
    await childExit;
  });
});
