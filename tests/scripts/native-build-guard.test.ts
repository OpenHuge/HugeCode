import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const buildNativeModuleUrl = pathToFileURL(
  path.join(repoRoot, "packages", "native-bindings", "scripts", "build-native.ts")
).href;
const buildNapiModuleUrl = pathToFileURL(
  path.join(repoRoot, "packages", "native-bindings", "scripts", "build-napi.ts")
).href;
const cargoTargetCacheModulePath = path.join(repoRoot, "scripts", "lib", "cargo-target-cache.mjs");
const tempRoots: string[] = [];

function createPackageRoot(name = "demo-native"): string {
  const packageRoot = mkdtempSync(path.join(tmpdir(), "native-build-guard-"));
  tempRoots.push(packageRoot);
  writeFileSync(
    path.join(packageRoot, "Cargo.toml"),
    ["[package]", `name = "${name}"`, 'version = "0.1.0"', 'edition = "2021"', ""].join("\n"),
    "utf8"
  );
  return packageRoot;
}

function createNativeBuildOutput(packageRoot: string, targetDir: string, crateName: string): void {
  const crateBaseName = crateName.replace(/-/g, "_");
  const libraryName =
    process.platform === "win32"
      ? `${crateBaseName}.dll`
      : process.platform === "darwin"
        ? `lib${crateBaseName}.dylib`
        : `lib${crateBaseName}.so`;
  const outputPath = path.join(targetDir, "debug", libraryName);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, "fixture-binary", "utf8");
}

function createReleaseLock(waitedForLock: boolean) {
  const releaseLock = vi.fn();
  Reflect.set(releaseLock, "waitedForLock", waitedForLock);
  return releaseLock as typeof releaseLock & { waitedForLock: boolean };
}

afterEach(async () => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock("node:child_process");
  vi.doUnmock(cargoTargetCacheModulePath);

  await Promise.all(
    tempRoots.splice(0).map(async (rootPath) => {
      const { rm } = await import("node:fs/promises");
      await rm(rootPath, { recursive: true, force: true });
    })
  );
});

describe("native build cargo target guard", () => {
  it("skips budget pruning for native builds that already waited on the shared lock", async () => {
    const packageRoot = createPackageRoot();
    const targetDir = path.join(packageRoot, ".cache", "cargo-target");
    createNativeBuildOutput(packageRoot, targetDir, "demo-native");

    const releaseLock = createReleaseLock(true);
    const prepareCargoTargetDirForBuild = vi.fn(() => ({
      releaseLock,
      targetDir,
      waitedForLock: true,
    }));
    const buildRustBuildEnv = vi.fn(() => ({ env: { ...process.env }, sccachePath: null }));
    const execFileSync = vi.fn();

    vi.doMock(cargoTargetCacheModulePath, () => ({
      buildRustBuildEnv,
      prepareCargoTargetDirForBuild,
      resolveWorkspaceCargoTargetDir: () => targetDir,
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync,
    }));

    const { runNativeBuild } = await import(`${buildNativeModuleUrl}?waited-native=${Date.now()}`);
    runNativeBuild({ packageRoot, args: [] });

    expect(prepareCargoTargetDirForBuild).toHaveBeenCalledWith({
      startDir: packageRoot,
      relativeToDir: packageRoot,
      targetDir,
      log: expect.any(Function),
    });
    expect(buildRustBuildEnv).toHaveBeenCalledWith({
      startDir: packageRoot,
      relativeToDir: packageRoot,
      targetDir,
    });
    expect(execFileSync).toHaveBeenCalledWith(
      "cargo",
      ["build"],
      expect.objectContaining({ cwd: packageRoot, stdio: "inherit" })
    );
    expect(existsSync(path.join(packageRoot, "dist", "demo_native.node"))).toBe(true);
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("preserves budget enforcement for native builds that acquire the lock immediately", async () => {
    const packageRoot = createPackageRoot("fresh-native");
    const targetDir = path.join(packageRoot, ".cache", "cargo-target");
    createNativeBuildOutput(packageRoot, targetDir, "fresh-native");

    const releaseLock = createReleaseLock(false);
    const prepareCargoTargetDirForBuild = vi.fn(() => ({
      releaseLock,
      targetDir,
      waitedForLock: false,
    }));
    const buildRustBuildEnv = vi.fn(() => ({ env: { ...process.env }, sccachePath: null }));

    vi.doMock(cargoTargetCacheModulePath, () => ({
      buildRustBuildEnv,
      prepareCargoTargetDirForBuild,
      resolveWorkspaceCargoTargetDir: () => targetDir,
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn(),
    }));

    const { runNativeBuild } = await import(`${buildNativeModuleUrl}?fresh-native=${Date.now()}`);
    runNativeBuild({ packageRoot, args: [] });

    expect(prepareCargoTargetDirForBuild).toHaveBeenCalledOnce();
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("skips budget pruning for napi builds that already waited on the shared lock", async () => {
    const packageRoot = createPackageRoot("demo-napi");
    const nativeRoot = path.join(packageRoot, "native");
    mkdirSync(nativeRoot, { recursive: true });
    writeFileSync(
      path.join(nativeRoot, "Cargo.toml"),
      ["[package]", 'name = "demo-napi"', 'version = "0.1.0"', 'edition = "2021"', ""].join("\n"),
      "utf8"
    );
    const targetDir = path.join(packageRoot, ".cache", "cargo-target");

    const releaseLock = createReleaseLock(true);
    const prepareCargoTargetDirForBuild = vi.fn(() => ({
      releaseLock,
      targetDir,
      waitedForLock: true,
    }));
    const buildRustBuildEnv = vi.fn(() => ({ env: { ...process.env }, sccachePath: null }));
    const execFileSync = vi.fn();

    vi.doMock(cargoTargetCacheModulePath, () => ({
      buildRustBuildEnv,
      prepareCargoTargetDirForBuild,
      resolveWorkspaceCargoTargetDir: () => targetDir,
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync,
    }));

    const { runNapiBuild } = await import(`${buildNapiModuleUrl}?waited-napi=${Date.now()}`);
    runNapiBuild({ packageRoot, args: [] });

    expect(prepareCargoTargetDirForBuild).toHaveBeenCalledWith({
      startDir: nativeRoot,
      relativeToDir: nativeRoot,
      targetDir,
      log: expect.any(Function),
    });
    expect(execFileSync).toHaveBeenCalledWith(
      expect.any(String),
      ["build", "--manifest-path", path.join("native", "Cargo.toml")],
      expect.objectContaining({ cwd: packageRoot, stdio: "inherit" })
    );
    expect(releaseLock).toHaveBeenCalledOnce();
  });
});
