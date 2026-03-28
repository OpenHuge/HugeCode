import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

async function copyScript(targetRoot: string) {
  const sourcePath = path.join(repoRoot, "scripts", "check-runtime-port-exports.mjs");
  const targetPath = path.join(targetRoot, "scripts", "check-runtime-port-exports.mjs");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
}

async function writeRepoFile(targetRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "check-runtime-port-exports.mjs")],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-runtime-port-exports", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.map((rootPath) => rm(rootPath, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("passes when only active runtime ports exist", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "runtime-port-exports-"));
    tempRoots.push(tempRoot);
    await copyScript(tempRoot);
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/ports/tauriOauth.ts",
      "export const listOAuthAccounts = async () => [];\n"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
  });

  it("fails when retired wide runtime bridge ports are present", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "runtime-port-exports-"));
    tempRoots.push(tempRoot);
    await copyScript(tempRoot);
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/ports/tauriSettings.ts",
      'export { getAppSettings } from "./desktopAppSettings";\n'
    );
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/ports/tauriWorkspaces.ts",
      'export { listWorkspaces } from "./tauriWorkspaceCatalog";\n'
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("tauriSettings.ts");
    expect(result.stderr).toContain("tauriWorkspaces.ts");
  });

  it("fails when runtimeToolLifecycle port re-exports unscoped or filter helpers", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "runtime-port-exports-"));
    tempRoots.push(tempRoot);
    await copyScript(tempRoot);
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/ports/runtimeToolLifecycle.ts",
      [
        'export { getRuntimeToolLifecycleSnapshot } from "../facades/runtimeToolLifecycleFacade";',
        'export { subscribeRuntimeToolLifecycleEvents } from "../facades/runtimeToolLifecycleFacade";',
        'export { filterRuntimeToolLifecycleSnapshot } from "../types/runtimeToolLifecycle";',
      ].join("\n")
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("runtimeToolLifecycle.ts");
    expect(result.stderr).toContain("workspace-scoped");
  });

  it("fails when runtimeToolLifecycle port widens beyond the approved export surface", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "runtime-port-exports-"));
    tempRoots.push(tempRoot);
    await copyScript(tempRoot);
    await writeRepoFile(
      tempRoot,
      "apps/code/src/application/runtime/ports/runtimeToolLifecycle.ts",
      [
        "export type {",
        "  RuntimeToolLifecycleEvent,",
        "  RuntimeToolLifecycleHookCheckpoint,",
        "  RuntimeToolLifecycleHookCheckpointStatus,",
        "  RuntimeToolLifecycleHookPoint,",
        "  RuntimeToolLifecycleSnapshot,",
        "  RuntimeToolLifecycleSource,",
        "  RuntimeToolLifecycleStatus,",
        '} from "../types/runtimeToolLifecycle";',
        "export type {",
        "  RuntimeToolLifecyclePresentationSummary,",
        "  RuntimeToolLifecyclePresentationTone,",
        '} from "../facades/runtimeToolLifecycleFacade";',
        "export {",
        "  buildRuntimeToolLifecyclePresentationSummary,",
        "  describeRuntimeToolLifecycleEvent,",
        "  describeRuntimeToolLifecycleHookCheckpoint,",
        "  formatRuntimeToolLifecycleStatusLabel,",
        "  formatRuntimeToolLifecycleEventKey,",
        "  formatRuntimeToolLifecycleHookCheckpointKey,",
        "  getRuntimeToolLifecycleEventTone,",
        "  getRuntimeToolLifecycleHookCheckpointTone,",
        "  getWorkspaceRuntimeToolLifecycleSnapshot,",
        "  sortRuntimeToolLifecycleEventsByRecency,",
        "  sortRuntimeToolLifecycleHookCheckpointsByRecency,",
        "  subscribeWorkspaceRuntimeToolLifecycleEvents,",
        "  subscribeWorkspaceRuntimeToolLifecycleSnapshot,",
        "  publishRuntimeToolLifecycleTelemetry,",
        '} from "../facades/runtimeToolLifecycleFacade";',
      ].join("\n")
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("runtimeToolLifecycle.ts");
    expect(result.stderr).toContain("approved export surface");
    expect(result.stderr).toContain("publishRuntimeToolLifecycleTelemetry");
  });
});
