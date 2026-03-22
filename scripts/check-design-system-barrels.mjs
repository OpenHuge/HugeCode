#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const BARREL_FILES = [
  {
    label: "shared design-system barrel",
    repoPath: "packages/design-system/src/index.ts",
    required: true,
  },
  {
    label: "app adapter barrel",
    repoPath: "apps/code/src/design-system/adapters/index.ts",
    required: false,
  },
  {
    label: "app design-system barrel",
    repoPath: "apps/code/src/design-system/index.ts",
    required: true,
  },
];

const FILE_CANDIDATE_SUFFIXES = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const INDEX_CANDIDATE_SUFFIXES = [
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.mjs",
  "/index.cjs",
];

function collectRelativeSpecifiers(sourceText) {
  const specifiers = new Set();
  const importFromPattern = /(?:^|\n)\s*(?:export|import)[^"'`]*?\sfrom\s+["'](\.[^"']*)["']/gu;
  const sideEffectImportPattern = /(?:^|\n)\s*import\s+["'](\.[^"']*)["']/gu;

  for (const pattern of [importFromPattern, sideEffectImportPattern]) {
    for (const match of sourceText.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers].sort((left, right) => left.localeCompare(right));
}

function resolveSpecifier(baseFilePath, specifier) {
  const baseDir = path.dirname(baseFilePath);
  const absoluteBase = path.resolve(baseDir, specifier);

  if (fs.existsSync(absoluteBase) && fs.statSync(absoluteBase).isFile()) {
    return absoluteBase;
  }

  for (const suffix of FILE_CANDIDATE_SUFFIXES) {
    const candidate = `${absoluteBase}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  for (const suffix of INDEX_CANDIDATE_SUFFIXES) {
    const candidate = `${absoluteBase}${suffix}`;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function main() {
  const failures = [];

  for (const barrel of BARREL_FILES) {
    const barrelPath = path.join(repoRoot, barrel.repoPath);
    if (!fs.existsSync(barrelPath)) {
      if (barrel.required) {
        failures.push({
          type: "missing-barrel",
          barrelLabel: barrel.label,
          barrelPath: barrel.repoPath,
        });
      }
      continue;
    }

    const sourceText = fs.readFileSync(barrelPath, "utf8");
    const relativeSpecifiers = collectRelativeSpecifiers(sourceText);

    for (const specifier of relativeSpecifiers) {
      const resolvedPath = resolveSpecifier(barrelPath, specifier);
      if (!resolvedPath) {
        failures.push({
          type: "missing-module",
          barrelLabel: barrel.label,
          barrelPath: barrel.repoPath,
          specifier,
        });
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system barrel integrity check failed.\n");
    for (const failure of failures) {
      if (failure.type === "missing-barrel") {
        process.stderr.write(
          `- ${failure.barrelLabel}: expected barrel file is missing at ${failure.barrelPath}\n`
        );
        continue;
      }

      process.stderr.write(
        `- ${failure.barrelLabel}: ${failure.barrelPath} references missing module ${failure.specifier}\n`
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Design-system barrel integrity check passed.\n");
}

main();
