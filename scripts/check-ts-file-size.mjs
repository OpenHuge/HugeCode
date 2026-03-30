#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";

const repoRoot = process.cwd();
const allMode = process.argv.includes("--all");
const json = process.argv.includes("--json");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const TEST_MARKERS = [".test.", ".spec.", ".stories."];

const SOURCE_MAX_LINES = 1300;
const SCRIPT_MAX_LINES = 1600;
const VALIDATE_SCRIPT_MAX_LINES = 3000;
const RUNTIME_REPLAY_DATASET_MAX_LINES = 5000;

const PROFILE_DEFINITIONS = [
  {
    name: "runtime-replay-dataset",
    maxLines: RUNTIME_REPLAY_DATASET_MAX_LINES,
    matches: (filePath) => filePath === "scripts/lib/runtimeReplayDataset.mjs",
  },
  {
    name: "validate-orchestration",
    maxLines: VALIDATE_SCRIPT_MAX_LINES,
    matches: (filePath) => filePath === "scripts/validate.mjs",
  },
  {
    name: "repo-scripts",
    maxLines: SCRIPT_MAX_LINES,
    matches: (filePath) => filePath.startsWith("scripts/"),
  },
  {
    name: "workspace-source",
    maxLines: SOURCE_MAX_LINES,
    matches: (filePath) => /^(apps|packages)\/[^/]+\/src\//u.test(filePath),
  },
];

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

function isGuardCandidate(repoRelativePath) {
  const normalized = toPosixPath(repoRelativePath);
  const extension = path.posix.extname(normalized).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(extension)) {
    return false;
  }
  if (normalized.endsWith(".d.ts")) {
    return false;
  }
  if (normalized.includes("/__tests__/")) {
    return false;
  }
  if (TEST_MARKERS.some((marker) => normalized.includes(marker))) {
    return false;
  }
  return PROFILE_DEFINITIONS.some((profile) => profile.matches(normalized));
}

function resolveProfile(filePath) {
  return PROFILE_DEFINITIONS.find((profile) => profile.matches(filePath)) ?? null;
}

function classifyOversizedFile(filePath) {
  const profile = resolveProfile(filePath);
  if (!profile) {
    return null;
  }

  const currentLines = readCurrentLineCount(filePath);
  if (currentLines === null || currentLines <= profile.maxLines) {
    return null;
  }

  const headLines = readHeadLineCount(filePath);
  if (headLines !== null && headLines > profile.maxLines && currentLines <= headLines) {
    return {
      kind: "legacy",
      filePath,
      currentLines,
      headLines,
      profileName: profile.name,
      maxLines: profile.maxLines,
    };
  }

  return {
    kind: "offender",
    filePath,
    currentLines,
    headLines,
    profileName: profile.name,
    maxLines: profile.maxLines,
  };
}

function formatEntry(entry) {
  const previous =
    entry.headLines === null ? "new/untracked baseline unavailable" : `${entry.headLines} lines`;
  return `${entry.filePath}: ${entry.currentLines} lines exceeds ${entry.maxLines} for profile \`${entry.profileName}\` (baseline ${previous})`;
}

function formatLegacyEntry(entry) {
  const previous =
    entry.headLines === null ? "new/untracked baseline unavailable" : `${entry.headLines} lines`;
  return `${entry.filePath}: legacy oversized file unchanged at ${entry.currentLines} lines for profile \`${entry.profileName}\` (baseline ${previous})`;
}

function printLegacyOversized(entries) {
  if (entries.length === 0 || json) {
    return;
  }

  writeLines(process.stdout, [
    renderCheckMessage("check-ts-file-size", "Legacy oversized TS/JS files were not increased:"),
    ...entries.map((entry) => `- ${formatLegacyEntry(entry)}`),
  ]);
}

function printOffendersAndExit(offenders, legacyOversized) {
  if (offenders.length === 0) {
    return;
  }

  if (json) {
    writeCheckJson({
      check: "check-ts-file-size",
      ok: false,
      errors: offenders.map(formatEntry),
      warnings: legacyOversized.map(formatLegacyEntry),
      details: {
        mode: allMode ? "all" : "changed",
        offenders,
        legacyOversized,
        profiles: PROFILE_DEFINITIONS.map(({ name, maxLines }) => ({ name, maxLines })),
      },
    });
    process.exit(1);
  }

  writeLines(process.stderr, [
    renderCheckMessage(
      "check-ts-file-size",
      "TS/JS source files must stay within their configured size profile."
    ),
    ...offenders.map((entry) => `- ${formatEntry(entry)}`),
  ]);

  process.exit(1);
}

function main() {
  const candidates = allMode ? collectAllTrackedFiles() : collectChangedFiles();
  const sourceFiles = candidates.filter(isGuardCandidate);
  if (sourceFiles.length === 0) {
    if (json) {
      writeCheckJson({
        check: "check-ts-file-size",
        ok: true,
        details: {
          mode: allMode ? "all" : "changed",
          candidateCount: candidates.length,
          checkedFiles: [],
          offenders: [],
          legacyOversized: [],
          profiles: PROFILE_DEFINITIONS.map(({ name, maxLines }) => ({ name, maxLines })),
        },
      });
    }
    return;
  }

  const offenders = [];
  const legacyOversizedButNotIncreased = [];

  for (const filePath of sourceFiles) {
    const classification = classifyOversizedFile(filePath);
    if (classification === null) {
      continue;
    }
    if (classification.kind === "legacy") {
      legacyOversizedButNotIncreased.push(classification);
      continue;
    }
    offenders.push(classification);
  }

  printLegacyOversized(legacyOversizedButNotIncreased);
  if (offenders.length === 0) {
    if (json) {
      writeCheckJson({
        check: "check-ts-file-size",
        ok: true,
        warnings: legacyOversizedButNotIncreased.map(formatLegacyEntry),
        details: {
          mode: allMode ? "all" : "changed",
          checkedFiles: sourceFiles,
          offenders: [],
          legacyOversized: legacyOversizedButNotIncreased,
          profiles: PROFILE_DEFINITIONS.map(({ name, maxLines }) => ({ name, maxLines })),
        },
      });
    }
    return;
  }

  printOffendersAndExit(offenders, legacyOversizedButNotIncreased);
}

main();
