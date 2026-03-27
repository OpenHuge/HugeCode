import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const tempRoots: string[] = [];
const bannedLegacyToken = String.fromCharCode(99, 111, 119, 111, 114, 107);
const repoSotTestTimeoutMs = 30_000;

const requiredEntries = [
  ".nvmrc",
  ".devcontainer/devcontainer.json",
  ".github/actions/setup-node-pnpm",
  ".github/dependabot.yml",
  ".github/dependency-review-config.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "package.json",
  "pnpm-workspace.yaml",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "rust-toolchain.toml",
  "docs",
  ".github/workflows",
  path.join("apps", "code", "package.json"),
  path.join("apps", "code-electron", "package.json"),
  path.join("apps", "code-web"),
  path.join("internal", "runtime-policy-rs", "Cargo.toml"),
  path.join("packages", "code-runtime-service-rs", "Cargo.toml"),
  path.join("packages", "discovery-rs", "Cargo.toml"),
  path.join("packages", "discovery-rs", "package.json"),
  path.join("packages", "model-fabric-rs", "Cargo.toml"),
  path.join("packages", "runtime-diagnostics-export-core-rs", "Cargo.toml"),
  path.join("packages", "runtime-shell-core-rs", "Cargo.toml"),
  path.join("packages", "sandbox-rs", "Cargo.toml"),
  path.join("packages", "shared", "package.json"),
  path.join("packages", "tokenizer-rs", "native", "Cargo.toml"),
  path.join("scripts", "config", "code-web-bundle-budget.config.mjs"),
  "scripts/check-repo-sot.mjs",
  path.join("scripts", "lib"),
  "scripts/workflow-list.mjs",
  "scripts/verify_pr.sh",
  "vitest.aliases.ts",
];

async function copyRequiredEntries(targetRoot: string): Promise<void> {
  for (const relativePath of requiredEntries) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
}

function runGit(targetRoot: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd: targetRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

async function createTrackedFixtureRepo(targetRoot: string): Promise<void> {
  await copyRequiredEntries(targetRoot);
  runGit(targetRoot, ["init", "--initial-branch=main"]);
  runGit(targetRoot, ["add", "-A"]);
}

function stageFixtureChanges(targetRoot: string) {
  runGit(targetRoot, ["add", "-A"]);
}

function runRepoSot(targetRoot: string) {
  return spawnSync(process.execPath, [path.join(targetRoot, "scripts", "check-repo-sot.mjs")], {
    cwd: targetRoot,
    encoding: "utf8",
  });
}

describe("check-repo-sot", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.map(async (rootPath) => {
        await rm(rootPath, { recursive: true, force: true });
      })
    );
    tempRoots.length = 0;
  });

  it(
    "passes on the current repository baseline",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Repository source-of-truth check passed.");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when active internal files reintroduce Keep-Up identity strings",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const polishGuidelinesPath = path.join(
        tempRoot,
        "docs",
        "design-system",
        "ui-polish-guidelines.md"
      );
      const polishGuidelines = await readFile(polishGuidelinesPath, "utf8");
      await writeFile(
        polishGuidelinesPath,
        polishGuidelines.replace(
          "premium UI quality across HugeCode surfaces.",
          "premium UI quality across Keep-Up surfaces."
        ),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("docs/design-system/ui-polish-guidelines.md");
      expect(result.stderr).toContain("Keep-Up");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when contributor docs lose zero-residue guidance",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const contributingPath = path.join(tempRoot, "CONTRIBUTING.md");
      const contributing = await readFile(contributingPath, "utf8");
      await writeFile(
        contributingPath,
        contributing.replace(
          "Do not restore deleted placeholder surfaces, product-branded runtime policy names, or pre-`project-context:*` generator sentinels. `pnpm check:repo:sot` enforces this rule.",
          ""
        ),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("CONTRIBUTING.md");
      expect(result.stderr).toContain("Do not restore deleted placeholder surfaces");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when archived analysis docs lose the required archive header contract",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const archivedAnalysisPath = path.join(
        tempRoot,
        "docs",
        "archive",
        "analysis",
        "architecture-deep-dive.md"
      );
      await mkdir(path.dirname(archivedAnalysisPath), { recursive: true });
      await writeFile(
        archivedAnalysisPath,
        "# Architecture Deep Dive\n\nCurrent source of truth: docs/arch.md\n",
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("docs/archive/analysis/architecture-deep-dive.md");
      expect(result.stderr).toContain("archive docs must start");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when markdown files remain under docs/analysis",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const legacyAnalysisPath = path.join(tempRoot, "docs", "analysis", "migrated.md");
      await mkdir(path.dirname(legacyAnalysisPath), { recursive: true });
      await writeFile(legacyAnalysisPath, "# Legacy Analysis\n", "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("docs/analysis: active analysis docs must be archived");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when tracked content reintroduces the banned legacy token",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const readmePath = path.join(tempRoot, "README.md");
      const readme = await readFile(readmePath, "utf8");
      await writeFile(readmePath, `${readme}\n${bannedLegacyToken}\n`, "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("tracked content contains a banned legacy token");
      expect(result.stderr).toContain(bannedLegacyToken);
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when pnpm workspace supply-chain guardrails drift from the repo baseline",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const workspacePath = path.join(tempRoot, "pnpm-workspace.yaml");
      const workspaceContent = await readFile(workspacePath, "utf8");
      await writeFile(
        workspacePath,
        workspaceContent.replace("blockExoticSubdeps: true", "blockExoticSubdeps: false"),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("pnpm-workspace.yaml: blockExoticSubdeps must be true");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when the release workflow loses npm provenance configuration",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const releaseWorkflowPath = path.join(tempRoot, ".github", "workflows", "release.yml");
      const releaseWorkflow = await readFile(releaseWorkflowPath, "utf8");
      await writeFile(
        releaseWorkflowPath,
        releaseWorkflow.replace('NPM_CONFIG_PROVENANCE: "true"\n', ""),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(".github/workflows/release.yml");
      expect(result.stderr).toContain("NPM_CONFIG_PROVENANCE");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when public package provenance metadata drifts",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const sharedPackagePath = path.join(tempRoot, "packages", "shared", "package.json");
      const sharedPackage = await readFile(sharedPackagePath, "utf8");
      await writeFile(
        sharedPackagePath,
        sharedPackage.replace('"provenance": true', '"provenance": false'),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "packages/shared/package.json: publishConfig.provenance must be true"
      );
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when active tracked files reintroduce Biome residue outside compatibility shims",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const packageJsonPath = path.join(tempRoot, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
        devDependencies?: Record<string, string>;
      };
      packageJson.devDependencies = {
        ...(packageJson.devDependencies ?? {}),
        "@biomejs/biome": "^2.4.4",
      };
      await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("package.json");
      expect(result.stderr).toContain("forbidden Biome residue");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when a tracked path reintroduces the banned legacy token",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const legacyPath = path.join(tempRoot, "apps", bannedLegacyToken, "README.md");
      await mkdir(path.dirname(legacyPath), { recursive: true });
      await writeFile(legacyPath, "# Historical placeholder\n", "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("tracked path contains a banned legacy token");
      expect(result.stderr).toContain(path.posix.join("apps", bannedLegacyToken, "README.md"));
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when a tracked placeholder app surface regains files",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const placeholderManifestPath = path.join(tempRoot, "apps", "web", "package.json");
      await mkdir(path.dirname(placeholderManifestPath), { recursive: true });
      await writeFile(placeholderManifestPath, '{ "name": "@ku0/web" }\n', "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("apps/web/package.json");
      expect(result.stderr).toContain(
        "tracked placeholder or retired surface paths are not allowed"
      );
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when a retired package family is reintroduced",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const retiredPackagePath = path.join(tempRoot, "packages", "agent-legacy-rs", "package.json");
      await mkdir(path.dirname(retiredPackagePath), { recursive: true });
      await writeFile(retiredPackagePath, '{ "name": "@ku0/agent-legacy-rs" }\n', "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("packages/agent-legacy-rs/package.json");
      expect(result.stderr).toContain(
        "tracked placeholder or retired surface paths are not allowed"
      );
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when the PRD reintroduces Open Fast branding",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const prdPath = path.join(tempRoot, "docs", "prd.md");
      const prd = await readFile(prdPath, "utf8");
      await writeFile(prdPath, prd.replace("# HugeCode PRD", "# Open Fast PRD"), "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("docs/prd.md");
      expect(result.stderr).toContain("Open Fast PRD");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when the architecture spec reintroduces Open Fast branding",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const architecturePath = path.join(tempRoot, "docs", "arch.md");
      const architecture = await readFile(architecturePath, "utf8");
      await writeFile(
        architecturePath,
        architecture.replace(
          "implementation-guiding architecture for **HugeCode**",
          "implementation-guiding architecture for **Open Fast**"
        ),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("docs/arch.md");
      expect(result.stderr).toContain("Open Fast");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when the active web shell reintroduces Open Fast branding",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const webIndexPath = path.join(
        tempRoot,
        "apps",
        "code-web",
        "app",
        "routes",
        "_public.index.tsx"
      );
      const webIndex = await readFile(webIndexPath, "utf8");
      await writeFile(webIndexPath, webIndex.replace("HugeCode Web", "Open Fast Web"), "utf8");
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("apps/code-web/app/routes/_public.index.tsx");
      expect(result.stderr).toContain("Open Fast Web");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when the active web deployment name reintroduces the Open Fast worker id",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const wranglerPath = path.join(tempRoot, "apps", "code-web", "wrangler.jsonc");
      const wrangler = await readFile(wranglerPath, "utf8");
      await writeFile(
        wranglerPath,
        wrangler.replace('"name": "hugecode-web"', '"name": "open-fast-web"'),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("apps/code-web/wrangler.jsonc");
      expect(result.stderr).toContain("open-fast-web");
    },
    repoSotTestTimeoutMs
  );

  it(
    "fails when the web bundle budget config reintroduces desktop-only chunk baselines",
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), "repo-sot-"));
      tempRoots.push(tempRoot);
      await createTrackedFixtureRepo(tempRoot);

      const budgetConfigPath = path.join(
        tempRoot,
        "scripts",
        "config",
        "code-web-bundle-budget.config.mjs"
      );
      const budgetConfig = await readFile(budgetConfigPath, "utf8");
      await writeFile(
        budgetConfigPath,
        budgetConfig.replace(
          "knownLargeChunkPrefixes: {}",
          'knownLargeChunkPrefixes: { "MainAppContainerCore-": 1450000 }'
        ),
        "utf8"
      );
      stageFixtureChanges(tempRoot);

      const result = runRepoSot(tempRoot);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("scripts/config/code-web-bundle-budget.config.mjs");
      expect(result.stderr).toContain("MainAppContainerCore-");
    },
    repoSotTestTimeoutMs
  );
});
