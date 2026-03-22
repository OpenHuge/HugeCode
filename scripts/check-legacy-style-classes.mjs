#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const TARGET_ROOT = "apps/code/src/";
const TARGET_EXTENSION = ".tsx";

const LEGACY_TOKEN_PATTERN = String.raw`(?<![-\w])(primary|secondary|ghost|icon-button)(?![-\w])`;

const PATTERNS = [
  {
    label: "className-string",
    regex: new RegExp(String.raw`className\s*=\s*"[^"\n]*${LEGACY_TOKEN_PATTERN}[^"\n]*"`, "gu"),
  },
  {
    label: "className-template",
    regex: new RegExp(
      `className\\s*=\\s*\\{\`[^\`\\n]*${LEGACY_TOKEN_PATTERN}[^\`\\n]*\`\\}`,
      "gu"
    ),
  },
  {
    label: "iconButton-string",
    regex: new RegExp(String.raw`iconButton\s*:\s*"[^"\n]*${LEGACY_TOKEN_PATTERN}[^"\n]*"`, "gu"),
  },
];

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
    (filePath) => filePath.startsWith(TARGET_ROOT) && filePath.endsWith(TARGET_EXTENSION)
  );
}

function findViolations(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const violations = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (!pattern.regex.test(line)) {
        continue;
      }
      violations.push({
        filePath,
        lineNumber: lineIndex + 1,
        kind: pattern.label,
        snippet: line.trim(),
      });
    }
  }

  return violations;
}

function main() {
  const targetFiles = collectTargetFiles();
  if (targetFiles.length === 0) {
    return;
  }

  const violations = targetFiles.flatMap((filePath) => findViolations(filePath));
  if (violations.length === 0) {
    return;
  }

  for (const violation of violations) {
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
