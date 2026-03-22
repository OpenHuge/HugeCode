#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const allMode = process.argv.includes("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const STYLE_ROOT = "apps/code/src/styles/";
const STYLE_EXTENSION = ".css.ts";

const ALLOWLIST_EXACT = new Set([":root"]);
const ALLOWLIST_PREFIXES = [":root["];

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
    return collectAllStyleFiles();
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
      // fall through to git-based discovery
    }
  }

  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

function collectAllStyleFiles() {
  const absoluteRoot = path.join(repoRoot, STYLE_ROOT);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const files = [];
  const stack = [absoluteRoot];
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
      if (!entry.isFile() || !entry.name.endsWith(STYLE_EXTENSION)) {
        continue;
      }
      files.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function shouldRunGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-duplicate-global-selectors.mjs" ||
      (filePath.startsWith(STYLE_ROOT) && filePath.endsWith(STYLE_EXTENSION))
  );
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/gu, " ").trim();
}

function isSelectorAllowed(selector) {
  if (ALLOWLIST_EXACT.has(selector)) {
    return true;
  }
  return ALLOWLIST_PREFIXES.some((prefix) => selector.startsWith(prefix));
}
function extractGlobalStyleSelectors(content) {
  const selectors = [];
  let cursor = 0;

  while (cursor < content.length) {
    const callIndex = content.indexOf("globalStyle(", cursor);
    if (callIndex === -1) {
      break;
    }
    let index = callIndex + "globalStyle(".length;
    while (index < content.length && /\s/u.test(content[index])) {
      index += 1;
    }
    const quote = content[index];
    if (quote !== '"' && quote !== "'" && quote !== "`") {
      cursor = index;
      continue;
    }
    index += 1;
    let selector = "";
    let escaped = false;
    while (index < content.length) {
      const char = content[index];
      if (escaped) {
        selector += char;
        escaped = false;
        index += 1;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        selector += char;
        index += 1;
        continue;
      }
      if (char === quote) {
        break;
      }
      selector += char;
      index += 1;
    }
    if (index < content.length && content[index] === quote) {
      const normalized = normalizeSelector(selector);
      if (normalized.length > 0) {
        selectors.push(normalized);
      }
      cursor = index + 1;
      continue;
    }
    cursor = index + 1;
  }

  return selectors;
}

function buildDuplicateMap(fileContentsByPath) {
  const selectorToFiles = new Map();
  for (const [filePath, content] of fileContentsByPath) {
    if (typeof content !== "string") {
      continue;
    }
    const uniqueSelectors = new Set(extractGlobalStyleSelectors(content));
    for (const selector of uniqueSelectors) {
      if (isSelectorAllowed(selector)) {
        continue;
      }
      const files = selectorToFiles.get(selector) ?? new Set();
      files.add(filePath);
      selectorToFiles.set(selector, files);
    }
  }

  const duplicates = new Map();
  for (const [selector, files] of selectorToFiles) {
    if (files.size <= 1) {
      continue;
    }
    duplicates.set(
      selector,
      [...files].sort((left, right) => left.localeCompare(right))
    );
  }
  return duplicates;
}

function toDuplicateKeys(duplicateMap) {
  return new Set(
    [...duplicateMap.entries()].map(([selector, files]) => `${selector}@@${files.join("|")}`)
  );
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

  const styleFiles = collectAllStyleFiles();
  const currentFiles = new Map();
  const baselineFiles = new Map();

  for (const filePath of styleFiles) {
    const currentAbsolutePath = path.join(repoRoot, filePath);
    currentFiles.set(filePath, fs.readFileSync(currentAbsolutePath, "utf8"));
    baselineFiles.set(filePath, readHeadFile(filePath));
  }

  const currentDuplicates = buildDuplicateMap(currentFiles);
  const baselineDuplicates = buildDuplicateMap(baselineFiles);
  const currentKeys = toDuplicateKeys(currentDuplicates);
  const baselineKeys = toDuplicateKeys(baselineDuplicates);

  const addedTouchedKeys = [...currentKeys].filter((key) => {
    if (baselineKeys.has(key)) {
      return false;
    }
    const separator = key.indexOf("@@");
    const files = key.slice(separator + 2).split("|");
    return files.some((filePath) => changedFiles.includes(filePath));
  });

  if (addedTouchedKeys.length === 0) {
    return;
  }

  for (const key of addedTouchedKeys) {
    const separator = key.indexOf("@@");
    const selector = key.slice(0, separator);
    const files = key.slice(separator + 2).split("|");

    for (const filePath of files) {
    }
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.exit(1);
}
