import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { collectPackagesWorkspaceHygiene } from "../../scripts/lib/packages-workspace-hygiene.mjs";

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

describe("collectPackagesWorkspaceHygiene", () => {
  const tempRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        const { rm } = await import("node:fs/promises");
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("classifies workspace packages, containers, stale dirs, and orphan crates", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "packages-hygiene-"));
    tempRoots.push(repoRoot);

    const packagesRoot = join(repoRoot, "packages");
    await mkdir(packagesRoot, { recursive: true });

    const publicPkg = join(packagesRoot, "public-pkg");
    await mkdir(publicPkg, { recursive: true });
    await writeJson(join(publicPkg, "package.json"), {
      name: "@ku0/public-pkg",
      version: "0.0.0",
      scripts: {
        build: "tsc",
      },
    });

    const privatePkg = join(packagesRoot, "private-pkg");
    await mkdir(privatePkg, { recursive: true });
    await writeJson(join(privatePkg, "package.json"), {
      name: "@ku0/private-pkg",
      private: true,
      scripts: {
        build: "tsc",
      },
    });
    await writeFile(join(privatePkg, "README.md"), "# private-pkg\n", "utf8");

    const ingestFilePkg = join(packagesRoot, "ingest-file");
    await mkdir(ingestFilePkg, { recursive: true });
    await writeJson(join(ingestFilePkg, "package.json"), {
      name: "@ku0/ingest-file",
      version: "1.0.0",
      scripts: {
        build: "tsc",
        test: "vitest run",
      },
    });

    const orphanCrate = join(packagesRoot, "keepup-tui");
    await mkdir(orphanCrate, { recursive: true });
    await writeFile(
      join(orphanCrate, "Cargo.toml"),
      ["[package]", 'name = "keepup-tui"', 'version = "0.1.0"'].join("\n"),
      "utf8"
    );

    const staleArtifacts = join(packagesRoot, "code-runtime-cache");
    await mkdir(join(staleArtifacts, ".turbo"), { recursive: true });
    await mkdir(join(staleArtifacts, "dist"), { recursive: true });
    await mkdir(join(staleArtifacts, "node_modules"), { recursive: true });
    await writeFile(join(staleArtifacts, "tsconfig.tsbuildinfo"), "{}", "utf8");

    const unresolvedDir = join(packagesRoot, "x-router-service");
    await mkdir(join(unresolvedDir, ".turbo"), { recursive: true });
    await mkdir(join(unresolvedDir, "node_modules"), { recursive: true });
    await writeFile(join(unresolvedDir, ".env.example"), "PORT=3000\n", "utf8");

    const result = collectPackagesWorkspaceHygiene(repoRoot);

    expect(result.workspacePackageDirs).toEqual([
      "packages/ingest-file",
      "packages/private-pkg",
      "packages/public-pkg",
    ]);
    expect(result.containerDirs).toEqual([]);
    expect(result.orphanCargoCrates).toEqual(["packages/keepup-tui"]);
    expect(result.staleArtifactDirs).toEqual(["packages/code-runtime-cache"]);
    expect(result.unresolvedTopLevelDirs).toEqual(["packages/x-router-service"]);
    expect(result.publicPackagesMissingReadme).toEqual(["@ku0/ingest-file", "@ku0/public-pkg"]);
    expect(result.publicPackagesMissingTest).toEqual(["@ku0/public-pkg"]);
  });

  it("does not classify cargo crates referenced by path dependencies as orphan crates", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "packages-hygiene-"));
    tempRoots.push(repoRoot);

    const packagesRoot = join(repoRoot, "packages");
    await mkdir(packagesRoot, { recursive: true });

    const sharedCrate = join(packagesRoot, "shared-core-rs");
    await mkdir(join(sharedCrate, "src"), { recursive: true });
    await writeFile(
      join(sharedCrate, "Cargo.toml"),
      ["[package]", 'name = "shared-core-rs"', 'version = "0.1.0"'].join("\n"),
      "utf8"
    );
    await writeFile(join(sharedCrate, "src/lib.rs"), "pub fn ping() {}\n", "utf8");

    const runtimeCrate = join(repoRoot, "apps", "runtime-service");
    await mkdir(runtimeCrate, { recursive: true });
    await writeFile(
      join(runtimeCrate, "Cargo.toml"),
      [
        "[package]",
        'name = "runtime-service"',
        'version = "0.1.0"',
        "",
        "[dependencies]",
        'shared-core-rs = { path = "../../packages/shared-core-rs" }',
      ].join("\n"),
      "utf8"
    );

    const result = collectPackagesWorkspaceHygiene(repoRoot);

    expect(result.orphanCargoCrates).toEqual([]);
  });
});
