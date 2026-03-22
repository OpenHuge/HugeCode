import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".rs",
  ".json",
]);
const IGNORED_PREFIXES = ["docs/", ".codex/", ".figma-workflow/", ".git/", "node_modules/"];
const IGNORED_FILES = new Set([
  "scripts/check-llm-scaffolding.mjs",
  "tests/scripts/check-llm-scaffolding.test.ts",
]);
const SCAFFOLDING_PATTERNS = [
  {
    label: "rest of implementation unchanged",
    pattern:
      /\b(?:rest|remainder) of (?:the )?(?:code|file|implementation)\s+(?:is|remains)\s+unchanged\b/giu,
  },
  {
    label: "implementation omitted",
    pattern: /\b(?:implementation|logic|code)\s+omitted(?:\s+for\s+brevity)?\b/giu,
  },
  {
    label: "same as before",
    pattern: /\bsame as (?:before|above)\b/giu,
  },
  {
    label: "your code here",
    pattern: /\byour code here\b/giu,
  },
  {
    label: "placeholder implementation",
    pattern: /\bplaceholder implementation\b/giu,
  },
];

function toPosixPath(input) {
  return input.split(path.sep).join("/");
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

function isRelevantFile(filePath) {
  const normalized = toPosixPath(filePath);
  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  if (IGNORED_FILES.has(normalized)) {
    return false;
  }
  if (/\/(?:dist|coverage|target)\//u.test(normalized)) {
    return false;
  }
  if (normalized.endsWith(".min.js") || normalized.endsWith(".min.css")) {
    return false;
  }
  if (normalized === "package.json") {
    return true;
  }
  if (!/^(apps|packages|tests|scripts)\//u.test(normalized)) {
    return false;
  }
  return SOURCE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase());
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

const candidates = readChangedFiles().filter(isRelevantFile);
const violations = [];

for (const filePath of candidates) {
  const absolutePath = path.join(repoRoot, filePath);
  let content;
  try {
    content = fs.readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }

  for (const { label, pattern } of SCAFFOLDING_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    do {
      match = pattern.exec(content);
      if (!match) {
        continue;
      }
      violations.push({
        filePath,
        line: lineNumberAt(content, match.index),
        label,
        snippet: match[0],
      });
    } while (match);
  }
}

if (violations.length === 0) {
  process.exit(0);
}

for (const violation of violations) {
  process.stderr.write(
    `${violation.filePath}:${violation.line} ${violation.label}: ${violation.snippet}\n`
  );
}
process.stderr.write(
  "Remove LLM scaffolding residue like omitted implementations or 'unchanged' placeholders before validating.\n"
);
process.exit(1);
