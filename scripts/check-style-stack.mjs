import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const scanAll = process.argv.includes("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";

const BANNED_PACKAGES = new Set(["tailwindcss", "tailwind-merge"]);
const BANNED_PACKAGE_PREFIXES = ["@tailwindcss/"];
const BANNED_FILE_NAMES = [/^tailwind(\.config)?\.[cm]?[jt]sx?$/u];
const BANNED_PATTERNS = [
  { label: '@import "tailwindcss"', regex: /@import\s+["']tailwindcss["']/gu },
  { label: "@theme directive", regex: /@theme\b/gu },
  { label: "@apply directive", regex: /@apply\b/gu },
];
const TEXT_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);
const EXCLUDED_DIRS = new Set([
  ".codex",
  ".figma-workflow",
  ".git",
  ".build",
  ".next",
  ".turbo",
  "dist-electron",
  "coverage",
  "dist",
  "build",
  "out",
  "storybook-static",
  "node_modules",
  "target",
]);
const ALLOWED_PLAIN_CSS = new Set(["apps/code/public/vendor/xterm/xterm.css"]);
const ROOT_TEXT_FILES = [
  "AGENTS.md",
  "CODING_STANDARDS.md",
  "package.json",
  ".oxlintrc.json",
  ".oxfmtrc.json",
];
const ROOT_SCAN_DIRS = ["apps", "packages", "scripts", "tests", "docs", ".agent"];

const violations = [];

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function listFromGit(gitArgs) {
  const output = execFileSync("git", gitArgs, {
    cwd: rootDir,
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

function isExcludedRepoPath(repoPath) {
  return repoPath.split("/").some((segment) => EXCLUDED_DIRS.has(segment));
}

function isRelevantChangedFile(repoPath) {
  if (!repoPath || isExcludedRepoPath(repoPath)) {
    return false;
  }
  if (ROOT_TEXT_FILES.includes(repoPath)) {
    return true;
  }
  return ROOT_SCAN_DIRS.some((scanDir) => repoPath.startsWith(`${scanDir}/`));
}

function recordViolation(filePath, message) {
  violations.push(`${filePath}: ${message}`);
}

function isBannedPackage(name) {
  return (
    BANNED_PACKAGES.has(name) || BANNED_PACKAGE_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

function scanPackageJson(filePath) {
  const repoPath = toRepoPath(filePath);
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const entries = content[field];
    if (!entries || typeof entries !== "object") {
      continue;
    }
    for (const dependencyName of Object.keys(entries)) {
      if (isBannedPackage(dependencyName)) {
        recordViolation(repoPath, `forbidden dependency in ${field}: ${dependencyName}`);
      }
    }
  }
}

function scanTextFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (repoPath === "scripts/check-style-stack.mjs") {
    return;
  }
  if (repoPath.startsWith("tests/")) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const pattern of BANNED_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) {
      recordViolation(repoPath, `forbidden style-stack pattern: ${pattern.label}`);
    }
  }
}

function scanFile(filePath) {
  const repoPath = toRepoPath(filePath);
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath);

  if (BANNED_FILE_NAMES.some((pattern) => pattern.test(baseName))) {
    recordViolation(repoPath, "forbidden Tailwind config/helper filename");
  }

  if (baseName === "package.json") {
    scanPackageJson(filePath);
  }

  if (extension === ".css" && !ALLOWED_PLAIN_CSS.has(repoPath)) {
    recordViolation(repoPath, "repo-owned plain .css is forbidden; use vanilla-extract (.css.ts)");
  }

  if (TEXT_FILE_EXTENSIONS.has(extension) || ROOT_TEXT_FILES.includes(baseName)) {
    scanTextFile(filePath);
  }
}

function scanDirectory(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  let entries = [];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        scanDirectory(path.join(directory, entry.name));
      }
      continue;
    }
    scanFile(path.join(directory, entry.name));
  }
}

function scanChangedFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!isRelevantChangedFile(filePath)) {
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

    scanFile(absolutePath);
  }
}

if (scanAll || !process.env[SHARED_CHANGED_FILES_ENV_KEY]) {
  for (const rootFile of ROOT_TEXT_FILES) {
    const absolutePath = path.join(rootDir, rootFile);
    if (fs.existsSync(absolutePath)) {
      scanFile(absolutePath);
    }
  }

  for (const scanDir of ROOT_SCAN_DIRS) {
    scanDirectory(path.join(rootDir, scanDir));
  }
} else {
  scanChangedFiles(collectChangedFiles());
}

if (violations.length > 0) {
  for (const violation of violations.sort()) {
  }
  process.exit(1);
}
