#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";

const repoRoot = process.cwd();
const MAX_RUST_FILE_LINES = 1200;
const allMode = process.argv.includes("--all");
const json = process.argv.includes("--json");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";

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
        return [...new Set(parsed.map((value) => toPosixPath(String(value))))].sort((a, b) =>
          a.localeCompare(b)
        );
      }
    } catch {
      // Fall back to git-based discovery below.
    }
  }

  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((a, b) => a.localeCompare(b));
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

function main() {
  const candidates = allMode ? collectAllTrackedFiles() : collectChangedFiles();
  const rustFiles = candidates.filter((filePath) => filePath.endsWith(".rs"));
  if (rustFiles.length === 0) {
    if (json) {
      writeCheckJson({
        check: "check-rust-file-size",
        ok: true,
        details: {
          maxLines: MAX_RUST_FILE_LINES,
          mode: allMode ? "all" : "changed",
          offenders: [],
          legacyOversized: [],
        },
      });
    }
    return;
  }

  const offenders = [];
  const legacyOversizedButNotIncreased = [];

  for (const filePath of rustFiles) {
    const currentLines = readCurrentLineCount(filePath);
    if (currentLines === null) {
      continue;
    }
    if (currentLines <= MAX_RUST_FILE_LINES) {
      continue;
    }

    const headLines = readHeadLineCount(filePath);
    if (headLines !== null && headLines > MAX_RUST_FILE_LINES && currentLines <= headLines) {
      legacyOversizedButNotIncreased.push({
        filePath,
        currentLines,
        headLines,
      });
      continue;
    }

    offenders.push({
      filePath,
      currentLines,
      headLines,
    });
  }

  if (legacyOversizedButNotIncreased.length > 0) {
    if (json && offenders.length === 0) {
      writeCheckJson({
        check: "check-rust-file-size",
        ok: true,
        warnings: legacyOversizedButNotIncreased.map((entry) => {
          const previous =
            entry.headLines === null
              ? "new/untracked baseline unavailable"
              : `${entry.headLines} lines`;
          return `${entry.filePath}: legacy oversized Rust file unchanged at ${entry.currentLines} lines (baseline ${previous})`;
        }),
        details: {
          maxLines: MAX_RUST_FILE_LINES,
          mode: allMode ? "all" : "changed",
          offenders: [],
          legacyOversized: legacyOversizedButNotIncreased,
        },
      });
    } else if (!json) {
      writeLines(process.stdout, [
        renderCheckMessage(
          "check-rust-file-size",
          "Legacy oversized Rust files were not increased:"
        ),
        ...legacyOversizedButNotIncreased.map((entry) => {
          const previous =
            entry.headLines === null
              ? "new/untracked baseline unavailable"
              : `${entry.headLines} lines`;
          return `- ${entry.filePath}: ${entry.currentLines} lines (baseline ${previous})`;
        }),
      ]);
    }
  }

  if (offenders.length === 0) {
    if (json && legacyOversizedButNotIncreased.length === 0) {
      writeCheckJson({
        check: "check-rust-file-size",
        ok: true,
        details: {
          maxLines: MAX_RUST_FILE_LINES,
          mode: allMode ? "all" : "changed",
          offenders: [],
          legacyOversized: [],
        },
      });
    }
    return;
  }

  if (json) {
    writeCheckJson({
      check: "check-rust-file-size",
      ok: false,
      errors: offenders.map((offender) => {
        const previous =
          offender.headLines === null
            ? "new/untracked baseline unavailable"
            : `${offender.headLines} lines`;
        return `${offender.filePath}: ${offender.currentLines} lines exceeds ${MAX_RUST_FILE_LINES} (baseline ${previous})`;
      }),
      warnings: legacyOversizedButNotIncreased.map((entry) => {
        const previous =
          entry.headLines === null
            ? "new/untracked baseline unavailable"
            : `${entry.headLines} lines`;
        return `${entry.filePath}: legacy oversized Rust file unchanged at ${entry.currentLines} lines (baseline ${previous})`;
      }),
      details: {
        maxLines: MAX_RUST_FILE_LINES,
        mode: allMode ? "all" : "changed",
        offenders,
        legacyOversized: legacyOversizedButNotIncreased,
      },
    });
    process.exit(1);
  }

  writeLines(process.stderr, [
    renderCheckMessage(
      "check-rust-file-size",
      `Rust source files must stay at or below ${MAX_RUST_FILE_LINES} lines.`
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

main();
