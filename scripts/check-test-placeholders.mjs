import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const roots = ["apps", "packages", "tests"];
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const ignoredDirectories = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  ".next",
  ".git",
  ".codex",
  ".figma-workflow",
]);
const ignoredFiles = new Set([
  "tests/scripts/check-test-placeholders.test.ts",
  "tests/scripts/check-llm-scaffolding.test.ts",
  "tests/scripts/validate.test.ts",
]);
const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const placeholderPatterns = [
  /expect\s*\(\s*true\s*\)\s*\.\s*toBe\s*\(\s*true\s*\)/gu,
  /expect\s*\(\s*false\s*\)\s*\.\s*toBe\s*\(\s*false\s*\)/gu,
  /expect\s*\(\s*true\s*\)\s*\.\s*toEqual\s*\(\s*true\s*\)/gu,
  /expect\s*\(\s*false\s*\)\s*\.\s*toEqual\s*\(\s*false\s*\)/gu,
  /\b(?:it|test|describe)\.only\s*\(/gu,
  /\b(?:fit|fdescribe)\s*\(/gu,
];

function toPosixPath(input) {
  return input.split(path.sep).join("/");
}

function findTestFiles(rootAbsolutePath) {
  const matches = [];
  let entries = [];
  try {
    entries = fs.readdirSync(rootAbsolutePath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      return matches;
    }
    throw error;
  }
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(rootAbsolutePath, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findTestFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (testFilePattern.test(entry.name)) {
      matches.push(absolutePath);
    }
  }
  return matches;
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

const violations = [];
const changedFiles = readChangedFiles();
const candidateFiles =
  changedFiles.length > 0
    ? changedFiles
        .map(toPosixPath)
        .filter(
          (filePath) =>
            testFilePattern.test(path.posix.basename(filePath)) && !ignoredFiles.has(filePath)
        )
        .map((filePath) => path.join(repoRoot, filePath))
    : roots.flatMap((root) => {
        const rootAbsolutePath = path.join(repoRoot, root);
        if (!fs.existsSync(rootAbsolutePath)) {
          return [];
        }
        return findTestFiles(rootAbsolutePath);
      });

for (const filePath of candidateFiles) {
  const repoRelativePath = toPosixPath(path.relative(repoRoot, filePath));
  if (ignoredFiles.has(repoRelativePath) || !fs.existsSync(filePath)) {
    continue;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const pattern of placeholderPatterns) {
    pattern.lastIndex = 0;
    let match;
    do {
      match = pattern.exec(content);
      if (!match) {
        continue;
      }
      const line = lineNumberAt(content, match.index);
      violations.push({
        file: repoRelativePath,
        line,
        snippet: match[0],
      });
    } while (match);
  }
}

function readChangedFiles() {
  const raw = process.env[SHARED_CHANGED_FILES_ENV_KEY];
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

if (violations.length === 0) {
  process.exit(0);
}

for (const violation of violations) {
  process.stderr.write(`${violation.file}:${violation.line} ${violation.snippet}\n`);
}
process.stderr.write(
  "Replace placeholder assertions and remove focused tests before running validate.\n"
);
process.exit(1);
