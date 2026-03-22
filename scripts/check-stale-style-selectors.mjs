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
const SOURCE_ROOT = "apps/code/src/";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const CLASS_NAME_REGEX = /\.([_a-zA-Z]+[_a-zA-Z0-9-]*)/gu;

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
      .filter((filePath) => filePath.startsWith(STYLE_ROOT) && filePath.endsWith(STYLE_EXTENSION))
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
      // fall through
    }
  }
  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

function shouldRunGuard(changedFiles) {
  return changedFiles.some(
    (filePath) =>
      filePath === "scripts/check-stale-style-selectors.mjs" ||
      (filePath.startsWith(STYLE_ROOT) && filePath.endsWith(STYLE_EXTENSION))
  );
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
      cursor = index + 1;
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
      selectors.push(selector);
    }
    cursor = index + 1;
  }
  return selectors;
}

function extractClassNamesFromSelectors(selectors) {
  const classNames = new Set();
  for (const selector of selectors) {
    CLASS_NAME_REGEX.lastIndex = 0;
    let match = CLASS_NAME_REGEX.exec(selector);
    while (match) {
      const className = match[1];
      if (className) {
        classNames.add(className);
      }
      match = CLASS_NAME_REGEX.exec(selector);
    }
  }
  return classNames;
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

function collectSourceFiles() {
  const absoluteRoot = path.join(repoRoot, SOURCE_ROOT);
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
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = toPosixPath(path.relative(repoRoot, absolutePath));
      if (relativePath.startsWith(STYLE_ROOT) && relativePath.endsWith(STYLE_EXTENSION)) {
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(relativePath))) {
        continue;
      }
      files.push(relativePath);
    }
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isClassReferenced(className, sourceContents) {
  const escaped = escapeRegExp(className);
  const backtick = "`";
  const templateLiteralClassPattern = `className\\s*=\\s*\\{${backtick}[^${backtick}\\n]*\\b${escaped}\\b[^${backtick}\\n]*${backtick}\\}`;
  const patterns = [
    new RegExp(`className\\s*=\\s*"[^"\\n]*\\b${escaped}\\b[^"\\n]*"`, "u"),
    new RegExp(`className\\s*=\\s*'[^'\\n]*\\b${escaped}\\b[^'\\n]*'`, "u"),
    new RegExp(templateLiteralClassPattern, "u"),
    new RegExp(`className\\s*:\\s*"[^"\\n]*\\b${escaped}\\b[^"\\n]*"`, "u"),
    new RegExp(`className\\s*:\\s*'[^'\\n]*\\b${escaped}\\b[^'\\n]*'`, "u"),
  ];

  return sourceContents.some((content) => patterns.some((pattern) => pattern.test(content)));
}

function main() {
  const changedFiles = collectChangedFiles();
  if (!allMode && !shouldRunGuard(changedFiles)) {
    return;
  }

  const changedStyleFiles = changedFiles.filter(
    (filePath) => filePath.startsWith(STYLE_ROOT) && filePath.endsWith(STYLE_EXTENSION)
  );
  if (changedStyleFiles.length === 0) {
    return;
  }

  const sourceFiles = collectSourceFiles();
  const sourceContents = sourceFiles.map((filePath) =>
    fs.readFileSync(path.join(repoRoot, filePath), "utf8")
  );
  const violations = [];

  for (const styleFile of changedStyleFiles) {
    const absolutePath = path.join(repoRoot, styleFile);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    const currentContent = fs.readFileSync(absolutePath, "utf8");
    const currentClasses = extractClassNamesFromSelectors(
      extractGlobalStyleSelectors(currentContent)
    );

    const baselineContent = readHeadFile(styleFile);
    const baselineClasses = baselineContent
      ? extractClassNamesFromSelectors(extractGlobalStyleSelectors(baselineContent))
      : new Set();

    for (const className of currentClasses) {
      if (baselineClasses.has(className)) {
        continue;
      }
      if (!isClassReferenced(className, sourceContents)) {
        violations.push({ styleFile, className });
      }
    }
  }

  if (violations.length === 0) {
    process.stdout.write("Stale style selector guard: no violations detected.\n");
    return;
  }

  for (const violation of violations) {
    process.stderr.write(
      `${violation.styleFile}: new global selector class ".${violation.className}" is not referenced by any current source file.\n`
    );
  }
  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Stale style selector guard failed: ${message}\n`);
  process.exit(1);
}
