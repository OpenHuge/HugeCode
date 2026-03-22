#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  isExcludedStyleDirectory,
  SEMANTIC_STYLE_GUARD_SCAN_ROOTS,
  toPosixPath,
} from "./lib/style-guard-config.mjs";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const scanAll = args.has("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";
const ALLOWED_FONT_SIZE_PATTERNS = [
  /var\(--font-size-[a-z0-9-]+\)/u,
  /var\(--ds-(?:button-font|input-font)[a-z-]*\)/u,
  /var\(--code-font-size\)/u,
  /clamp\(/u,
];
const ALLOWED_LINE_HEIGHT_PATTERNS = [
  /var\(--line-height-[a-z0-9-]+\)/u,
  /var\(--code-line-height\)/u,
];
const ALLOWED_TRANSITION_PATTERNS = [
  /var\(--duration-[a-z-]+\)/u,
  /var\(--motion-[a-z-]+\)/u,
  /var\(--ds-motion-[a-z-]+\)/u,
];
const ALLOWED_OUTLINE_PATTERNS = [
  /var\(--focus-ring-[a-z-]+\)/u,
  /var\(--ds-shell-control-focus-outline\)/u,
];

function hasRawColorFallback(value) {
  return /rgba?\s*\(|hsla?\s*\(|#[0-9a-fA-F]{3,8}\b/u.test(value) || /var\([^)]*,/u.test(value);
}

function usesTransitionAll(value) {
  return /(?:^|,)\s*all(?:\s|,|$)/u.test(value);
}

const PROPERTY_PATTERNS = [
  {
    kind: "fontSize",
    regex: /(?<property>fontSize|["']font-size["'])\s*:\s*(?<quote>["'])(?<value>[^"']+)\k<quote>/u,
    isAllowed: (value) => ALLOWED_FONT_SIZE_PATTERNS.some((pattern) => pattern.test(value)),
  },
  {
    kind: "lineHeight",
    regex:
      /(?<property>lineHeight|["']line-height["'])\s*:\s*(?:(?<quote>["'])(?<quotedValue>[^"']+)\k<quote>|(?<rawValue>\d+(?:\.\d+)?))/u,
    isAllowed: (value) =>
      value === "normal" ||
      value === "inherit" ||
      ALLOWED_LINE_HEIGHT_PATTERNS.some((pattern) => pattern.test(value)),
  },
  {
    kind: "transition",
    regex:
      /(?<property>transition|["']transition["'])\s*:\s*(?<quote>["'])(?<value>[^"']+)\k<quote>/u,
    isAllowed: (value) =>
      value === "none" ||
      (!usesTransitionAll(value) &&
        (!/\b\d+(?:\.\d+)?(?:ms|s)\b/u.test(value) ||
          ALLOWED_TRANSITION_PATTERNS.some((pattern) => pattern.test(value)))),
  },
  {
    kind: "outline",
    regex: /(?<property>outline|["']outline["'])\s*:\s*(?<quote>["'])(?<value>[^"']+)\k<quote>/u,
    isAllowed: (value) =>
      value === "none" ||
      !hasRawColorFallback(value) ||
      ALLOWED_OUTLINE_PATTERNS.some((pattern) => pattern.test(value)),
  },
  {
    kind: "boxShadow",
    regex:
      /(?<property>boxShadow|["']box-shadow["'])\s*:\s*(?<quote>["'])(?<value>[^"']+)\k<quote>/u,
    isAllowed: (value) =>
      value === "none" ||
      !hasRawColorFallback(value) ||
      /var\(--(?:shadow|elevation)-[a-z-]+\)/u.test(value),
  },
];

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
      // Fall through to git-based discovery.
    }
  }

  const tracked = listFromGit(["diff", "--name-only", "--diff-filter=ACMR", "--relative", "HEAD"]);
  const untracked = listFromGit(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].sort((left, right) => left.localeCompare(right));
}

function isStyleModuleEntry(entry) {
  return entry.isFile() && entry.name.endsWith(".css.ts");
}

function collectStyleFilesUnderRoot(root) {
  const rootPath = path.join(repoRoot, root);
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const files = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!isExcludedStyleDirectory(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }
      if (!isStyleModuleEntry(entry)) {
        continue;
      }
      files.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }

  return files;
}

function collectAllStyleFiles() {
  const files = SEMANTIC_STYLE_GUARD_SCAN_ROOTS.flatMap((root) => collectStyleFilesUnderRoot(root));
  return files.sort((left, right) => left.localeCompare(right));
}

function collectTargetStyleFiles() {
  if (scanAll) {
    return collectAllStyleFiles();
  }
  return collectChangedFiles().filter((filePath) => filePath.endsWith(".css.ts"));
}

function scanFile(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  const content = fs.readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/u);
  const violations = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const pattern of PROPERTY_PATTERNS) {
      const match = line.match(pattern.regex);
      const value = match?.groups?.value ?? match?.groups?.quotedValue ?? match?.groups?.rawValue;
      if (!value) {
        continue;
      }
      if (pattern.isAllowed(value.trim())) {
        continue;
      }
      violations.push({
        filePath,
        lineNumber: lineIndex + 1,
        kind: pattern.kind,
        snippet: line.trim(),
      });
    }
  }

  return violations;
}

function main() {
  const styleFiles = collectTargetStyleFiles();
  if (styleFiles.length === 0) {
    process.stdout.write("Style semantic primitive guard: no matching files to scan.\n");
    return;
  }

  const violations = styleFiles.flatMap((filePath) => scanFile(filePath));
  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(
        `${violation.filePath}:${violation.lineNumber}: ${violation.kind}: ${violation.snippet}\n`
      );
    }
    process.exit(1);
  }

  process.stdout.write("Style semantic primitive guard: no violations detected.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`Style semantic primitive guard failed: ${message}\n`);
  process.exit(1);
}
