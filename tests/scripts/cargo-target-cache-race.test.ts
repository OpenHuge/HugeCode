import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const tempRoots: string[] = [];

function createTempWorkspace(): string {
  const workspaceRoot = mkdtempSync(path.join(tmpdir(), "cargo-target-race-"));
  tempRoots.push(workspaceRoot);
  writeFileSync(path.join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf8");
  return workspaceRoot;
}

function createFile(filePath: string, sizeBytes: number): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.alloc(sizeBytes, 1));
}

describe("cargo target cache guard race handling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("node:fs");

    for (const rootPath of tempRoots.splice(0)) {
      rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it("ignores nested directories that disappear during cargo target scans", async () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const incrementalDir = path.join(targetDir, "debug", "incremental");
    createFile(path.join(incrementalDir, "state.bin"), 32 * 1024);
    createFile(path.join(targetDir, "debug", "deps", "keep.bin"), 4 * 1024);

    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      let removedIncremental = false;

      return {
        ...actual,
        readdirSync(
          ...args: Parameters<typeof actual.readdirSync>
        ): ReturnType<typeof actual.readdirSync> {
          const entries = Reflect.apply(actual.readdirSync, actual, args);
          if (!removedIncremental && String(args[0]).endsWith(path.join("cargo-target", "debug"))) {
            actual.rmSync(incrementalDir, { recursive: true, force: true });
            removedIncremental = true;
          }
          return entries;
        },
      };
    });

    const moduleUrl = new URL(
      `${pathToFileURL(path.join(import.meta.dirname, "..", "..", "scripts", "lib", "cargo-target-cache.mjs")).href}?race=${Date.now()}`
    ).href;
    const { enforceCargoTargetDirBudget } = await import(moduleUrl);

    expect(() =>
      enforceCargoTargetDirBudget({
        startDir: workspaceRoot,
        targetDir,
        maxSizeBytes: 8 * 1024,
        minFreeBytes: 0,
        hardMinFreeBytes: 0,
        scanIntervalMs: 0,
      })
    ).not.toThrow();
  });

  it("retries lock acquisition when the lock directory disappears before metadata is written", async () => {
    const workspaceRoot = createTempWorkspace();
    const targetDir = path.join(workspaceRoot, ".cache", "cargo-target");
    const lockPath = path.join(workspaceRoot, ".cache", "cargo-target.lock");

    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      let removedLockDirectory = false;

      return {
        ...actual,
        writeFileSync(
          ...args: Parameters<typeof actual.writeFileSync>
        ): ReturnType<typeof actual.writeFileSync> {
          const [filePath] = args;
          if (
            !removedLockDirectory &&
            typeof filePath === "string" &&
            filePath.endsWith(path.join("cargo-target.lock", "owner.json"))
          ) {
            actual.rmSync(lockPath, { recursive: true, force: true });
            removedLockDirectory = true;
          }
          return Reflect.apply(actual.writeFileSync, actual, args);
        },
      };
    });

    const moduleUrl = new URL(
      `${pathToFileURL(path.join(import.meta.dirname, "..", "..", "scripts", "lib", "cargo-target-cache.mjs")).href}?lock-race=${Date.now()}`
    ).href;
    const { acquireCargoTargetGuardLock } = await import(moduleUrl);

    const releaseLock = acquireCargoTargetGuardLock({
      targetDir,
      timeoutMs: 100,
      pollMs: 1,
    });

    expect(releaseLock.waitedForLock).toBe(false);
    releaseLock();
  });
});
