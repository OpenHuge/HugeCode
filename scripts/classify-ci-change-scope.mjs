#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 && !allowFailure) {
    const rendered = result.stderr?.trim() || `git ${args.join(" ")} failed`;
    throw new Error(rendered);
  }

  return result;
}

function resolveDiffArgs(baseRef, headRef) {
  const candidates = [
    ["diff", "--name-only", `${baseRef}...${headRef}`],
    ["diff", "--name-only", baseRef, headRef],
  ];

  for (const candidate of candidates) {
    const result = runGit(candidate, { allowFailure: true });
    if (result.status === 0) {
      return candidate.slice(2);
    }
  }

  throw new Error(`Unable to diff ${baseRef} against ${headRef}`);
}

function isManifestLikeFile(file) {
  return (
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file.endsWith("/package.json") ||
    file.endsWith("/Cargo.toml") ||
    file.endsWith("/Cargo.lock")
  );
}

function isMarkdownLikeFile(file) {
  return file.endsWith(".md") || file.endsWith(".mdx");
}

function writeOutput(name, value) {
  const rendered = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, rendered);
    return;
  }

  process.stdout.write(rendered);
}

const REPO_GOVERNANCE_TEST_FILES = new Set([
  "tests/scripts/check-repo-sot.test.ts",
  "tests/scripts/check-workflow-governance.test.ts",
  "tests/scripts/classify-ci-change-scope.test.ts",
  "tests/scripts/classify-electron-beta-scope.test.ts",
  "tests/scripts/ci-merge-queue-fast-path.test.ts",
  "tests/scripts/codeql-merge-queue-fast-path.test.ts",
  "tests/scripts/optional-pr-workflow-scope.test.ts",
  "tests/scripts/pr-auto-merge-workflow.test.ts",
  "tests/scripts/pr-branch-maintenance-workflow.test.ts",
]);

function isBuildSkipEligibleFile(file) {
  return (
    isMarkdownLikeFile(file) ||
    file.endsWith(".test.ts") ||
    file.endsWith(".test.tsx") ||
    file.endsWith(".spec.ts") ||
    file.endsWith(".spec.tsx") ||
    file.endsWith(".stories.ts") ||
    file.endsWith(".stories.tsx") ||
    file.endsWith(".stories.mdx") ||
    file.includes("/__tests__/") ||
    file.includes("/src/test/") ||
    file.includes("/src/fixtures/")
  );
}

function isTestSkipEligibleFile(file) {
  return (
    isMarkdownLikeFile(file) ||
    file.endsWith(".stories.ts") ||
    file.endsWith(".stories.tsx") ||
    file.endsWith(".stories.mdx") ||
    file.includes("/__fixtures__/") ||
    file.includes("/__tests__/fixtures/") ||
    file.includes("/src/fixtures/")
  );
}

function isUiTestLikeFile(file) {
  return (
    file.endsWith(".test.ts") ||
    file.endsWith(".test.tsx") ||
    file.endsWith(".spec.ts") ||
    file.endsWith(".spec.tsx") ||
    file.endsWith(".stories.ts") ||
    file.endsWith(".stories.tsx") ||
    file.endsWith(".stories.mdx") ||
    file.includes("/__tests__/") ||
    file.includes("/src/test/") ||
    file.includes("/src/fixtures/")
  );
}

function isDesignSystemExcludedFile(file) {
  return (
    isMarkdownLikeFile(file) ||
    file.endsWith(".test.ts") ||
    file.endsWith(".test.tsx") ||
    file.endsWith(".spec.ts") ||
    file.endsWith(".spec.tsx") ||
    file.endsWith(".stories.ts") ||
    file.endsWith(".stories.tsx") ||
    file.endsWith(".stories.mdx") ||
    file.includes("/__tests__/")
  );
}

const FRONTEND_OPTIMIZATION_EXACT_FILES = new Set([
  ".codex/e2e-map.json",
  "apps/code/index.html",
  "apps/code/package.json",
  "apps/code/src/main.tsx",
  "apps/code/vite.config.ts",
  "playwright.config.local.ts",
  "scripts/check-code-bundle-budget.mjs",
  "scripts/config/code-bundle-budget.config.mjs",
  "scripts/lib/e2e-map.mjs",
  "scripts/report-code-bundle.mjs",
  "tests/e2e/package.json",
  "tsconfig.base.json",
  "turbo.json",
]);

const FRONTEND_OPTIMIZATION_PREFIXES = [
  "apps/code/src/application/runtime/",
  "apps/code/src/bootstrap/",
  "apps/code/src/services/runtimeClient",
  "apps/code/src/web/",
  "packages/design-system/",
  "tests/e2e/",
];

function isQualityCoreFile(file) {
  if (
    file.startsWith("docs/") ||
    isMarkdownLikeFile(file) ||
    REPO_GOVERNANCE_TEST_FILES.has(file)
  ) {
    return false;
  }

  return (
    file.startsWith("apps/") ||
    file.startsWith("packages/") ||
    file.startsWith("tests/") ||
    file.startsWith("patches/") ||
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "turbo.json"
  );
}

function isUiContractFile(file) {
  if (
    file === "scripts/check-ui-service-boundary.mjs" ||
    file === "scripts/check-app-source-boundary.mjs" ||
    file === "scripts/check-platform-boundaries.mjs" ||
    file === "scripts/lib/ui-service-boundary.mjs"
  ) {
    return true;
  }

  if (file.startsWith("apps/code/") || file.startsWith("apps/code-web/")) {
    return !isMarkdownLikeFile(file) && !isUiTestLikeFile(file);
  }

  if (
    file.startsWith("packages/code-application/") ||
    file.startsWith("packages/code-platform-interfaces/") ||
    file.startsWith("packages/code-workspace-client/")
  ) {
    return !isMarkdownLikeFile(file);
  }

  return false;
}

function isAppCircularFile(file) {
  return file.startsWith("apps/code/src/") && !isUiTestLikeFile(file) && !isMarkdownLikeFile(file);
}

function isFrontendOptimizationFile(file) {
  if (FRONTEND_OPTIMIZATION_EXACT_FILES.has(file)) {
    return true;
  }

  if (FRONTEND_OPTIMIZATION_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return !isMarkdownLikeFile(file) && !isUiTestLikeFile(file);
  }

  return false;
}

function isRepoGovernanceOnlyFile(file) {
  return (
    REPO_GOVERNANCE_TEST_FILES.has(file) ||
    file === "README.md" ||
    file === "AGENTS.md" ||
    file === "CLAUDE.md" ||
    file === "CONTRIBUTING.md" ||
    file.startsWith(".github/workflows/") ||
    file.startsWith(".github/actions/") ||
    file === "docs/README.md" ||
    file === "docs/architecture/README.md" ||
    file === "docs/architecture/frontend-style-governance.md" ||
    file === "docs/development/README.md" ||
    file === "docs/development/ci-workflows.md" ||
    file === "docs/workspace-map.md" ||
    file === "docs/runtime/README.md" ||
    file.startsWith("docs/adr/") ||
    file === "scripts/check-branch-policy.mjs" ||
    file === "scripts/lib/branch-policy.mjs" ||
    file === "scripts/check-repo-sot.mjs" ||
    file === "scripts/check-workflow-governance.mjs" ||
    file === "scripts/check-workspace-task-coverage.mjs" ||
    file === "scripts/classify-ci-change-scope.mjs" ||
    file === "scripts/classify-electron-beta-scope.mjs" ||
    file === "scripts/codex-preflight.mjs" ||
    file === "scripts/workflow-list.mjs"
  );
}

const baseRef = process.env.CI_SCOPE_BASE_REF?.trim() || "HEAD^";
const headRef = process.env.CI_SCOPE_HEAD_REF?.trim() || "HEAD";
const diffArgs = resolveDiffArgs(baseRef, headRef);
const nameOnly = runGit(["diff", "--name-only", ...diffArgs])
  .stdout.split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const changedFiles = new Set(nameOnly);
const manifestFiles = nameOnly.filter(isManifestLikeFile);
const manifestOnly = nameOnly.length > 0 && manifestFiles.length === nameOnly.length;
const buildSkipEligibleOnly =
  nameOnly.length > 0 && nameOnly.every((file) => isBuildSkipEligibleFile(file));
const testSkipEligibleOnly =
  nameOnly.length > 0 && nameOnly.every((file) => isTestSkipEligibleFile(file));
const repoGovernanceOnly =
  nameOnly.length > 0 && nameOnly.every((file) => isRepoGovernanceOnlyFile(file));
const qualityCoreChanged = nameOnly.some((file) => isQualityCoreFile(file));
const uiContractRequired = nameOnly.some((file) => isUiContractFile(file));
const circularRequired = nameOnly.some((file) => isAppCircularFile(file));
const manifestDiff = manifestFiles.length
  ? runGit(["diff", "--unified=0", ...diffArgs, "--", ...manifestFiles]).stdout
  : "";

const desktopFileSignals = ["apps/code-electron/package.json"];
const frontendFileSignals = [
  "apps/code/package.json",
  "packages/design-system/package.json",
  "tests/e2e/package.json",
];

const desktopManifestPattern = /@electron-forge\/|electron|desktop:|desktop:electron/i;
const frontendManifestPattern =
  /@cloudflare\/vite-plugin|@playwright\/|@vanilla-extract\/|@vitest\/|playwright|postcss|react-dom|react|rollup|terrazzo|vite|vitest/i;

const desktopManifestChanged =
  desktopFileSignals.some((file) => changedFiles.has(file)) ||
  desktopManifestPattern.test(manifestDiff);
const frontendManifestChanged =
  frontendFileSignals.some((file) => changedFiles.has(file)) ||
  frontendManifestPattern.test(manifestDiff);
const frontendOptimizationChanged =
  frontendManifestChanged || nameOnly.some((file) => isFrontendOptimizationFile(file));

writeOutput("manifest_only", manifestOnly ? "true" : "false");
writeOutput("build_skip_eligible_only", buildSkipEligibleOnly ? "true" : "false");
writeOutput("test_skip_eligible_only", testSkipEligibleOnly ? "true" : "false");
writeOutput("repo_governance_only", repoGovernanceOnly ? "true" : "false");
writeOutput("quality_core_changed", qualityCoreChanged ? "true" : "false");
writeOutput("ui_contract_required", uiContractRequired ? "true" : "false");
writeOutput("circular_required", circularRequired ? "true" : "false");
writeOutput("desktop_manifest_changed", desktopManifestChanged ? "true" : "false");
writeOutput("frontend_manifest_changed", frontendManifestChanged ? "true" : "false");
writeOutput("frontend_optimization_changed", frontendOptimizationChanged ? "true" : "false");
