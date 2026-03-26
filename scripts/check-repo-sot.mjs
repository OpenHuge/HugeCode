#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const baselines = packageJson.config?.repoBaselines ?? {};

const product = baselines.product ?? "HugeCode";
const nodeVersion = baselines.node ?? "24.11.1";
const nodeEngineRange = `>=${nodeVersion} <25`;
const pnpmVersion = baselines.pnpm ?? "10.28.0";
const rustVersion = baselines.rust ?? "1.93.1";
const pnpmMinimumReleaseAgeMinutes = "60";
const bannedLegacyToken = String.fromCharCode(99, 111, 119, 111, 114, 107);
const bannedLegacyTokenPattern = new RegExp(bannedLegacyToken, "iu");
const archiveRoot = path.join(repoRoot, "docs", "archive");
const pnpmWorkspaceRelativePath = "pnpm-workspace.yaml";
const devcontainerRelativePath = ".devcontainer/devcontainer.json";
const setupNodePnpmActionRelativePath = ".github/actions/setup-node-pnpm/action.yml";
const rustToolchainRelativePath = "rust-toolchain.toml";
const dependabotRelativePath = ".github/dependabot.yml";
const dependencyReviewWorkflowRelativePath = ".github/workflows/dependency-review.yml";
const dependencyReviewConfigRelativePath = ".github/dependency-review-config.yml";
const pullRequestTemplateRelativePath = ".github/PULL_REQUEST_TEMPLATE.md";
const releaseWorkflowRelativePath = ".github/workflows/release.yml";
const activeBiomeCompatibilityFiles = new Set([
  "scripts/check-repo-sot.mjs",
  "tests/scripts/check-repo-sot.test.ts",
]);
const biomeHistoricalPathPrefixes = ["docs/archive/", "docs/plans/"];
const biomeResiduePatterns = [
  /@biomejs\/biome/u,
  /\bbiome-ignore\b/u,
  /\bbiome\s+(?:check|format|lint)\b/u,
  /\bbiome\.jsonc?\b/u,
  /\bBiome\b/u,
];
const activeArchiveGuardFiles = [
  "README.md",
  "docs/arch.md",
  "docs/prd.md",
  "docs/runtime/README.md",
  "docs/specs/README.md",
  "docs/specs/apps/README.md",
  "docs/specs/apps/code-product-shape-2026.md",
  "docs/specs/code-runtime-spec-2026.md",
];
const analysisRoot = path.join(repoRoot, "docs", "analysis");
const forbiddenTrackedPathPrefixes = ["apps/web/", "apps/core/", "apps/edge/"];
const forbiddenTrackedPaths = new Set([
  "apps/web/package.json",
  "apps/core/package.json",
  "apps/edge/package.json",
]);
const forbiddenTrackedPathPatterns = [/^packages\/agent-[^/]+-rs\//u, /^packages\/lfcc-[^/]+\//u];
let trackedFilesCache = null;
const repoTextFileCache = new Map();
const trackedTextFileCache = new Map();

const requiredChecks = [
  {
    file: "package.json",
    includes: [
      `"name": "hugecode-workspace"`,
      `"product": "${product}"`,
      `"node": "${nodeVersion}"`,
      `"pnpm": "${pnpmVersion}"`,
      `"rust": "${rustVersion}"`,
    ],
  },
  {
    file: "README.md",
    includes: [
      `# ${product}`,
      `**Node**: \`${nodeVersion}\``,
      `**pnpm**: \`${pnpmVersion}\``,
      `**Rust**: \`${rustVersion}\``,
    ],
  },
  {
    file: "AGENTS.md",
    includes: [
      `# ${product}`,
      `Official product context: **${product}**`,
      "apps/code",
      "Do not reintroduce deleted placeholder surfaces, product-branded policy package names, or pre-`project-context:*` generator sentinels.",
      "Use `runtime-policy` for policy-domain package/module examples and `project-context:*` for generated AGENTS section markers.",
    ],
    excludes: [
      "Default context: **HypeCode**",
      "Styling | `vanilla-extract` (`.css.ts`) + CSS custom properties — **no Tailwind, no inline styles** |",
    ],
  },
  {
    file: "CLAUDE.md",
    includes: [`# ${product}`, `**Name**: ${product}`, nodeVersion, pnpmVersion],
  },
  {
    file: "CONTRIBUTING.md",
    includes: [
      `Official product name: **${product}**.`,
      "pnpm check:runtime-contract",
      "Do not restore deleted placeholder surfaces, product-branded runtime policy names, or pre-`project-context:*` generator sentinels.",
      "Use `runtime-policy` for policy-domain packages, examples, fixtures, and docs.",
      "Treat `apps/code/src/application/runtime/*` as the stable runtime API for the UI.",
      "Do not import `apps/code/src/services/*` runtime internals directly from feature/UI code.",
    ],
  },
  {
    file: "docs/development/README.md",
    includes: [
      `# ${product} Development Guide`,
      "pnpm dev",
      "pnpm check:workflow-governance",
      "pnpm check:runtime-contract",
      "pnpm web:*",
      "Root build, lint, and",
      "typecheck include the Cloudflare web shell",
    ],
  },
  {
    file: "apps/code-web/README.md",
    includes: [
      "`apps/code-web` is the current Cloudflare-platform web implementation for",
      "packages/code-workspace-client",
      "packages/code-application",
      "pnpm web:*",
    ],
    excludes: [
      "Open Fast",
      "reuses the existing `apps/code` workspace shell",
      "excluded from the root default dev/build/validate workflows",
    ],
  },
  {
    file: "apps/code-web/wrangler.jsonc",
    includes: ['"name": "hugecode-web"'],
    excludes: ['"name": "open-fast-web"'],
  },
  {
    file: "apps/code-web/app/routes/_public.index.tsx",
    includes: ['title: "HugeCode Web"'],
    excludes: ['title: "Open Fast Web"', "Open Fast web runtime"],
  },
  {
    file: "apps/code-web/app/components/WebChrome.tsx",
    includes: ["<span className={chromeBrandMeta}>HugeCode Web</span>"],
    excludes: ["Open Fast Web", ">OF<"],
  },
  {
    file: "apps/code-web/app/components/WebAboutPage.tsx",
    includes: ['aria-label="About HugeCode"'],
    excludes: ['aria-label="About Open Fast"'],
  },
  {
    file: "apps/code-web/tsconfig.json",
    excludes: ["@ku0/code/workspace-surface"],
  },
  {
    file: "scripts/lib/viteWorkspaceAliases.ts",
    excludes: ["@ku0/code/workspace-surface"],
  },
  {
    file: "vitest.aliases.ts",
    excludes: ["@ku0/code/workspace-surface"],
  },
  {
    file: "apps/code/package.json",
    excludes: ['"./workspace-surface"'],
  },
  {
    file: "scripts/config/code-web-bundle-budget.config.mjs",
    includes: ["knownLargeChunkPrefixes: {}"],
    excludes: [
      "MainAppContainerCore-",
      "MainApp-",
      "Home-",
      "SettingsView-",
      "xterm-",
      "GitDiffViewer-",
      "emacs-lisp-",
      "cpp-",
      "wasm-",
      "esm-",
      "lib-",
    ],
  },
  {
    file: "docs/development/ci-workflows.md",
    includes: [
      `# ${product} CI Workflow Map`,
      "pnpm check:workflow-governance",
      "Public Workflows vs Internal Reusable Workflows",
      "`.github/workflows/_reusable-*.yml`",
      ".github/workflows/dependency-review.yml",
      ".github/dependency-review-config.yml",
      "release.yml",
      "id-token: write",
      "publishConfig.provenance: true",
      "_reusable-desktop-prepare-frontend.yml",
    ],
  },
  {
    file: dependencyReviewWorkflowRelativePath,
    includes: [
      "name: Dependency Review",
      "pull_request:",
      "permissions:",
      "concurrency:",
      "uses: actions/dependency-review-action@v4",
      "config-file: ./.github/dependency-review-config.yml",
    ],
  },
  {
    file: dependencyReviewConfigRelativePath,
    includes: ["fail-on-severity: high", "fail-on-scopes:", "- runtime", "- unknown"],
  },
  {
    file: pullRequestTemplateRelativePath,
    includes: [
      "## Summary",
      "## Validation",
      "`pnpm validate:fast`",
      "`pnpm validate`",
      "`pnpm validate:full`",
      "## Scope",
      "## Risks / Known Issues",
      "## Spec / Docs Impact",
      "## UI Evidence",
    ],
  },
  {
    file: "docs/workspace-map.md",
    includes: [
      `# ${product} Workspace Map`,
      "Active Application Surfaces",
      "Runtime Boundary Inside `apps/code`",
      "Legacy And Non-Workspace Directories",
      "internal/runtime-policy-rs",
      "`src/application/runtime/*`",
      "`src/services/*`",
      "Removed historical placeholder app surfaces must stay absent unless a new ADR explicitly restores them with a tracked manifest and documented ownership.",
      "Use neutral technical names such as `runtime-policy` for internal modules rather than restoring retired product-branded package families.",
    ],
  },
  {
    file: "docs/runtime/README.md",
    includes: [
      `# ${product} Code Runtime`,
      "@ku0/code-runtime-host-contract",
      "/rpc",
      "/events",
      "/ws",
      "/health",
      "/ready",
      "pnpm check:runtime-contract",
      "Policy-domain package names, fixtures, and examples use the neutral `runtime-policy` family; removed product-branded policy names must not return in tracked runtime docs or code examples.",
    ],
  },
  {
    file: "packages/discovery-rs/package.json",
    includes: ['"description": "Rust mDNS discovery bindings for HugeCode."'],
    excludes: ["HypeCode"],
  },
  {
    file: "packages/discovery-rs/Cargo.toml",
    includes: ['description = "mDNS discovery bindings for HugeCode."'],
    excludes: ["HypeCode"],
  },
  {
    file: "docs/specs/README.md",
    includes: [
      "# Active Specifications",
      "current HugeCode product direction",
      "[`agentic/`](./agentic/)",
    ],
    excludes: ["./keep-up-reader-ui-spec.md", "docs/PRD.md"],
  },
  {
    file: "docs/specs/apps/README.md",
    includes: [
      "# App Specifications",
      "Active App Specs",
      "Archived Legacy App Specs",
      "code-product-shape-2026.md",
      "../../archive/apps/keep-up-reader-ui-spec.md",
    ],
    excludes: ["docs/PRD.md"],
  },
  {
    file: "docs/specs/apps/code-product-shape-2026.md",
    includes: [
      "# Code Product Shape Specification v2026.1",
      "HugeCode is a runtime-first mission control for coding agents.",
      "Define -> Delegate -> Observe -> Review -> Decide",
      "`Workspace`",
      "`Review Pack`",
      "`apps/code-web`",
    ],
    excludes: ["docs/PRD.md"],
  },
  {
    file: "docs/specs/code-runtime-spec-2026.md",
    includes: [
      "**Supersedes**: All previous drafts in `docs/archive/research/`",
      "docs/archive/research/final_consensus_best_technical_solution.md",
      "docs/archive/research/expanded_framework_analysis.md",
      "## 3. Repository Naming Guardrails",
      "Policy-domain examples and package references MUST use the `runtime-policy` family.",
      "Generated AGENTS scaffolding markers MUST use `project-context:*`.",
    ],
    excludes: ["docs/research/", "docs/PRD.md"],
  },
  {
    file: "docs/prd.md",
    includes: [
      "# HugeCode PRD",
      "**HugeCode should become the highest-trust way to delegate software engineering work to agents.**",
      "**HugeCode is a mission-control workspace that turns engineering requests and backlog items into governed autonomous runs across the right backend, then returns a review-ready evidence package so humans can decide fast.**",
    ],
    excludes: ["# Open Fast PRD", "**Open Fast** should evolve"],
  },
  {
    file: "docs/arch.md",
    includes: [
      "# HugeCode Architecture Specification",
      "implementation-guiding architecture for **HugeCode**",
      "HugeCode is a control plane for governed async engineering delegation",
    ],
    excludes: ["# Open Fast Architecture Specification", "architecture for **Open Fast**"],
  },
  {
    file: "scripts/workflow-list.mjs",
    includes: [
      "HugeCode workflow shortcuts",
      "pnpm check:workflow-governance",
      "pnpm check:runtime-contract",
      "Internal reusable workflows live under `.github/workflows/_reusable-*.yml`",
    ],
  },
  {
    file: ".github/workflows/ci.yml",
    includes: [
      "name: CI",
      "name: Repository SOT",
      "uses: ./.github/workflows/_reusable-ci-quality.yml",
      "uses: ./.github/workflows/_reusable-ci-quality-baseline.yml",
      "uses: ./.github/workflows/_reusable-ci-quality-typecheck.yml",
      "uses: ./.github/workflows/_reusable-ci-runtime-contract-parity.yml",
      "uses: ./.github/workflows/_reusable-ci-pr-affected-build.yml",
      "uses: ./.github/workflows/_reusable-ci-pr-affected-tests.yml",
    ],
  },
  {
    file: ".github/workflows/_reusable-ci-quality.yml",
    includes: ["name: _reusable-ci-quality", "name: Quality", "Quality sub-jobs did not all pass."],
  },
  {
    file: ".github/workflows/_reusable-ci-pr-affected.yml",
    includes: [
      "name: _reusable-ci-pr-affected",
      "name: PR Affected Checks",
      "Affected build/test sub-jobs did not all pass.",
    ],
  },
  {
    file: ".github/workflows/_reusable-ci-quality-baseline.yml",
    includes: ["name: _reusable-ci-quality-baseline", "name: baseline"],
  },
  {
    file: ".github/workflows/_reusable-ci-quality-typecheck.yml",
    includes: ["name: _reusable-ci-quality-typecheck", "name: typecheck"],
  },
  {
    file: ".github/workflows/_reusable-ci-runtime-contract-parity.yml",
    includes: [
      "name: _reusable-ci-runtime-contract-parity",
      "name: runtime_contract_parity",
      "name: Runtime Contract Parity",
    ],
  },
  {
    file: ".github/workflows/_reusable-ci-pr-affected-build.yml",
    includes: ["name: _reusable-ci-pr-affected-build", "name: build"],
  },
  {
    file: ".github/workflows/_reusable-ci-pr-affected-tests.yml",
    includes: ["name: _reusable-ci-pr-affected-tests", "name: tests"],
  },
  {
    file: ".github/workflows/_reusable-ci-frontend-optimization.yml",
    includes: ["name: _reusable-ci-frontend-optimization", "name: frontend_optimization"],
  },
  {
    file: ".github/workflows/desktop.yml",
    includes: [
      "name: Desktop (Tauri)",
      "uses: ./.github/workflows/_reusable-desktop-prepare-frontend.yml",
      "uses: ./.github/workflows/_reusable-desktop-build-pr.yml",
      "uses: ./.github/workflows/_reusable-desktop-build-release.yml",
    ],
  },
  {
    file: ".github/workflows/_reusable-desktop-prepare-frontend.yml",
    includes: [
      "name: _reusable-desktop-prepare-frontend",
      "name: Prepare frontend dist",
      "Skip frontend dist preparation while Tauri retires",
    ],
  },
  {
    file: ".github/workflows/_reusable-desktop-build-pr.yml",
    includes: [
      "name: _reusable-desktop-build-pr",
      "name: Build PR",
      "Skip Tauri PR build while runtime retires",
    ],
  },
  {
    file: ".github/workflows/_reusable-desktop-build-release.yml",
    includes: [
      "name: _reusable-desktop-build-release",
      "name: Build",
      "Skip Tauri release build while runtime retires",
    ],
  },
  {
    file: releaseWorkflowRelativePath,
    includes: [
      "name: Release",
      "id-token: write",
      'NPM_CONFIG_PROVENANCE: "true"',
      "publish: pnpm release",
    ],
  },
];

const internalIdentityChecks = [
  {
    file: "docs/design-system/ui-quality-gap-analysis.md",
    includes: [
      "HugeCode application UI can drift away from premium product quality",
      "The HugeCode application has comprehensive design specifications",
      "Linear/Arc/Raycast",
      "HugeCode Current",
      "the HugeCode UI can achieve parity",
    ],
    forbids: ["Keep-Up application UI", "The Keep-Up application"],
  },
  {
    file: "docs/design-system/ui-polish-guidelines.md",
    includes: ["premium UI quality across HugeCode surfaces."],
    forbids: ["premium UI quality across Keep-Up surfaces."],
  },
  {
    file: "docs/specs/README.md",
    includes: ["# Active Specifications", "current HugeCode product direction"],
  },
  {
    file: "docs/specs/code-runtime-spec-2026.md",
    includes: ["active HugeCode code runtime for the coding-agent product"],
    forbids: ["Keep-Up code runtime for the coding-agent product"],
  },
  {
    file: "docs/prd.md",
    includes: [
      "# HugeCode PRD",
      "**HugeCode should become the highest-trust way to delegate software engineering work to agents.**",
    ],
    forbids: ["# Open Fast PRD", "**Open Fast** should evolve into"],
  },
  {
    file: "docs/arch.md",
    includes: [
      "# HugeCode Architecture Specification",
      "implementation-guiding architecture for **HugeCode**",
    ],
    forbids: ["# Open Fast Architecture Specification", "architecture for **Open Fast**"],
  },
  {
    file: "docs/specs/agentic/README.md",
    includes: ["Owner: HugeCode (Code Runtime Support Contracts)"],
  },
  {
    file: "package.json",
    forbids: ["open_fast_web"],
  },
  {
    file: "scripts/verify_pr.sh",
    includes: [
      'git config user.name "HugeCode Agent"',
      'git config user.email "agent@hugecode.bot"',
    ],
    forbids: [
      'git config user.name "HypeCode Agent"',
      'git config user.email "agent@hypecode.bot"',
      'git config user.name "Keep-Up Agent"',
      'git config user.email "agent@keep-up.bot"',
    ],
  },
];

const errors = [];

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function walkMarkdownFiles(dirPath) {
  const results = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(entryPath);
    }
  }

  return results;
}

function listTrackedFiles() {
  if (trackedFilesCache !== null) {
    return trackedFilesCache;
  }

  trackedFilesCache = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split(/\r?\n/u)
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(repoRoot, file)));

  return trackedFilesCache;
}

function readRepoTextFile(relativePath) {
  if (repoTextFileCache.has(relativePath)) {
    return repoTextFileCache.get(relativePath);
  }

  try {
    const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    repoTextFileCache.set(relativePath, content);
    return content;
  } catch {
    repoTextFileCache.set(relativePath, null);
    return null;
  }
}

function readTrackedTextFile(file) {
  if (!trackedTextFileCache.has(file)) {
    trackedTextFileCache.set(file, readRepoTextFile(file));
  }

  return trackedTextFileCache.get(file);
}

function readRepoJsonFile(relativePath) {
  const content = readRepoTextFile(relativePath);
  if (content === null) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function checkPublicPackagePublishMetadata(relativePath, expectedDirectory) {
  const packageJson = readRepoJsonFile(relativePath);
  if (packageJson === null) {
    errors.push(`${relativePath}: file is missing or invalid JSON`);
    return;
  }

  const repository = packageJson.repository;
  if (
    !repository ||
    repository.type !== "git" ||
    repository.url !== "https://github.com/OpenHuge/HugeCode.git" ||
    repository.directory !== expectedDirectory
  ) {
    errors.push(
      `${relativePath}: repository must target https://github.com/OpenHuge/HugeCode.git with directory ${expectedDirectory}`
    );
  }

  if (packageJson.publishConfig?.access !== "public") {
    errors.push(`${relativePath}: publishConfig.access must be public`);
  }

  if (packageJson.publishConfig?.provenance !== true) {
    errors.push(`${relativePath}: publishConfig.provenance must be true`);
  }
}

function readSingleLineYamlScalar(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*([^#\\n]+)`, "mu"));
  return match?.[1]?.trim() ?? null;
}

function readActionInputDefault(content, inputName) {
  const lines = content.split(/\r?\n/u);
  let inInputs = false;
  let inTargetInput = false;
  let targetIndent = 0;

  for (const line of lines) {
    const indent = line.match(/^ */u)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (!inInputs) {
      if (trimmed === "inputs:") {
        inInputs = true;
      }
      continue;
    }

    if (indent === 0 && trimmed.length > 0) {
      break;
    }

    if (indent === 2 && trimmed === `${inputName}:`) {
      inTargetInput = true;
      targetIndent = indent;
      continue;
    }

    if (inTargetInput && indent <= targetIndent && trimmed.length > 0) {
      inTargetInput = false;
    }

    if (!inTargetInput) {
      continue;
    }

    if (trimmed.startsWith("default:")) {
      const rawValue = trimmed.slice("default:".length).trim();
      return rawValue.replace(/^"(.*)"$/u, "$1");
    }
  }

  return null;
}

function collectTrackedCargoManifestDirectories() {
  return new Set(
    listTrackedFiles()
      .filter((file) => file.endsWith("/Cargo.toml") || file === "Cargo.toml")
      .map((file) => `/${path.posix.dirname(file)}`)
      .sort()
  );
}

function collectDependabotCargoDirectories(content) {
  const cargoDirs = new Set();
  const lines = content.split(/\r?\n/u);
  let inCargoBlock = false;
  let collectingDirectories = false;

  for (const line of lines) {
    const indent = line.match(/^ */u)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (indent === 2 && trimmed.startsWith("- package-ecosystem:")) {
      inCargoBlock = trimmed === '- package-ecosystem: "cargo"';
      collectingDirectories = false;
      continue;
    }

    if (!inCargoBlock || trimmed.length === 0) {
      continue;
    }

    if (trimmed.startsWith("directory:")) {
      cargoDirs.add(trimmed.slice("directory:".length).trim());
      collectingDirectories = false;
      continue;
    }

    if (trimmed === "directories:") {
      collectingDirectories = true;
      continue;
    }

    if (collectingDirectories) {
      if (indent >= 6 && trimmed.startsWith("- ")) {
        cargoDirs.add(trimmed.slice(2).trim());
        continue;
      }

      if (indent <= 4) {
        collectingDirectories = false;
      }
    }
  }

  return cargoDirs;
}

function findTrackedFilesWithBannedLegacyToken() {
  return listTrackedFiles().filter((file) => bannedLegacyTokenPattern.test(file));
}

function findForbiddenTrackedSurfacePaths() {
  return listTrackedFiles().filter((file) => {
    if (forbiddenTrackedPaths.has(file)) {
      return true;
    }
    if (forbiddenTrackedPathPatterns.some((pattern) => pattern.test(file))) {
      return true;
    }
    return forbiddenTrackedPathPrefixes.some((prefix) => file.startsWith(prefix));
  });
}

function findTrackedContentWithBannedLegacyToken() {
  const matches = [];
  const normalizedToken = bannedLegacyToken.toLowerCase();

  for (const file of listTrackedFiles()) {
    const content = readTrackedTextFile(file);
    if (content === null) {
      continue;
    }

    const lines = content.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.toLowerCase().includes(normalizedToken)) {
        continue;
      }

      matches.push(`${file}:${index + 1}:${line.trim()}`);
    }
  }

  return matches;
}

function isHistoricalBiomePath(file) {
  return biomeHistoricalPathPrefixes.some((prefix) => file.startsWith(prefix));
}

function findDisallowedBiomeResidue() {
  const matches = [];

  for (const file of listTrackedFiles()) {
    if (activeBiomeCompatibilityFiles.has(file) || isHistoricalBiomePath(file)) {
      continue;
    }

    const baseName = path.posix.basename(file);
    if (baseName === "biome.json" || baseName === "biome.jsonc") {
      matches.push(
        `${file}: tracked Biome config files are not allowed outside the compatibility layer`
      );
      continue;
    }

    const content = readTrackedTextFile(file);
    if (content === null) {
      continue;
    }

    const firstMatchingPattern = biomeResiduePatterns.find((pattern) => pattern.test(content));
    if (firstMatchingPattern) {
      matches.push(
        `${file}: active tracked content contains forbidden Biome residue (${firstMatchingPattern})`
      );
    }
  }

  return matches;
}

if (packageJson.packageManager !== `pnpm@${pnpmVersion}`) {
  errors.push(`package.json: packageManager must be pnpm@${pnpmVersion}`);
}

if (packageJson.engines?.node !== nodeEngineRange) {
  errors.push(`package.json: engines.node must be ${nodeEngineRange}`);
}

if (packageJson.engines?.pnpm !== pnpmVersion) {
  errors.push(`package.json: engines.pnpm must be ${pnpmVersion}`);
}

const nvmrc = readRepoTextFile(".nvmrc");
if (nvmrc === null) {
  errors.push(".nvmrc: file is missing");
} else if (nvmrc.trim() !== nodeVersion) {
  errors.push(`.nvmrc must be ${nodeVersion}`);
}

const pnpmWorkspace = readRepoTextFile(pnpmWorkspaceRelativePath);
if (pnpmWorkspace === null) {
  errors.push(`${pnpmWorkspaceRelativePath}: file is missing`);
} else {
  if (readSingleLineYamlScalar(pnpmWorkspace, "nodeVersion") !== nodeVersion) {
    errors.push(`${pnpmWorkspaceRelativePath}: nodeVersion must be ${nodeVersion}`);
  }

  if (readSingleLineYamlScalar(pnpmWorkspace, "engineStrict") !== "true") {
    errors.push(`${pnpmWorkspaceRelativePath}: engineStrict must be true`);
  }

  if (
    readSingleLineYamlScalar(pnpmWorkspace, "minimumReleaseAge") !== pnpmMinimumReleaseAgeMinutes
  ) {
    errors.push(
      `${pnpmWorkspaceRelativePath}: minimumReleaseAge must be ${pnpmMinimumReleaseAgeMinutes}`
    );
  }

  if (readSingleLineYamlScalar(pnpmWorkspace, "blockExoticSubdeps") !== "true") {
    errors.push(`${pnpmWorkspaceRelativePath}: blockExoticSubdeps must be true`);
  }

  if (readSingleLineYamlScalar(pnpmWorkspace, "strictDepBuilds") !== "true") {
    errors.push(`${pnpmWorkspaceRelativePath}: strictDepBuilds must be true`);
  }

  if (readSingleLineYamlScalar(pnpmWorkspace, "verifyDepsBeforeRun") !== "warn") {
    errors.push(`${pnpmWorkspaceRelativePath}: verifyDepsBeforeRun must be warn`);
  }
}

const devcontainerConfig = readRepoJsonFile(devcontainerRelativePath);
if (devcontainerConfig === null) {
  errors.push(`${devcontainerRelativePath}: file is missing or invalid JSON`);
} else {
  const devcontainerNodeVersion =
    devcontainerConfig.features?.["ghcr.io/devcontainers/features/node:1"]?.version;
  if (devcontainerNodeVersion !== nodeVersion) {
    errors.push(`${devcontainerRelativePath}: Node feature version must be ${nodeVersion}`);
  }

  const devcontainerRustVersion =
    devcontainerConfig.features?.["ghcr.io/devcontainers/features/rust:1"]?.version;
  if (devcontainerRustVersion !== rustVersion) {
    errors.push(`${devcontainerRelativePath}: Rust feature version must be ${rustVersion}`);
  }
}

const setupNodePnpmAction = readRepoTextFile(setupNodePnpmActionRelativePath);
if (setupNodePnpmAction === null) {
  errors.push(`${setupNodePnpmActionRelativePath}: file is missing`);
} else {
  if (readActionInputDefault(setupNodePnpmAction, "pnpm-version") !== pnpmVersion) {
    errors.push(`${setupNodePnpmActionRelativePath}: pnpm-version default must be ${pnpmVersion}`);
  }

  if (readActionInputDefault(setupNodePnpmAction, "node-version-file") !== ".nvmrc") {
    errors.push(`${setupNodePnpmActionRelativePath}: node-version-file default must be .nvmrc`);
  }
}

const rustToolchain = readRepoTextFile(rustToolchainRelativePath);
if (rustToolchain === null) {
  errors.push(`${rustToolchainRelativePath}: file is missing`);
} else {
  const rustChannelMatch = rustToolchain.match(/^channel\s*=\s*"([^"]+)"/mu);
  if (rustChannelMatch?.[1] !== rustVersion) {
    errors.push(`${rustToolchainRelativePath}: toolchain channel must be ${rustVersion}`);
  }
}

const dependabotConfig = readRepoTextFile(dependabotRelativePath);
if (dependabotConfig === null) {
  errors.push(`${dependabotRelativePath}: file is missing`);
} else {
  const trackedCargoManifestDirs = collectTrackedCargoManifestDirectories();
  const dependabotCargoDirs = collectDependabotCargoDirectories(dependabotConfig);

  for (const manifestDir of trackedCargoManifestDirs) {
    if (!dependabotCargoDirs.has(manifestDir)) {
      errors.push(`${dependabotRelativePath}: missing cargo directory ${manifestDir}`);
    }
  }

  for (const dependabotDir of dependabotCargoDirs) {
    if (!trackedCargoManifestDirs.has(dependabotDir)) {
      errors.push(`${dependabotRelativePath}: cargo directory does not exist: ${dependabotDir}`);
    }
  }
}

checkPublicPackagePublishMetadata("packages/shared/package.json", "packages/shared");
checkPublicPackagePublishMetadata("packages/discovery-rs/package.json", "packages/discovery-rs");

for (const check of requiredChecks) {
  const content = readRepoTextFile(check.file);
  if (content === null) {
    errors.push(`${check.file}: file is missing`);
    continue;
  }

  for (const expected of check.includes ?? []) {
    if (!content.includes(expected)) {
      errors.push(`${check.file}: missing required text: ${JSON.stringify(expected)}`);
    }
  }

  for (const forbidden of check.excludes ?? []) {
    if (content.includes(forbidden)) {
      errors.push(`${check.file}: contains forbidden text: ${JSON.stringify(forbidden)}`);
    }
  }
}

for (const check of internalIdentityChecks) {
  const content = readRepoTextFile(check.file);
  if (content === null) {
    errors.push(`${check.file}: file is missing`);
    continue;
  }

  for (const expected of check.includes ?? []) {
    if (!content.includes(expected)) {
      errors.push(`${check.file}: missing internal identity text: ${JSON.stringify(expected)}`);
    }
  }

  for (const forbidden of check.forbids ?? []) {
    if (content.includes(forbidden)) {
      errors.push(`${check.file}: internal identity drift detected: ${JSON.stringify(forbidden)}`);
    }
  }
}

for (const file of activeArchiveGuardFiles) {
  const content = readRepoTextFile(file);
  if (content === null) {
    errors.push(`${file}: file is missing`);
    continue;
  }
  if (content.includes("docs/research/")) {
    errors.push(`${file}: active docs must not reference docs/research/`);
  }
  if (content.includes("docs/analysis/")) {
    errors.push(`${file}: active docs must not reference docs/analysis/`);
  }
  if (content.includes("docs/PRD.md")) {
    errors.push(`${file}: active docs must not reference docs/PRD.md`);
  }
}

const analysisFiles = walkMarkdownFiles(analysisRoot);
if (analysisFiles.length > 0) {
  errors.push("docs/analysis: active analysis docs must be archived under docs/archive/analysis/");
}

const archiveFiles = walkMarkdownFiles(archiveRoot);

for (const archiveFile of archiveFiles) {
  const relativePath = toPosixPath(path.relative(repoRoot, archiveFile));
  const content = readRepoTextFile(relativePath);
  if (content === null) {
    errors.push(`${relativePath}: file is missing`);
    continue;
  }
  const topLines = content.split(/\r?\n/u).slice(0, 20).join("\n");

  if (!content.startsWith("# [ARCHIVED]") && !content.startsWith("# [SUPERSEDED]")) {
    errors.push(`${relativePath}: archive docs must start with # [ARCHIVED] or # [SUPERSEDED]`);
  }

  if (!topLines.includes("Current source of truth:")) {
    errors.push(
      `${relativePath}: archive docs must declare a current source of truth near the top`
    );
  }
}

const trackedPathsWithBannedToken = findTrackedFilesWithBannedLegacyToken();
for (const trackedPath of trackedPathsWithBannedToken) {
  errors.push(`${trackedPath}: tracked path contains a banned legacy token`);
}

const forbiddenTrackedSurfacePaths = findForbiddenTrackedSurfacePaths();
for (const trackedPath of forbiddenTrackedSurfacePaths) {
  errors.push(
    `${trackedPath}: tracked placeholder or retired surface paths are not allowed in the focused coding-agent repo`
  );
}

const trackedContentWithBannedToken = findTrackedContentWithBannedLegacyToken();
for (const match of trackedContentWithBannedToken) {
  errors.push(`${match}: tracked content contains a banned legacy token`);
}

const disallowedBiomeResidue = findDisallowedBiomeResidue();
for (const match of disallowedBiomeResidue) {
  errors.push(match);
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`${error}\n`);
  }
  process.exit(1);
}

process.stdout.write("Repository source-of-truth check passed.\n");
