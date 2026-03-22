#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const allMode = process.argv.includes("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const STYLE_FILE_EXTENSION = ".css.ts";
const STYLE_ROOT_PREFIX = "apps/code/src/";

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function listFromGit(gitArgs) {
  const output = execFileSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(toPosixPath);
}

function collectChangedFiles() {
  if (allMode) {
    return listFromGit(["ls-files"])
      .filter(
        (filePath) =>
          filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(STYLE_FILE_EXTENSION)
      )
      .sort((left, right) => left.localeCompare(right));
  }

  const fromValidate = process.env[SHARED_CHANGED_FILES_ENV_KEY];
  if (fromValidate) {
    try {
      const parsed = JSON.parse(fromValidate);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((value) => toPosixPath(String(value))))].sort((left, right) =>
          left.localeCompare(right)
        );
      }
    } catch {
      // fall through to git discovery
    }
  }

  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

function shouldRunGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-global-style-boundary.mjs" ||
      (filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(STYLE_FILE_EXTENSION))
  );
}

function isAllowedGlobalStyleFile(filePath) {
  if (filePath === "apps/code/src/styles/base.css.ts") {
    return true;
  }
  if (filePath === "apps/code/src/styles/rich-content-global.css.ts") {
    return true;
  }
  if (filePath.startsWith("apps/code/src/styles/tokens/")) {
    return true;
  }
  if (filePath.startsWith("apps/code/src/styles/ds-")) {
    return true;
  }
  if (filePath.startsWith("apps/code/src/features/") && filePath.endsWith(".global.css.ts")) {
    return true;
  }
  return false;
}

function countGlobalStyleCalls(content) {
  return (content.match(/\bglobalStyle\(/gu) ?? []).length;
}

function readHeadFile(filePath) {
  try {
    return execFileSync("git", ["show", `HEAD:${filePath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function main() {
  const changedFiles = collectChangedFiles();
  if (!allMode && !shouldRunGuard(changedFiles)) {
    return;
  }

  const changedStyleFiles = changedFiles.filter(
    (filePath) => filePath.startsWith(STYLE_ROOT_PREFIX) && filePath.endsWith(STYLE_FILE_EXTENSION)
  );

  const violations = [];
  for (const filePath of changedStyleFiles) {
    const absolutePath = path.join(repoRoot, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const currentContent = fs.readFileSync(absolutePath, "utf8");
    const currentCount = countGlobalStyleCalls(currentContent);
    if (currentCount === 0) {
      continue;
    }

    if (isAllowedGlobalStyleFile(filePath)) {
      continue;
    }

    const baselineContent = readHeadFile(filePath);
    const baselineCount = baselineContent ? countGlobalStyleCalls(baselineContent) : 0;
    if (currentCount <= baselineCount) {
      continue;
    }

    violations.push({
      filePath,
      baselineCount,
      currentCount,
    });
  }

  if (violations.length === 0) {
    process.stdout.write("Global style boundary guard: no violations detected.\n");
    return;
  }

  for (const violation of violations) {
    process.stderr.write(
      `${violation.filePath}: globalStyle count increased from ${violation.baselineCount} to ${violation.currentCount}. Keep new global selectors inside approved global/style island files.\n`
    );
  }

  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Global style boundary guard failed: ${message}\n`);
  process.exit(1);
}
