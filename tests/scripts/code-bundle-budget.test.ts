import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempRoots: string[] = [];

function createTempRepo() {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "code-bundle-budget-"));
  tempRoots.push(repoRoot);
  return repoRoot;
}

function writeRepoFile(repoRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content, "utf8");
}

async function runBudgetScript(repoRoot: string, configRelativePath: string) {
  const scriptPath = path.resolve(process.cwd(), "scripts/check-code-bundle-budget.mjs");
  const { default: nodeChildProcess } = await import("node:child_process");

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = nodeChildProcess.spawn(
      process.execPath,
      [
        scriptPath,
        "--assets-dir",
        "apps/code-web/dist/hugecode_web/assets",
        "--config",
        configRelativePath,
      ],
      {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
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

describe("check-code-bundle-budget", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const repoRoot = tempRoots.pop();
      if (repoRoot) {
        rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  });

  it("accepts a root-level entry chunk outside the assets directory", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "scripts/config/test-budget.config.mjs",
      [
        "export default {",
        "  entryMaxBytes: 2000,",
        "  chunkMaxBytes: 400,",
        "  growthTolerancePct: 3,",
        "  knownLargeChunkPrefixes: { 'MainApp-': 1200 },",
        "};",
        "",
      ].join("\n")
    );
    writeRepoFile(repoRoot, "apps/code-web/dist/hugecode_web/index.js", "x".repeat(1200));
    writeRepoFile(
      repoRoot,
      "apps/code-web/dist/hugecode_web/assets/MainApp-big.js",
      "x".repeat(1100)
    );

    const result = await runBudgetScript(repoRoot, "scripts/config/test-budget.config.mjs");

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Entry chunk: index.js");
    expect(result.stdout).toContain("MainApp-big.js");
  });

  it("ignores small chunks that share a known-large prefix", async () => {
    const repoRoot = createTempRepo();
    writeRepoFile(
      repoRoot,
      "scripts/config/test-budget.config.mjs",
      [
        "export default {",
        "  entryMaxBytes: 2000,",
        "  chunkMaxBytes: 400,",
        "  growthTolerancePct: 3,",
        "  knownLargeChunkPrefixes: { 'esm-': 1200 },",
        "};",
        "",
      ].join("\n")
    );
    writeRepoFile(repoRoot, "apps/code-web/dist/hugecode_web/index.js", "x".repeat(1200));
    writeRepoFile(repoRoot, "apps/code-web/dist/hugecode_web/assets/esm-big.js", "x".repeat(1100));
    writeRepoFile(repoRoot, "apps/code-web/dist/hugecode_web/assets/esm-tiny.js", "x".repeat(100));

    const result = await runBudgetScript(repoRoot, "scripts/config/test-budget.config.mjs");

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("esm-big.js");
    expect(result.stdout).not.toContain("esm-tiny.js");
  });
});
