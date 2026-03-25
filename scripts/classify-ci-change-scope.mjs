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

function writeOutput(name, value) {
  const rendered = `${name}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, rendered);
    return;
  }

  process.stdout.write(rendered);
}

function isBuildSkipEligibleFile(file) {
  return (
    file.endsWith(".md") ||
    file.endsWith(".mdx") ||
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

function isRepoGovernanceOnlyFile(file) {
  return (
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
const repoGovernanceOnly =
  nameOnly.length > 0 && nameOnly.every((file) => isRepoGovernanceOnlyFile(file));
const manifestDiff = manifestFiles.length
  ? runGit(["diff", "--unified=0", ...diffArgs, "--", ...manifestFiles]).stdout
  : "";

const desktopFileSignals = [
  "apps/code-tauri/package.json",
  "apps/code-tauri/src-tauri/Cargo.toml",
  "apps/code-tauri/src-tauri/Cargo.lock",
];
const frontendFileSignals = [
  "apps/code/package.json",
  "apps/code-web/package.json",
  "packages/design-system/package.json",
  "tests/e2e/package.json",
];

const desktopManifestPattern =
  /@tauri-apps\/|tauri-plugin|code-tauri|desktop:|desktop-verify|src-tauri/i;
const frontendManifestPattern =
  /@cloudflare\/vite-plugin|@playwright\/|@vanilla-extract\/|@vitest\/|playwright|postcss|react-dom|react|rollup|terrazzo|vite|vitest/i;

const desktopManifestChanged =
  desktopFileSignals.some((file) => changedFiles.has(file)) ||
  desktopManifestPattern.test(manifestDiff);
const frontendManifestChanged =
  frontendFileSignals.some((file) => changedFiles.has(file)) ||
  frontendManifestPattern.test(manifestDiff);

writeOutput("manifest_only", manifestOnly ? "true" : "false");
writeOutput("build_skip_eligible_only", buildSkipEligibleOnly ? "true" : "false");
writeOutput("repo_governance_only", repoGovernanceOnly ? "true" : "false");
writeOutput("desktop_manifest_changed", desktopManifestChanged ? "true" : "false");
writeOutput("frontend_manifest_changed", frontendManifestChanged ? "true" : "false");
