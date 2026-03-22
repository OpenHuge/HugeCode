import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-design-system-operator-adjunct-fixture-coverage.mjs",
  "scripts/lib/design-system-operator-adjunct-fixture-config.mjs",
];
const OPERATOR_ADJUNCT_FIXTURES = [
  "composer-select",
  "composer-action-stop",
  "autodrive-navigation",
  "runtime-subagent-observability",
] as const;

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

function runGuard(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [
      path.join(targetRoot, "scripts", "check-design-system-operator-adjunct-fixture-coverage.mjs"),
      "--root",
      targetRoot,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-design-system-operator-adjunct-fixture-coverage", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("includes operator adjunct fixture coverage in the design-system baseline command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:design-system:baseline"]).toContain(
      "check:design-system:operator-adjunct-fixture-coverage"
    );
  });

  it("passes when all operator adjunct fixtures are registered in the fixture host and covered by smoke tests", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-operator-adjunct-fixture-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureAppPath = path.join(tempRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
    await mkdir(path.dirname(fixtureAppPath), { recursive: true });
    await writeFile(
      fixtureAppPath,
      OPERATOR_ADJUNCT_FIXTURES.map(
        (fixtureName) => `if (fixtureName === "${fixtureName}") return <Fixture />;`
      ).join("\n"),
      "utf8"
    );

    const smokeSpecPath = path.join(
      tempRoot,
      "tests",
      "e2e",
      "src",
      "code",
      "design-system-fixture-smoke.spec.ts"
    );
    await mkdir(path.dirname(smokeSpecPath), { recursive: true });
    await writeFile(
      smokeSpecPath,
      OPERATOR_ADJUNCT_FIXTURES.map(
        (fixtureName) =>
          `test("${fixtureName}", async ({ page }, testInfo) => { await runFixtureSmoke(page, testInfo, { fixtureId: "${fixtureName}" }); });`
      ).join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Design-system operator adjunct fixture coverage check passed."
    );
  });

  it("fails when an operator adjunct fixture is missing from FixtureApp", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-operator-adjunct-fixture-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureAppPath = path.join(tempRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
    await mkdir(path.dirname(fixtureAppPath), { recursive: true });
    await writeFile(
      fixtureAppPath,
      OPERATOR_ADJUNCT_FIXTURES.filter((fixtureName) => fixtureName !== "autodrive-navigation")
        .map((fixtureName) => `if (fixtureName === "${fixtureName}") return <Fixture />;`)
        .join("\n"),
      "utf8"
    );

    const smokeSpecPath = path.join(
      tempRoot,
      "tests",
      "e2e",
      "src",
      "code",
      "design-system-fixture-smoke.spec.ts"
    );
    await mkdir(path.dirname(smokeSpecPath), { recursive: true });
    await writeFile(
      smokeSpecPath,
      OPERATOR_ADJUNCT_FIXTURES.map(
        (fixtureName) =>
          `test("${fixtureName}", async ({ page }, testInfo) => { await runFixtureSmoke(page, testInfo, { fixtureId: "${fixtureName}" }); });`
      ).join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("autodrive-navigation");
    expect(result.stderr).toContain("FixtureApp");
  });

  it("fails when an operator adjunct fixture is missing from the smoke spec", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-operator-adjunct-fixture-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureAppPath = path.join(tempRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
    await mkdir(path.dirname(fixtureAppPath), { recursive: true });
    await writeFile(
      fixtureAppPath,
      OPERATOR_ADJUNCT_FIXTURES.map(
        (fixtureName) => `if (fixtureName === "${fixtureName}") return <Fixture />;`
      ).join("\n"),
      "utf8"
    );

    const smokeSpecPath = path.join(
      tempRoot,
      "tests",
      "e2e",
      "src",
      "code",
      "design-system-fixture-smoke.spec.ts"
    );
    await mkdir(path.dirname(smokeSpecPath), { recursive: true });
    await writeFile(
      smokeSpecPath,
      OPERATOR_ADJUNCT_FIXTURES.filter((fixtureName) => fixtureName !== "composer-action-stop")
        .map(
          (fixtureName) =>
            `test("${fixtureName}", async ({ page }, testInfo) => { await runFixtureSmoke(page, testInfo, { fixtureId: "${fixtureName}" }); });`
        )
        .join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("composer-action-stop");
    expect(result.stderr).toContain("design-system-fixture-smoke.spec.ts");
  });
});
