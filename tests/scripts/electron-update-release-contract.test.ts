import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function repoPathExists(relativePath: string) {
  return existsSync(path.join(repoRoot, relativePath));
}

describe("electron update release contract", () => {
  it("keeps the retired Electron app surface absent", () => {
    expect(repoPathExists("apps/code-electron")).toBe(false);
    expect(repoPathExists(".github/workflows/desktop.yml")).toBe(false);
    expect(repoPathExists(".github/workflows/electron-beta.yml")).toBe(false);
    expect(repoPathExists(".github/actions/setup-desktop-build-env")).toBe(false);
  });

  it("keeps root package scripts free of Electron release commands", () => {
    const packageJson = readRepoFile("package.json");

    expect(packageJson).not.toContain("electron-forge");
    expect(packageJson).not.toContain("desktop:");
    expect(packageJson).not.toContain("electron-beta");
  });
});
