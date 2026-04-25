import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const scanAll = process.argv.includes("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";

const INLINE_STYLE_REGEX = /\bstyle=\{/g;
const EXCLUDED_DIRS = [
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "coverage",
  ".storybook",
  ".codex",
  ".figma-workflow",
];
const EXCLUDED_PREFIXES = ["apps/code-t3/upstream/"];

let hasViolations = false;

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function collectChangedFilesFromEnv() {
  const raw = process.env[SHARED_CHANGED_FILES_ENV_KEY];
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    return [...new Set(parsed.map((value) => toPosixPath(String(value))))].sort((left, right) =>
      left.localeCompare(right)
    );
  } catch {
    return null;
  }
}

function scanSingleFile(fullPath) {
  const repoPath = toPosixPath(path.relative(rootDir, fullPath));
  if (EXCLUDED_PREFIXES.some((prefix) => repoPath.startsWith(prefix))) {
    return;
  }
  const file = path.basename(fullPath);
  if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) {
    return;
  }
  if (file.includes(".test.") || file.includes(".stories.")) {
    return;
  }

  const content = fs.readFileSync(fullPath, "utf8");
  INLINE_STYLE_REGEX.lastIndex = 0;

  if (INLINE_STYLE_REGEX.test(content)) {
    process.stderr.write(`Inline style usage is forbidden in repo-owned UI: ${repoPath}\n`);
    hasViolations = true;
  }
}

function scanDirectory(directory) {
  let files = [];
  try {
    files = fs.readdirSync(directory);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "EPERM" || error.code === "ENOENT")
    ) {
      return;
    }
    throw error;
  }

  for (const file of files) {
    const fullPath = path.join(directory, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "EPERM" || error.code === "ENOENT")
      ) {
        continue;
      }
      throw error;
    }

    if (stat.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(file)) {
        scanDirectory(fullPath);
      }
    } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
      scanSingleFile(fullPath);
    }
  }
}

function scanChangedFiles(filePaths) {
  for (const filePath of filePaths) {
    if (
      !(filePath.startsWith("apps/") || filePath.startsWith("packages/")) ||
      filePath.split("/").some((segment) => EXCLUDED_DIRS.includes(segment)) ||
      EXCLUDED_PREFIXES.some((prefix) => filePath.startsWith(prefix))
    ) {
      continue;
    }

    const absolutePath = path.join(rootDir, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    let stats;
    try {
      stats = fs.statSync(absolutePath);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "EPERM" || error.code === "ENOENT")
      ) {
        continue;
      }
      throw error;
    }

    if (!stats.isFile()) {
      continue;
    }

    scanSingleFile(absolutePath);
  }
}

const changedFiles = scanAll ? null : collectChangedFilesFromEnv();

if (changedFiles) {
  scanChangedFiles(changedFiles);
} else {
  scanDirectory(path.join(rootDir, "apps"));
  scanDirectory(path.join(rootDir, "packages"));
}

if (hasViolations) {
  process.exit(1);
} else {
}
