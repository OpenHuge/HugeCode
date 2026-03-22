import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const requiredEntries = [
  "package.json",
  "scripts/check-design-system-governance-fixture-coverage.mjs",
];
const GOVERNANCE_FIXTURES = [
  "main-shell-closure",
  "home-sidebar-closure",
  "mission-control",
  "core-loop-closure",
  "review-loop-closure",
  "settings-form-chrome",
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
      path.join(targetRoot, "scripts", "check-design-system-governance-fixture-coverage.mjs"),
      "--root",
      targetRoot,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

describe("check-design-system-governance-fixture-coverage", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("includes governance fixture coverage in the design-system baseline command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:design-system:baseline"]).toContain(
      "check:design-system:governance-fixture-coverage"
    );
    expect(packageJson.scripts?.["check:design-system:baseline"]).not.toContain(
      "check:design-system:flagship-fixture-coverage"
    );
  });

  it("passes when all governance fixtures are registered in the fixture host and covered by smoke tests", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-governance-fixture-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureAppPath = path.join(tempRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
    await mkdir(path.dirname(fixtureAppPath), { recursive: true });
    await writeFile(
      fixtureAppPath,
      GOVERNANCE_FIXTURES.map(
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
      GOVERNANCE_FIXTURES.map(
        (fixtureName) =>
          `test("${fixtureName}", async ({ page }, testInfo) => { await runFixtureSmoke(page, testInfo, { fixtureId: "${fixtureName}" }); });`
      ).join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Design-system governance fixture coverage check passed.");
  });

  it("fails when a governance fixture is missing from FixtureApp", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-governance-fixture-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureAppPath = path.join(tempRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
    await mkdir(path.dirname(fixtureAppPath), { recursive: true });
    await writeFile(
      fixtureAppPath,
      GOVERNANCE_FIXTURES.filter((fixtureName) => fixtureName !== "settings-form-chrome")
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
      GOVERNANCE_FIXTURES.map(
        (fixtureName) =>
          `test("${fixtureName}", async ({ page }, testInfo) => { await runFixtureSmoke(page, testInfo, { fixtureId: "${fixtureName}" }); });`
      ).join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("settings-form-chrome");
    expect(result.stderr).toContain("FixtureApp");
  });

  it("fails when a governance fixture is missing from the smoke spec", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "ds-governance-fixture-coverage-"));
    tempRoots.push(tempRoot);
    await copyRequiredEntries(tempRoot);

    const fixtureAppPath = path.join(tempRoot, "apps", "code", "src", "fixtures", "FixtureApp.tsx");
    await mkdir(path.dirname(fixtureAppPath), { recursive: true });
    await writeFile(
      fixtureAppPath,
      GOVERNANCE_FIXTURES.map(
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
      GOVERNANCE_FIXTURES.filter((fixtureName) => fixtureName !== "home-sidebar-closure")
        .map(
          (fixtureName) =>
            `test("${fixtureName}", async ({ page }, testInfo) => { await runFixtureSmoke(page, testInfo, { fixtureId: "${fixtureName}" }); });`
        )
        .join("\n"),
      "utf8"
    );

    const result = runGuard(tempRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("home-sidebar-closure");
    expect(result.stderr).toContain("design-system-fixture-smoke.spec.ts");
  });
});
