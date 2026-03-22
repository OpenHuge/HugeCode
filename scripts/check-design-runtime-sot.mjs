#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const changedFilesEnv = process.env.VALIDATE_CHANGED_FILES_JSON;
const MAIN_ENTRY_PATH = "apps/code/src/main.tsx";
const INDEX_HTML_PATH = "apps/code/index.html";
const RUNTIME_CSS_PATH = "apps/code/src/styles/runtime.css.ts";
const FROZEN_THEME_RUNTIME_PATHS = new Set([
  "apps/code/src/styles/tokens/themeContract.css.ts",
  "apps/code/src/styles/tokens/themes.css.ts",
  "apps/code/src/styles/tokens/semanticThemeContract.css.ts",
  "apps/code/src/styles/tokens/semanticTheme.css.ts",
  "apps/code/src/styles/tokens/themeValues.ts",
]);
const SOURCE_FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function readRepoFile(repoPath) {
  return fs.readFileSync(path.join(repoRoot, repoPath), "utf8");
}

function collectRepoFiles(rootDir) {
  const absoluteRoot = path.join(repoRoot, rootDir);
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

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const repoPath = toPosixPath(path.relative(repoRoot, absolutePath));
      if (!SOURCE_FILE_EXTENSIONS.has(path.posix.extname(repoPath))) {
        continue;
      }
      files.push(repoPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function collectCandidateFiles() {
  if (!changedFilesEnv) {
    return collectRepoFiles("apps/code/src");
  }

  try {
    const parsed = JSON.parse(changedFilesEnv);
    if (!Array.isArray(parsed)) {
      return collectRepoFiles("apps/code/src");
    }
    return parsed
      .map((value) => String(value))
      .map(toPosixPath)
      .filter((filePath) => SOURCE_FILE_EXTENSIONS.has(path.posix.extname(filePath)))
      .filter((filePath) => filePath.startsWith("apps/code/src/"))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return collectRepoFiles("apps/code/src");
  }
}

function collectImportSpecifiers(sourceText) {
  const specifiers = [];
  const importPattern =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?[^"'`]*?(?:from\s+)?["']([^"']+)["']/gu;
  for (const match of sourceText.matchAll(importPattern)) {
    const specifier = match[1]?.trim();
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function normalizeRelativeImport(importerPath, specifier) {
  if (!specifier.startsWith(".")) {
    return specifier;
  }
  const importerDir = path.posix.dirname(importerPath);
  const resolved = path.posix.normalize(path.posix.join(importerDir, specifier));
  return resolved.endsWith(".ts") || resolved.endsWith(".tsx") ? resolved : `${resolved}.ts`;
}

function main() {
  const failures = [];
  const indexHtml = readRepoFile(INDEX_HTML_PATH);
  const runtimeCss = readRepoFile(RUNTIME_CSS_PATH);
  const mainEntry = readRepoFile(MAIN_ENTRY_PATH);

  if (/<html[^>]*\sdata-theme\s*=/u.test(indexHtml)) {
    failures.push(`${INDEX_HTML_PATH}: static html shell must not hardcode data-theme.`);
  }

  if (!runtimeCss.includes("@ku0/design-system/styles")) {
    failures.push(`${RUNTIME_CSS_PATH}: runtime styles must import @ku0/design-system/styles.`);
  }

  const forbiddenRuntimeImports = [
    "./tokens/themeContract.css",
    "./tokens/themes.css",
    "./tokens/semanticThemeContract.css",
    "./tokens/semanticTheme.css",
  ];
  for (const specifier of forbiddenRuntimeImports) {
    if (runtimeCss.includes(`"${specifier}"`) || runtimeCss.includes(`'${specifier}'`)) {
      failures.push(`${RUNTIME_CSS_PATH}: runtime styles must not import ${specifier}.`);
    }
  }

  if (
    mainEntry.includes('import "./styles/runtime";') ||
    mainEntry.includes("import './styles/runtime';")
  ) {
    failures.push(
      `${MAIN_ENTRY_PATH}: styles/runtime must be loaded after theme bootstrap, not as a static import.`
    );
  }

  if (!mainEntry.includes("applyDesignSystemThemeRuntime")) {
    failures.push(
      `${MAIN_ENTRY_PATH}: main entry must invoke applyDesignSystemThemeRuntime before rendering.`
    );
  }

  for (const filePath of collectCandidateFiles()) {
    if (FROZEN_THEME_RUNTIME_PATHS.has(filePath)) {
      continue;
    }
    const sourceText = readRepoFile(filePath);
    for (const specifier of collectImportSpecifiers(sourceText)) {
      const normalized = normalizeRelativeImport(filePath, specifier);
      if (FROZEN_THEME_RUNTIME_PATHS.has(normalized)) {
        failures.push(
          `${filePath}: new code must not import frozen app-local runtime theme source ${normalized}.`
        );
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design runtime source-of-truth guard failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design runtime source-of-truth guard passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
