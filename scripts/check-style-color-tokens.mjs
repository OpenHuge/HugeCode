#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const scanAll = args.has("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";

const STYLE_ROOT = "apps/code/src/styles/";
const ALLOWLIST = [];
const ALLOWLIST_HARDCODED_LIMITS = new Map();

const COLOR_PATTERNS = [
  { label: "hex", regex: /#[0-9a-fA-F]{3,8}\b/gu },
  { label: "rgb", regex: /\brgba?\s*\(/gu },
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

function collectAllStyleFiles() {
  const files = [];
  const rootAbsolutePath = path.join(repoRoot, STYLE_ROOT);
  if (!fs.existsSync(rootAbsolutePath)) {
    return files;
  }

  const stack = [rootAbsolutePath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".css.ts")) {
        continue;
      }
      files.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function isAllowlisted(filePath) {
  return ALLOWLIST.some((pattern) => pattern.test(filePath));
}

function stripBlockCommentsPreserveLineCount(content) {
  return content.replace(/\/\*[\s\S]*?\*\//gu, (match) => {
    const newlineCount = (match.match(/\n/gu) ?? []).length;
    return "\n".repeat(newlineCount);
  });
}

function scanFile(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) {
    return { content: "", violations: [] };
  }

  const rawContent = fs.readFileSync(absolutePath, "utf8");
  const content = stripBlockCommentsPreserveLineCount(rawContent);
  const lines = content.split(/\r?\n/u);
  const violations = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const pattern of COLOR_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (!pattern.regex.test(line)) {
        continue;
      }
      violations.push({
        filePath,
        lineNumber: lineIndex + 1,
        pattern: pattern.label,
        snippet: line.trim(),
      });
    }
  }

  return { content, violations };
}

function countPatternMatches(content, regex) {
  const normalizedFlags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const counter = new RegExp(regex.source, normalizedFlags);
  let count = 0;
  while (counter.exec(content) !== null) {
    count += 1;
  }
  return count;
}

function countHardcodedTokens(content) {
  let total = 0;
  for (const pattern of COLOR_PATTERNS) {
    total += countPatternMatches(content, pattern.regex);
  }
  return total;
}

function collectTargetStyleFiles() {
  return (scanAll ? collectAllStyleFiles() : collectChangedFiles()).filter(
    (filePath) => filePath.startsWith(STYLE_ROOT) && filePath.endsWith(".css.ts")
  );
}

function collectGuardedViolations(filePaths) {
  const violations = [];
  for (const filePath of filePaths) {
    const result = scanFile(filePath);
    violations.push(...result.violations);
  }
  return violations;
}

function collectAllowlistBaselineViolations(filePaths) {
  const baselineViolations = [];
  for (const filePath of filePaths) {
    const result = scanFile(filePath);
    const baselineLimit = ALLOWLIST_HARDCODED_LIMITS.get(filePath);
    if (baselineLimit === undefined) {
      baselineViolations.push({
        filePath,
        reason: "missing-baseline",
      });
      continue;
    }
    const detectedCount = countHardcodedTokens(result.content);
    if (detectedCount > baselineLimit) {
      baselineViolations.push({
        filePath,
        reason: "over-limit",
        baselineLimit,
        detectedCount,
      });
    }
  }
  return baselineViolations;
}

function printGuardedViolations(violations) {
  if (violations.length === 0) {
    return;
  }

  for (const violation of violations) {
  }
}

function printBaselineViolations(baselineViolations) {
  if (baselineViolations.length === 0) {
    return;
  }

  for (const violation of baselineViolations) {
    if (violation.reason === "missing-baseline") {
      continue;
    }
  }
}

function main() {
  const styleFiles = collectTargetStyleFiles();

  if (styleFiles.length === 0) {
    return;
  }

  const guardedFiles = styleFiles.filter((filePath) => !isAllowlisted(filePath));
  const allowlistedFiles = styleFiles.filter((filePath) => isAllowlisted(filePath));
  const violations = collectGuardedViolations(guardedFiles);
  const baselineViolations = collectAllowlistBaselineViolations(allowlistedFiles);

  if (violations.length > 0 || baselineViolations.length > 0) {
    printGuardedViolations(violations);
    printBaselineViolations(baselineViolations);

    process.exit(1);
  }

  if (guardedFiles.length === 0 && allowlistedFiles.length > 0) {
    return;
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
