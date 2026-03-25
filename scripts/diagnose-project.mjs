#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { evaluateBranchPolicy } from "./lib/branch-policy.mjs";
import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";
import { resolveGitComparisonBase } from "./lib/git-base-ref.mjs";

import {
  collectPackagesWorkspaceHygiene,
  summarizePackagesWorkspaceHygiene,
} from "./lib/packages-workspace-hygiene.mjs";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const fetchRemote = args.has("--fetch");
const json = args.has("--json");
const repoRoot = process.cwd();

/** @type {Array<{status: "PASS" | "WARN" | "FAIL"; name: string; detail: string}>} */
const checks = [];

const EPHEMERAL_PATHS = [
  ".playwright-cli",
  ".playwright-mcp",
  "test-results",
  "playwright-report",
  "blob-report",
];

const REQUIRED_SCRIPT_NAMES = [
  "repo:doctor",
  "preflight:codex",
  "check:branch-policy",
  "collab:status",
  "collab:sync",
  "collab:sync:fast",
  "collab:sync:full",
  "validate",
  "validate:fast",
  "test:e2e:collab",
];

const CODE_RUNTIME_LOCAL_EXEC_ENV = "CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC";
const CODE_RUNTIME_LOCAL_EXEC_PATH_ENV = "CODE_RUNTIME_LOCAL_CODEX_EXEC_PATH";
const CODE_RUNTIME_LOCAL_CODEX_PATH_ENVS = [
  "CODE_RUNTIME_LOCAL_CODEX_HOME",
  "CODE_RUNTIME_LOCAL_CODEX_AUTH_PATH",
  "CODE_RUNTIME_LOCAL_CODEX_SESSIONS_PATH",
];

const REQUIRED_CHAIN_FILES = [
  "packages/code-runtime-service-rs/src/turn_runtime_plan.rs",
  "packages/code-runtime-service-rs/src/local_codex_exec_turn.rs",
  "packages/code-runtime-service-rs/src/live_skills.rs",
  "packages/code-runtime-service-rs/src/provider_requests.rs",
  "scripts/validate.mjs",
  "scripts/check-rust-file-size.mjs",
];

const CODE_EXTENSIONS = new Set([".rs", ".ts", ".tsx", ".js", ".mjs"]);

function pushCheck(status, name, detail) {
  checks.push({ status, name, detail });
}

function runCommand(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function runGit(gitArgs, allowFailure = false) {
  try {
    const result = runCommand("git", gitArgs);
    if (result.status !== 0) {
      throw Object.assign(new Error(`git ${gitArgs.join(" ")} failed unexpectedly`), result);
    }
    return (result.stdout ?? "").trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    const message =
      error instanceof Error ? error.message : `git ${gitArgs.join(" ")} failed unexpectedly`;
    throw new Error(message);
  }
}

function resolveUpstreamRef() {
  return runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], true);
}

function checkPnpmStoreHealth() {
  try {
    const result = runCommand("pnpm", ["store", "status"]);
    if (result.status !== 0) {
      throw Object.assign(new Error("pnpm store status failed unexpectedly."), result);
    }
    pushCheck("PASS", "pnpm store", "pnpm store status reports a clean package store.");
  } catch (error) {
    const stdout =
      error && typeof error === "object" && "stdout" in error && typeof error.stdout === "string"
        ? error.stdout
        : "";
    const stderr =
      error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr
        : "";
    const combinedOutput = `${stdout}\n${stderr}`.trim();

    if (
      combinedOutput.includes("ERR_PNPM_MODIFIED_DEPENDENCY") ||
      combinedOutput.includes("Packages in the store have been mutated")
    ) {
      pushCheck(
        strict ? "FAIL" : "WARN",
        "pnpm store",
        "pnpm store contains mutated packages. Run `pnpm install --force` to refetch damaged entries. If this keeps happening across repos, clean the global pnpm store. Use `repo:doctor:strict` when you want this condition to fail the run."
      );
      return;
    }

    const message =
      error instanceof Error ? error.message : "pnpm store status failed unexpectedly.";
    pushCheck(
      "WARN",
      "pnpm store",
      `Unable to verify pnpm store health automatically (${message}).`
    );
  }
}

function isEnabledEnvFlag(rawValue) {
  if (typeof rawValue !== "string") {
    return false;
  }
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function readNonEmptyEnvValue(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canExecuteCodexCli(commandPath) {
  const command = commandPath && commandPath.length > 0 ? commandPath : "codex";
  try {
    return runCommand(command, ["--version"]).status === 0;
  } catch {
    return false;
  }
}

function fileLineCount(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r?\n/u).length;
}

function isDirectoryNonEmpty(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return false;
  }
  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    return true;
  }
  return fs.readdirSync(absolutePath).length > 0;
}

function checkGitSync() {
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], true);
  if (!branch || branch === "HEAD") {
    pushCheck(
      "WARN",
      "Git branch",
      "Current state is detached HEAD or branch is unavailable; sync checks are limited."
    );
    return;
  }

  const branchPolicy = evaluateBranchPolicy(branch);
  if (branchPolicy.status === "pass") {
    pushCheck("PASS", "Branch policy", branchPolicy.detail);
  } else if (branchPolicy.status === "warn") {
    pushCheck("WARN", "Branch policy", branchPolicy.detail);
  } else {
    pushCheck("FAIL", "Branch policy", branchPolicy.detail);
  }

  if (fetchRemote) {
    const fetchResult = runGit(["fetch", "origin", "--prune"], true);
    if (fetchResult === "") {
      pushCheck("PASS", "Remote fetch", "Fetched latest refs from origin.");
    } else {
      pushCheck("PASS", "Remote fetch", "Fetched latest refs from origin.");
    }
  }

  const syncRef = resolveUpstreamRef() || `origin/${branch}`;
  const syncRefSha = runGit(["rev-parse", "--verify", syncRef], true);
  if (!syncRefSha) {
    pushCheck(
      "WARN",
      "Remote tracking",
      `No tracking ref found for ${syncRef}; cannot compute ahead/behind.`
    );
    return;
  }

  const aheadBehind = runGit(
    ["rev-list", "--left-right", "--count", `${branch}...${syncRef}`],
    true
  );
  const [aheadRaw, behindRaw] = aheadBehind.split(/\s+/u);
  const ahead = Number(aheadRaw || 0);
  const behind = Number(behindRaw || 0);

  if (behind > 0) {
    pushCheck(
      "FAIL",
      "Branch sync",
      `${branch} is behind ${syncRef} by ${behind} commit(s). Run \`git pull --rebase origin ${branch}\`.`
    );
  } else {
    pushCheck("PASS", "Branch sync", `${branch} is not behind ${syncRef}.`);
  }

  if (ahead > 0) {
    pushCheck(
      "WARN",
      "Push pending",
      `${branch} is ahead of ${syncRef} by ${ahead} commit(s). Consider pushing validated changes.`
    );
  } else {
    pushCheck("PASS", "Push pending", `${branch} has no unpushed commits relative to ${syncRef}.`);
  }
}

function checkWorkingTree() {
  const porcelain = runGit(["status", "--porcelain"], true);
  if (!porcelain) {
    pushCheck("PASS", "Working tree", "Working tree is clean.");
    return;
  }

  const lines = porcelain.split("\n").filter(Boolean);
  const untracked = lines.filter((line) => line.startsWith("??")).length;
  const tracked = lines.length - untracked;
  pushCheck(
    "WARN",
    "Working tree",
    `Detected ${tracked} tracked change(s) and ${untracked} untracked path(s).`
  );
}

function checkComparisonBase() {
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], true);
  if (!branch || branch === "HEAD") {
    pushCheck(
      "WARN",
      "Comparison base",
      "Current state is detached HEAD or branch is unavailable; comparison-base diagnostics are limited."
    );
    return;
  }

  const { ref, kind } = resolveGitComparisonBase({ repoRoot });
  if (!ref) {
    pushCheck(
      "WARN",
      "Comparison base",
      "No comparison base resolved automatically. Targeted validation will rely on local changes only unless you configure an upstream or pass an explicit base ref."
    );
    return;
  }

  pushCheck(
    "PASS",
    "Comparison base",
    `Affected/validation base resolves to ${ref} (${kind}). Use \`TURBO_BASE_REF\` when you need to override the inferred base.`
  );
}

function checkEphemeralArtifacts() {
  const found = EPHEMERAL_PATHS.filter((entry) => isDirectoryNonEmpty(entry));
  if (found.length === 0) {
    pushCheck(
      "PASS",
      "Ephemeral artifacts",
      "No local Playwright/test artifact directories detected."
    );
    return;
  }
  pushCheck(
    "WARN",
    "Ephemeral artifacts",
    `Found local artifact directories: ${found.join(", ")}. Consider cleaning before validation.`
  );
}

function checkWorkflowEntrypoints() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    pushCheck("FAIL", "Workflow scripts", "package.json is missing at repository root.");
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const scripts = packageJson.scripts ?? {};
  const missing = REQUIRED_SCRIPT_NAMES.filter((name) => typeof scripts[name] !== "string");
  if (missing.length > 0) {
    pushCheck("FAIL", "Workflow scripts", `Missing required script(s): ${missing.join(", ")}.`);
    return;
  }
  pushCheck(
    "PASS",
    "Workflow scripts",
    "Required canonical doctor/preflight/validate/e2e entrypoints are present."
  );
}

function checkPackagesWorkspaceHygiene() {
  const report = collectPackagesWorkspaceHygiene(repoRoot);
  const summary = summarizePackagesWorkspaceHygiene(report);
  pushCheck(summary.status, "Packages workspace hygiene", summary.detail);
}

function checkRuntimeChainFiles() {
  const missing = REQUIRED_CHAIN_FILES.filter(
    (relativePath) => !fs.existsSync(path.join(repoRoot, relativePath))
  );
  if (missing.length > 0) {
    pushCheck("FAIL", "Runtime chain files", `Missing required file(s): ${missing.join(", ")}.`);
    return;
  }
  pushCheck("PASS", "Runtime chain files", "Core runtime chain files are present.");
}

function checkLargeFileHotspots() {
  const trackedFilesRaw = runGit(["ls-files"], true);
  if (!trackedFilesRaw) {
    pushCheck(
      "WARN",
      "Large file hotspots",
      "Unable to enumerate tracked files for hotspot analysis."
    );
    return;
  }

  const candidates = trackedFilesRaw
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => CODE_EXTENSIONS.has(path.extname(entry)));

  const sized = [];
  for (const filePath of candidates) {
    try {
      sized.push({ filePath, lines: fileLineCount(filePath) });
    } catch {
      // Skip unreadable files and continue diagnostics.
    }
  }

  sized.sort((left, right) => right.lines - left.lines);
  const top = sized.slice(0, 5);
  if (top.length === 0) {
    pushCheck("WARN", "Large file hotspots", "No code files found for hotspot analysis.");
    return;
  }

  const severe = top.filter((entry) => entry.lines >= 5000);
  const detail = top.map((entry) => `${entry.filePath} (${entry.lines})`).join(", ");
  if (severe.length > 0) {
    const changedFiles = new Set(
      runGit(["diff", "--name-only", "--relative", "HEAD"], true)
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
    const touchedHotspots = severe.filter((entry) => changedFiles.has(entry.filePath));
    if (touchedHotspots.length === 0) {
      pushCheck(
        "PASS",
        "Large file hotspots",
        `Top files: ${detail}. Current change set does not touch the >=5000-line hotspots.`
      );
      return;
    }

    pushCheck(
      "WARN",
      "Large file hotspots",
      `Top files: ${detail}. Current change set touches hotspot file(s): ${touchedHotspots
        .map((entry) => entry.filePath)
        .join(", ")}. Files >=5000 lines should be split incrementally.`
    );
    return;
  }

  pushCheck("PASS", "Large file hotspots", `Top files: ${detail}.`);
}

function checkLocalCodexExecutable(localExecEnabled) {
  if (!localExecEnabled) {
    return;
  }

  pushCheck(
    "WARN",
    "Codex execution env override",
    `Current shell overrides runtime to local codex exec (${CODE_RUNTIME_LOCAL_EXEC_ENV}=1).`
  );

  const configuredExecPath = readNonEmptyEnvValue(CODE_RUNTIME_LOCAL_EXEC_PATH_ENV);
  const resolvedExecCommand = configuredExecPath ?? "codex";
  const execIsAvailable = canExecuteCodexCli(resolvedExecCommand);
  if (execIsAvailable) {
    pushCheck(
      "PASS",
      "Local codex executable",
      configuredExecPath
        ? `${CODE_RUNTIME_LOCAL_EXEC_PATH_ENV} is runnable (${configuredExecPath}).`
        : "codex CLI is runnable from PATH."
    );
    return;
  }

  pushCheck(
    "FAIL",
    "Local codex executable",
    configuredExecPath
      ? `${CODE_RUNTIME_LOCAL_EXEC_PATH_ENV} is set but not runnable (${configuredExecPath}).`
      : `Local codex exec is enabled but \`codex\` is not runnable on PATH. Set ${CODE_RUNTIME_LOCAL_EXEC_PATH_ENV} or disable ${CODE_RUNTIME_LOCAL_EXEC_ENV}.`
  );
}

function collectConfiguredLocalCodexPathOverrides() {
  return CODE_RUNTIME_LOCAL_CODEX_PATH_ENVS.map((name) => ({
    name,
    value: readNonEmptyEnvValue(name),
  })).filter((entry) => entry.value !== null);
}

function checkLocalCodexPathOverrides() {
  const configuredPathOverrides = collectConfiguredLocalCodexPathOverrides();
  if (configuredPathOverrides.length === 0) {
    pushCheck(
      "PASS",
      "Local codex path overrides",
      "No local codex path override environment variables are set."
    );
    return;
  }

  for (const entry of configuredPathOverrides) {
    const raw = entry.value ?? "";
    const resolvedPath = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
    if (fs.existsSync(resolvedPath)) {
      pushCheck("PASS", "Local codex path override", `${entry.name} -> ${resolvedPath}`);
    } else {
      pushCheck(
        "WARN",
        "Local codex path override",
        `${entry.name} is set but path does not exist: ${resolvedPath}`
      );
    }
  }
}

function checkCodexExecutionDefault() {
  const scriptPath = path.join(repoRoot, "scripts/dev-code-runtime-gateway-web-all.mjs");
  if (!fs.existsSync(scriptPath)) {
    pushCheck("WARN", "Codex execution mode", "Dev gateway bootstrap script is missing.");
    return;
  }

  const scriptText = fs.readFileSync(scriptPath, "utf8");
  const defaultUsesRemoteService = scriptText.includes(
    'CODE_RUNTIME_SERVICE_TURNS_USE_LOCAL_CODEX_EXEC ?? "0"'
  );

  if (defaultUsesRemoteService) {
    pushCheck(
      "PASS",
      "Codex execution mode",
      "Default dev runtime mode is remote provider path (local codex exec disabled by default)."
    );
  } else {
    pushCheck(
      "WARN",
      "Codex execution mode",
      "Dev runtime appears to default to local codex exec. Consider setting default to provider path."
    );
  }

  const localExecEnabled = isEnabledEnvFlag(process.env[CODE_RUNTIME_LOCAL_EXEC_ENV]);
  checkLocalCodexExecutable(localExecEnabled);
  checkLocalCodexPathOverrides();
}

function printReport() {
  const passCount = checks.filter((entry) => entry.status === "PASS").length;
  const warnCount = checks.filter((entry) => entry.status === "WARN").length;
  const failCount = checks.filter((entry) => entry.status === "FAIL").length;

  if (json) {
    writeCheckJson({
      check: "diagnose-project",
      ok: failCount === 0 && (!strict || warnCount === 0),
      errors: checks
        .filter((entry) => entry.status === "FAIL")
        .map((entry) => `${entry.name}: ${entry.detail}`),
      warnings: checks
        .filter((entry) => entry.status === "WARN")
        .map((entry) => `${entry.name}: ${entry.detail}`),
      details: {
        summary: {
          passCount,
          warnCount,
          failCount,
        },
        checks,
      },
    });
  } else {
    writeLines(
      process.stdout,
      checks.map((check) => renderCheckMessage(check.status, `${check.name}: ${check.detail}`))
    );
    writeLines(process.stdout, [
      renderCheckMessage(
        failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS",
        `Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail.`
      ),
    ]);
  }

  if (failCount > 0) {
    process.exitCode = 1;
    return;
  }
  if (strict && warnCount > 0) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

function main() {
  checkGitSync();
  checkComparisonBase();
  checkWorkingTree();
  checkEphemeralArtifacts();
  checkPnpmStoreHealth();
  checkWorkflowEntrypoints();
  checkPackagesWorkspaceHygiene();
  checkRuntimeChainFiles();
  checkLargeFileHotspots();
  checkCodexExecutionDefault();
  printReport();
}

main();
