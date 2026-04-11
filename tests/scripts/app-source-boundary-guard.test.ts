import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];

function createTempRepo() {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "app-source-boundary-"));
  tempRoots.push(repoRoot);
  return repoRoot;
}

function writeRepoFile(repoRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, "utf8");
}

async function runBoundaryScript(repoRoot: string) {
  const scriptPath = path.resolve(process.cwd(), "scripts/check-app-source-boundary.mjs");
  const { default: nodeChildProcess } = await import("node:child_process");

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = nodeChildProcess.spawn(process.execPath, [scriptPath, "--root", repoRoot], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe("check-app-source-boundary", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const repoRoot = tempRoots.pop();
      if (repoRoot) {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  });

  it("passes when apps only import their own src files", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "apps/code-web/app/components/WorkspaceClientApp.tsx",
      'import { boot } from "../../src/runtime";\nexport const value = boot;\n'
    );
    writeRepoFile(repoRoot, "apps/code-web/src/runtime.ts", "export const boot = 'ok';\n");

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("passes when packages only import their own package files", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "packages/code-workspace-client/src/runtime-shell/WorkspaceRuntimeShell.tsx",
      'import { shell } from "../workspace/shell";\nexport const value = shell;\n'
    );
    writeRepoFile(
      repoRoot,
      "packages/code-workspace-client/src/workspace/shell.ts",
      "export const shell = 'ok';\n"
    );

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("fails when an app imports another app src path", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "apps/code-web/app/components/WorkspaceClientApp.tsx",
      'import { WorkspaceClientEntry } from "../../../code/src/web/WorkspaceClientEntry";\nexport const value = WorkspaceClientEntry;\n'
    );
    writeRepoFile(
      repoRoot,
      "apps/code/src/web/WorkspaceClientEntry.tsx",
      "export const WorkspaceClientEntry = 'bad';\n"
    );

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("apps/code-web/app/components/WorkspaceClientApp.tsx");
    expect(result.stderr).toContain("cross-app src import");
  });

  it("fails when the shared workspace package imports an app src path", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "packages/code-workspace-client/src/runtime-shell/WorkspaceRuntimeShell.tsx",
      'import { MainApp } from "../../../../apps/code/src/web/WorkspaceAppBridge";\nexport const value = MainApp;\n'
    );
    writeRepoFile(
      repoRoot,
      "apps/code/src/web/WorkspaceAppBridge.tsx",
      "export const MainApp = 'bad';\n"
    );

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "packages/code-workspace-client/src/runtime-shell/WorkspaceRuntimeShell.tsx"
    );
    expect(result.stderr).toContain("package-to-app src import");
  });

  it("fails when a production feature imports an app-local control-plane facade", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "apps/code/src/features/home/components/Home.tsx",
      'import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";\nexport const value = null;\n'
    );
    writeRepoFile(
      repoRoot,
      "apps/code/src/application/runtime/facades/runtimeMissionControlFacade.ts",
      "export type MissionControlProjection = { source: string };\n"
    );

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("feature-to-app control-plane facade import");
  });

  it("fails when a production feature imports the app-local mission control loop facade", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "apps/code/src/features/home/components/Home.tsx",
      'import { buildMissionControlLoopItems } from "../../../application/runtime/facades/runtimeMissionControlLoop";\nexport const value = buildMissionControlLoopItems;\n'
    );
    writeRepoFile(
      repoRoot,
      "apps/code/src/application/runtime/facades/runtimeMissionControlLoop.ts",
      "export const buildMissionControlLoopItems = () => [];\n"
    );

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("feature-to-app control-plane facade import");
  });

  it("allows feature tests to keep importing app-local control-plane facades", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "apps/code/src/features/home/components/Home.test.tsx",
      'import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";\nexport const value = null;\n'
    );
    writeRepoFile(
      repoRoot,
      "apps/code/src/application/runtime/facades/runtimeMissionControlFacade.ts",
      "export type MissionControlProjection = { source: string };\n"
    );

    const result = await runBoundaryScript(repoRoot);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
  });
});
