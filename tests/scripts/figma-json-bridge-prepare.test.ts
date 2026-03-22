import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatPrepareSummary,
  resolveBridgePaths,
  runPrepare,
} from "../../scripts/figma-json-bridge/prepare.mjs";

const tempRoots: string[] = [];

async function createTempRepoRoot() {
  const root = await fs.mkdtemp(path.join(tmpdir(), "figma-bridge-prepare-"));
  tempRoots.push(root);
  return root;
}

async function writeBridgeFixtures(root: string) {
  const paths = resolveBridgePaths(root);

  await fs.mkdir(path.dirname(paths.manifestPath), { recursive: true });
  await fs.mkdir(path.dirname(paths.figmaCodegenMapPath), { recursive: true });
  await fs.writeFile(paths.manifestPath, '{\n  "name": "bridge"\n}\n', "utf8");
  await fs.writeFile(
    paths.figmaCodegenMapPath,
    "window.__HYPECODE_FIGMA_CODEGEN_MAP__ = {};\n",
    "utf8"
  );

  return paths;
}

describe("figma bridge prepare", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempRoots.map((rootPath) => fs.rm(rootPath, { recursive: true, force: true }))
    );
    tempRoots.length = 0;
  });

  it("runs tokens:build and prints next steps for the free plugin workflow", async () => {
    const root = await createTempRepoRoot();
    const paths = await writeBridgeFixtures(root);
    const stdout = { write: vi.fn() };
    const spawnPnpmSyncImpl = vi.fn(() => ({ signal: null, status: 0 }));

    const resolvedPaths = runPrepare({
      baseRoot: root,
      spawnPnpmSyncImpl,
      stdout,
    });

    expect(resolvedPaths).toEqual(paths);
    expect(spawnPnpmSyncImpl).toHaveBeenCalledWith(["tokens:build"], {
      cwd: root,
      stdio: "inherit",
    });
    expect(stdout.write).toHaveBeenCalledOnce();
    expect(formatPrepareSummary(paths)).toContain("pnpm -C tools/figma bridge:listen");
  });

  it("fails when the generated bridge token map is still missing after build", async () => {
    const root = await createTempRepoRoot();
    const paths = resolveBridgePaths(root);
    await fs.mkdir(path.dirname(paths.manifestPath), { recursive: true });
    await fs.writeFile(paths.manifestPath, '{\n  "name": "bridge"\n}\n', "utf8");

    expect(() =>
      runPrepare({
        baseRoot: root,
        spawnPnpmSyncImpl: () => ({ signal: null, status: 0 }),
        stdout: { write: vi.fn() },
      })
    ).toThrowError("Figma bridge prerequisites are missing after tokens:build");
  });
});
