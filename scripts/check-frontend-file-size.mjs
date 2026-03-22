#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";

const repoRoot = process.cwd();
const MAX_FRONTEND_FILE_LINES = 1314;
const allMode = process.argv.includes("--all");
const json = process.argv.includes("--json");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";

const FRONTEND_PATH_PREFIXES = ["apps/code/src/", "packages/design-system/src/"];

const FRONTEND_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const FRONTEND_TEST_MARKERS = [".test.", ".spec.", ".stories."];
const OVERSIZED_FRONTEND_EXEMPTION_LIMITS = new Map();

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function listFromGit(args) {
  try {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosixPath);
  } catch {
    return [];
  }
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

function collectAllTrackedFiles() {
  return listFromGit(["ls-files"]);
}

function countLines(content) {
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r?\n/u).length;
}

function readCurrentLineCount(repoRelativePath) {
  const absolutePath = path.join(repoRoot, repoRelativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    return null;
  }
  const content = fs.readFileSync(absolutePath, "utf8");
  return countLines(content);
}

function readHeadLineCount(repoRelativePath) {
  try {
    const content = execFileSync("git", ["show", `HEAD:${repoRelativePath}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return countLines(content);
  } catch {
    return null;
  }
}

function isFrontendSourceFile(repoRelativePath) {
  const normalized = toPosixPath(repoRelativePath);
  if (!FRONTEND_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }

  const extension = path.posix.extname(normalized).toLowerCase();
  if (!FRONTEND_EXTENSIONS.has(extension)) {
    return false;
  }
  if (normalized.endsWith(".d.ts")) {
    return false;
  }
  if (normalized.includes("/__tests__/")) {
    return false;
  }
  if (FRONTEND_TEST_MARKERS.some((marker) => normalized.includes(marker))) {
    return false;
  }

  return true;
}

function classifyOversizedFile(filePath) {
  const currentLines = readCurrentLineCount(filePath);
  if (currentLines === null || currentLines <= MAX_FRONTEND_FILE_LINES) {
    return null;
  }

  const exemptionLimit = OVERSIZED_FRONTEND_EXEMPTION_LIMITS.get(filePath);
  if (typeof exemptionLimit === "number" && currentLines <= exemptionLimit) {
    return {
      kind: "legacy",
      filePath,
      currentLines,
      headLines: exemptionLimit,
    };
  }

  const headLines = readHeadLineCount(filePath);
  if (headLines !== null && headLines > MAX_FRONTEND_FILE_LINES && currentLines <= headLines) {
    return {
      kind: "legacy",
      filePath,
      currentLines,
      headLines,
    };
  }

  return {
    kind: "offender",
    filePath,
    currentLines,
    headLines,
  };
}

function printLegacyOversized(entries) {
  if (entries.length === 0) {
    return;
  }

  if (json) {
    return;
  }

  writeLines(process.stdout, [
    renderCheckMessage(
      "check-frontend-file-size",
      "Legacy oversized frontend files were not increased:"
    ),
    ...entries.map((entry) => {
      const previous =
        entry.headLines === null
          ? "new/untracked baseline unavailable"
          : `${entry.headLines} lines`;
      return `- ${entry.filePath}: ${entry.currentLines} lines (baseline ${previous})`;
    }),
  ]);
}

function printOffendersAndExit(offenders, legacyOversized) {
  if (offenders.length === 0) {
    return;
  }

  if (json) {
    writeCheckJson({
      check: "check-frontend-file-size",
      ok: false,
      errors: offenders.map((offender) => {
        const previous =
          offender.headLines === null
            ? "new/untracked baseline unavailable"
            : `${offender.headLines} lines`;
        return `${offender.filePath}: ${offender.currentLines} lines exceeds ${MAX_FRONTEND_FILE_LINES} (baseline ${previous})`;
      }),
      warnings: legacyOversized.map((entry) => {
        const previous =
          entry.headLines === null
            ? "new/untracked baseline unavailable"
            : `${entry.headLines} lines`;
        return `${entry.filePath}: legacy oversized file unchanged at ${entry.currentLines} lines (baseline ${previous})`;
      }),
      details: {
        maxLines: MAX_FRONTEND_FILE_LINES,
        mode: allMode ? "all" : "changed",
        offenders,
        legacyOversized,
      },
    });
    process.exit(1);
  }

  writeLines(process.stderr, [
    renderCheckMessage(
      "check-frontend-file-size",
      `Frontend source files must stay at or below ${MAX_FRONTEND_FILE_LINES} lines.`
    ),
    ...offenders.map((offender) => {
      const previous =
        offender.headLines === null
          ? "new/untracked baseline unavailable"
          : `${offender.headLines} lines`;
      return `- ${offender.filePath}: ${offender.currentLines} lines (baseline ${previous})`;
    }),
  ]);

  process.exit(1);
}

function main() {
  const candidates = allMode ? collectAllTrackedFiles() : collectChangedFiles();
  const frontendFiles = candidates.filter(isFrontendSourceFile);
  if (frontendFiles.length === 0) {
    if (json) {
      writeCheckJson({
        check: "check-frontend-file-size",
        ok: true,
        details: {
          maxLines: MAX_FRONTEND_FILE_LINES,
          mode: allMode ? "all" : "changed",
          candidateCount: candidates.length,
          checkedFiles: [],
          offenders: [],
          legacyOversized: [],
        },
      });
    }
    return;
  }

  const offenders = [];
  const legacyOversizedButNotIncreased = [];

  for (const filePath of frontendFiles) {
    const classification = classifyOversizedFile(filePath);
    if (classification === null) {
      continue;
    }
    if (classification.kind === "legacy") {
      legacyOversizedButNotIncreased.push(classification);
    } else {
      offenders.push(classification);
    }
  }

  printLegacyOversized(legacyOversizedButNotIncreased);

  if (offenders.length === 0) {
    if (json) {
      writeCheckJson({
        check: "check-frontend-file-size",
        ok: true,
        warnings: legacyOversizedButNotIncreased.map((entry) => {
          const previous =
            entry.headLines === null
              ? "new/untracked baseline unavailable"
              : `${entry.headLines} lines`;
          return `${entry.filePath}: legacy oversized file unchanged at ${entry.currentLines} lines (baseline ${previous})`;
        }),
        details: {
          maxLines: MAX_FRONTEND_FILE_LINES,
          mode: allMode ? "all" : "changed",
          checkedFiles: frontendFiles,
          offenders: [],
          legacyOversized: legacyOversizedButNotIncreased,
        },
      });
    }
    return;
  }
  printOffendersAndExit(offenders, legacyOversizedButNotIncreased);
}

main();
