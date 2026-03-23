import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findPlatformBoundaryViolations } from "../../scripts/check-platform-boundaries.mjs";

const tempRoots: string[] = [];

function createTempRepo() {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "platform-boundary-"));
  tempRoots.push(repoRoot);
  return repoRoot;
}

function writeRepoFile(repoRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, "utf8");
}

describe("check-platform-boundaries", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const repoRoot = tempRoots.pop();
      if (repoRoot) {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  });

  it("passes when shared web core files stay platform-neutral", () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "packages/code-workspace-client/src/workspace/index.ts",
      'import { shell } from "./shell";\nexport const value = shell;\n'
    );
    writeRepoFile(
      repoRoot,
      "packages/code-workspace-client/src/workspace/shell.ts",
      "export const shell = 'ok';\n"
    );

    expect(findPlatformBoundaryViolations(repoRoot)).toEqual([]);
  });

  it("fails when shared web core imports Tauri directly", () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "packages/code-workspace-client/src/workspace/index.ts",
      'import { invoke } from "@tauri-apps/api/core";\nexport const value = invoke;\n'
    );

    expect(findPlatformBoundaryViolations(repoRoot)).toEqual([
      expect.objectContaining({
        filePath: "packages/code-workspace-client/src/workspace/index.ts",
        rule: "shared-web-core-platform-import",
      }),
    ]);
  });

  it("fails when apps/code-web reaches for the desktop host global", () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "apps/code-web/app/routes/app/index.tsx",
      "export const value = window.hugeCodeDesktopHost;\n"
    );

    expect(findPlatformBoundaryViolations(repoRoot)).toEqual([
      expect.objectContaining({
        filePath: "apps/code-web/app/routes/app/index.tsx",
        rule: "shared-web-core-platform-import",
      }),
    ]);
  });

  it("fails when code-application imports Electron directly", () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "packages/code-application/src/index.ts",
      'import { ipcRenderer } from "electron";\nexport const value = ipcRenderer;\n'
    );

    expect(findPlatformBoundaryViolations(repoRoot)).toEqual([
      expect.objectContaining({
        filePath: "packages/code-application/src/index.ts",
        rule: "code-application-platform-import",
      }),
    ]);
  });
});
