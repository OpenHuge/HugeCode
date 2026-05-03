import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];

function runGit(targetRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: targetRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

async function writeFixtureFile(targetRoot: string, relativePath: string, content: string) {
  const absolutePath = path.join(targetRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function createFixtureRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "classify-ci-scope-"));
  tempRoots.push(tempRoot);

  await mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts", "classify-ci-change-scope.mjs"),
    path.join(tempRoot, "scripts", "classify-ci-change-scope.mjs")
  );

  await writeFixtureFile(tempRoot, ".github/workflows/ci.yml", "name: CI\n");
  await writeFixtureFile(tempRoot, "README.md", "# fixture\n");
  await writeFixtureFile(tempRoot, "docs/development/README.md", "# Development\n");
  await writeFixtureFile(tempRoot, "docs/development/ci-workflows.md", "# CI Workflows\n");

  runGit(tempRoot, ["init", "--initial-branch=main"]);
  runGit(tempRoot, ["add", "-A"]);
  runGit(tempRoot, [
    "-c",
    "user.name=Codex",
    "-c",
    "user.email=codex@example.com",
    "commit",
    "-m",
    "baseline",
  ]);

  return tempRoot;
}

function commitAll(targetRoot: string, message: string) {
  runGit(targetRoot, ["add", "-A"]);
  runGit(targetRoot, [
    "-c",
    "user.name=Codex",
    "-c",
    "user.email=codex@example.com",
    "commit",
    "-m",
    message,
  ]);
}

async function commitChangedFile(targetRoot: string, relativePath: string, content: string) {
  await writeFixtureFile(targetRoot, relativePath, content);
  commitAll(targetRoot, `change ${relativePath}`);
}

function runClassifier(targetRoot: string) {
  return spawnSync(
    process.execPath,
    [path.join(targetRoot, "scripts", "classify-ci-change-scope.mjs")],
    {
      cwd: targetRoot,
      encoding: "utf8",
    }
  );
}

function parseOutputs(stdout: string) {
  return new Map(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
  );
}

describe("classify-ci-change-scope", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it("treats workflow plus development guide changes as repo-governance-only", async () => {
    const tempRoot = await createFixtureRepo();

    await writeFixtureFile(tempRoot, ".github/workflows/ci.yml", "name: CI\n# updated\n");
    await writeFixtureFile(tempRoot, "docs/development/README.md", "# Development\nUpdated.\n");
    commitAll(tempRoot, "governance update");

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("repo_governance_only")).toBe("true");
    expect(outputs.get("manifest_only")).toBe("false");
    expect(outputs.get("build_skip_eligible_only")).toBe("false");
  });

  it("does not classify devcontainer changes as frontend or UI-owned work", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(tempRoot, ".devcontainer/update-content.sh", "echo updated\n");

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("build_skip_eligible_only")).toBe("false");
    expect(outputs.get("circular_required")).toBe("false");
    expect(outputs.get("frontend_optimization_changed")).toBe("false");
    expect(outputs.get("quality_core_changed")).toBe("false");
    expect(outputs.get("repo_governance_only")).toBe("false");
    expect(outputs.get("ui_contract_required")).toBe("false");
  });

  it("marks stories and fixtures as skippable for affected build and affected tests", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      "apps/code-t3/src/components/example/ExampleCard.stories.tsx",
      "export default {};\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("build_skip_eligible_only")).toBe("true");
    expect(outputs.get("test_skip_eligible_only")).toBe("true");
    expect(outputs.get("quality_core_changed")).toBe("true");
    expect(outputs.get("repo_governance_only")).toBe("false");
  });

  it("keeps test files eligible for affected tests even when affected builds can skip", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      "apps/code-t3/src/components/example/ExampleCard.test.tsx",
      "export {};\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("build_skip_eligible_only")).toBe("true");
    expect(outputs.get("test_skip_eligible_only")).toBe("false");
    expect(outputs.get("quality_core_changed")).toBe("true");
    expect(outputs.get("repo_governance_only")).toBe("false");
  });

  it("keeps shared workflow-governance action edits out of frontend optimization", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      ".github/actions/setup-playwright/action.yml",
      "name: Setup Playwright\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("circular_required")).toBe("false");
    expect(outputs.get("frontend_optimization_changed")).toBe("false");
    expect(outputs.get("quality_core_changed")).toBe("false");
    expect(outputs.get("repo_governance_only")).toBe("true");
    expect(outputs.get("ui_contract_required")).toBe("false");
  });

  it("treats workflow-governance regression tests as repository-governance-only work", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      "tests/scripts/ci-merge-queue-fast-path.test.ts",
      "export {};\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("frontend_optimization_changed")).toBe("false");
    expect(outputs.get("quality_core_changed")).toBe("false");
    expect(outputs.get("repo_governance_only")).toBe("true");
    expect(outputs.get("ui_contract_required")).toBe("false");
  });

  it("keeps generic app source changes out of frontend optimization while preserving other CI checks", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      "apps/code-t3/src/app-shell.tsx",
      "export const AppShell = () => null;\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("circular_required")).toBe("true");
    expect(outputs.get("frontend_optimization_changed")).toBe("false");
    expect(outputs.get("quality_core_changed")).toBe("true");
    expect(outputs.get("repo_governance_only")).toBe("false");
    expect(outputs.get("ui_contract_required")).toBe("true");
  });

  it("keeps frontend optimization workflow wrapper edits in repository-governance lanes", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      ".github/workflows/_reusable-ci-frontend-optimization.yml",
      "name: frontend optimization\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("frontend_optimization_changed")).toBe("false");
    expect(outputs.get("quality_core_changed")).toBe("false");
    expect(outputs.get("repo_governance_only")).toBe("true");
    expect(outputs.get("ui_contract_required")).toBe("false");
  });

  it("still classifies startup and runtime-readiness files as frontend optimization work", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(tempRoot, "apps/code-t3/vite.config.ts", "export default {};\n");

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("frontend_optimization_changed")).toBe("true");
    expect(outputs.get("quality_core_changed")).toBe("true");
    expect(outputs.get("repo_governance_only")).toBe("false");
    expect(outputs.get("ui_contract_required")).toBe("true");
  });

  it("marks active t3 component changes as frontend optimization work", async () => {
    const tempRoot = await createFixtureRepo();
    await commitChangedFile(
      tempRoot,
      "apps/code-t3/src/components/update/banner.tsx",
      "export const UpdateBanner = () => null;\n"
    );

    const result = runClassifier(tempRoot);
    const outputs = parseOutputs(result.stdout);

    expect(result.status).toBe(0);
    expect(outputs.get("frontend_optimization_changed")).toBe("true");
    expect(outputs.get("quality_core_changed")).toBe("true");
    expect(outputs.get("repo_governance_only")).toBe("false");
  });
});
