#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  isAllowedColorLiteralPath,
  isAllowedLegacyAliasPath,
  isExcludedStyleDirectory,
  STYLE_GUARD_SCAN_ROOTS,
  toPosixPath,
} from "./lib/style-guard-config.mjs";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const scanAll = args.has("--all");
const SHARED_CHANGED_FILES_ENV_KEY = "VALIDATE_CHANGED_FILES_JSON";

const LEGACY_ALIAS_PATTERNS = [
  /var\(--text-(?:primary|strong|emphasis|stronger|quiet|muted|subtle|faint|fainter|dim|danger|accent|review-active|review-done)\b[^)]*\)/u,
  /var\(--surface-(?:sidebar(?:-opaque)?|topbar|right-panel|composer|messages|card(?:-strong|-muted)?|item|control(?:-hover|-disabled)?|hover|active|approval|debug|command|diff-card|bubble(?:-user)?|context-core|popover|review(?:-active|-done)?)\b[^)]*\)/u,
  /var\(--border-(?:subtle|muted|strong|stronger|quiet|accent(?:-soft)?|review)\b[^)]*\)/u,
  /var\(--brand-(?:primary|secondary|background)\b[^)]*\)/u,
];
const RETIRED_COMPAT_ALIAS_PATTERNS = [
  /var\(--(?:text|text-error|text-danger|text-secondary|text-tertiary|text-strongest)(?:\s*[),])/u,
  /var\(--(?:surface-1|surface-2|surface-quiet|surface-strong|surface-secondary|surface-base|surface-muted)(?:\s*[),])/u,
  /var\(--(?:brand-text|status-danger|border-subtle-soft)(?:\s*[),])/u,
  /["']--(?:text|text-error|text-danger|text-secondary|text-tertiary|text-strongest)["']\s*:/u,
  /["']--(?:surface-1|surface-2|surface-quiet|surface-strong|surface-secondary|surface-base|surface-muted)["']\s*:/u,
  /["']--(?:brand-text|status-danger|border-subtle-soft)["']\s*:/u,
];

const COLOR_LITERAL_PATTERN = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(|hsl\s*\(|oklch\s*\(/u;
const COLOR_MIX_PATTERN = /color-mix\s*\(/u;
const RAW_COLOR_FALLBACK_PATTERN =
  /var\([^)]*,\s*(?:#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(|hsl\s*\(|oklch\s*\()/u;

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

function isStyleLikeFile(entry) {
  if (!entry.isFile()) {
    return false;
  }
  return entry.name.endsWith(".css.ts") || entry.name.endsWith(".styles.ts");
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
      if (!isStyleLikeFile(entry)) {
        continue;
      }
      files.push(toPosixPath(path.relative(repoRoot, absolutePath)));
    }
  }

  return files;
}

function collectAllStyleFiles() {
  const files = STYLE_GUARD_SCAN_ROOTS.flatMap((root) => collectStyleFilesUnderRoot(root));
  return files.sort((left, right) => left.localeCompare(right));
}

function collectTargetStyleFiles() {
  if (scanAll) {
    return collectAllStyleFiles();
  }
  return collectChangedFiles().filter(
    (filePath) => filePath.endsWith(".css.ts") || filePath.endsWith(".styles.ts")
  );
}

function createViolation(filePath, lineNumber, kind, snippet) {
  return { filePath, lineNumber, kind, snippet };
}

function findLegacyAliasViolation(filePath, line, trimmedLine, lineNumber) {
  if (isAllowedLegacyAliasPath(filePath)) {
    return null;
  }
  const hasLegacyAlias = LEGACY_ALIAS_PATTERNS.some((pattern) => pattern.test(line));
  if (!hasLegacyAlias) {
    return null;
  }
  return createViolation(filePath, lineNumber, "legacy-alias", trimmedLine);
}

function findRetiredCompatAliasViolation(filePath, line, trimmedLine, lineNumber) {
  const hasRetiredCompatAlias = RETIRED_COMPAT_ALIAS_PATTERNS.some((pattern) => pattern.test(line));
  if (!hasRetiredCompatAlias) {
    return null;
  }
  return createViolation(filePath, lineNumber, "retired-compat-alias", trimmedLine);
}

function findRawColorViolation(filePath, line, trimmedLine, lineNumber) {
  if (isAllowedColorLiteralPath(filePath)) {
    return null;
  }
  if (RAW_COLOR_FALLBACK_PATTERN.test(line)) {
    return createViolation(filePath, lineNumber, "raw-color-fallback", trimmedLine);
  }
  if (COLOR_LITERAL_PATTERN.test(line)) {
    return createViolation(filePath, lineNumber, "raw-color-literal", trimmedLine);
  }
  return null;
}

function findLegacyColorMixViolation(filePath, line, trimmedLine, lineNumber) {
  if (isAllowedLegacyAliasPath(filePath) || !COLOR_MIX_PATTERN.test(line)) {
    return null;
  }
  const mixesLegacyAlias = LEGACY_ALIAS_PATTERNS.some((pattern) => pattern.test(line));
  if (!mixesLegacyAlias) {
    return null;
  }
  return createViolation(filePath, lineNumber, "legacy-color-mix", trimmedLine);
}

function scanFile(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/u);
  const violations = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith("//")) {
      continue;
    }

    const lineNumber = lineIndex + 1;
    const legacyAliasViolation = findLegacyAliasViolation(filePath, line, trimmedLine, lineNumber);
    if (legacyAliasViolation) {
      violations.push(legacyAliasViolation);
    }

    const rawColorViolation = findRawColorViolation(filePath, line, trimmedLine, lineNumber);
    if (rawColorViolation) {
      violations.push(rawColorViolation);
    }

    const retiredCompatAliasViolation = findRetiredCompatAliasViolation(
      filePath,
      line,
      trimmedLine,
      lineNumber
    );
    if (retiredCompatAliasViolation) {
      violations.push(retiredCompatAliasViolation);
    }

    const legacyColorMixViolation = findLegacyColorMixViolation(
      filePath,
      line,
      trimmedLine,
      lineNumber
    );
    if (legacyColorMixViolation) {
      violations.push(legacyColorMixViolation);
    }
  }

  return violations;
}

function main() {
  const styleFiles = collectTargetStyleFiles();
  if (styleFiles.length === 0) {
    process.stdout.write("Style color/source-of-truth guard: no matching files to scan.\n");
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

  process.stdout.write("Style color/source-of-truth guard: no violations detected.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  process.stderr.write(`Style color/source-of-truth guard failed: ${message}\n`);
  process.exit(1);
}
