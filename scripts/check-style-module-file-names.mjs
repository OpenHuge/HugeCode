#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const STYLE_ROOT = "apps/code/src/styles/";
const STYLE_EXTENSION = ".css.ts";
const FORBIDDEN_SEGMENT = ".part.css.ts";

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
      // Fall back to git-based discovery below.
    }
  }

  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

function collectTargetFiles() {
  return collectChangedFiles().filter(
    (filePath) => filePath.startsWith(STYLE_ROOT) && filePath.endsWith(STYLE_EXTENSION)
  );
}

function main() {
  const targetFiles = collectTargetFiles();
  if (targetFiles.length === 0) {
    return;
  }

  const violations = targetFiles.filter((filePath) => filePath.includes(FORBIDDEN_SEGMENT));
  if (violations.length === 0) {
    return;
  }

  for (const filePath of violations) {
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
