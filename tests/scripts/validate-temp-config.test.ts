import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createValidateTempManager } from "../../scripts/lib/validate-temp-config.mjs";

const tempRoots: string[] = [];

async function createTempRepo() {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "validate-temp-config-"));
  tempRoots.push(repoRoot);
  await mkdir(path.join(repoRoot, "apps", "code", "src"), { recursive: true });
  return repoRoot;
}

describe("validate-temp-config", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("writes changed-files typecheck configs to a package-local validate temp directory", async () => {
    const repoRoot = await createTempRepo();
    await writeFile(
      path.join(repoRoot, "apps", "code", "tsconfig.json"),
      `${JSON.stringify({ include: ["src/**/*.ts"] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      path.join(repoRoot, "apps", "code", "src", "example.ts"),
      'export const value = "changed";\n',
      "utf8"
    );

    const tempManager = createValidateTempManager();

    try {
      const config = tempManager.createChangedFilesTypecheckConfig({
        repoRoot,
        packageDir: "apps/code",
        projectPath: "tsconfig.json",
        changedFiles: ["src/example.ts"],
      });

      expect(config).not.toBeNull();
      expect(config?.configAbsolutePath).toContain(
        `${path.sep}apps${path.sep}code${path.sep}.validate-temp${path.sep}`
      );
      expect(config?.configAbsolutePath).not.toContain(`${path.sep}.codex${path.sep}`);

      const configContent = JSON.parse(await readFile(config!.configAbsolutePath, "utf8")) as {
        extends: string;
        files: string[];
      };
      expect(configContent.extends).not.toContain(".codex");
      expect(configContent.files).toHaveLength(1);
      expect(configContent.files[0]).toContain("example.ts");
      expect(configContent.files[0]).not.toContain(".codex");
    } finally {
      tempManager.cleanup();
    }
  });

  it("falls back when changed files sit outside the project's configured rootDir", async () => {
    const repoRoot = await createTempRepo();
    await mkdir(path.join(repoRoot, "packages", "native-bindings", "src"), { recursive: true });
    await mkdir(path.join(repoRoot, "packages", "native-bindings", "scripts"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "packages", "native-bindings", "tsconfig.json"),
      `${JSON.stringify({ compilerOptions: { rootDir: "./src" }, include: ["src/**/*"] }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      path.join(repoRoot, "packages", "native-bindings", "scripts", "build-native.ts"),
      'export const build = "changed";\n',
      "utf8"
    );

    const tempManager = createValidateTempManager();

    try {
      const config = tempManager.createChangedFilesTypecheckConfig({
        repoRoot,
        packageDir: "packages/native-bindings",
        projectPath: "tsconfig.json",
        changedFiles: ["scripts/build-native.ts"],
      });

      expect(config).toEqual({
        configAbsolutePath: null,
        skipPackageFallback: true,
      });
    } finally {
      tempManager.cleanup();
    }
  });
});
