#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  allowedRuntimeCompatStyleImports,
  classifyCompatAliasFamily,
  restrictedCompatClassRules,
  restrictedCompatVarRules,
  retiredRuntimeCompatStyleFiles,
  retiredRuntimeCompatStyleImports,
} from "./lib/style-compat-config.mjs";

function resolveRepoRoot(argv) {
  const rootFlagIndex = argv.indexOf("--root");
  if (rootFlagIndex >= 0) {
    const explicitRoot = argv[rootFlagIndex + 1];
    if (explicitRoot) {
      return path.resolve(explicitRoot);
    }
  }
  return process.cwd();
}

function toRepoPath(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function readSourceIfExists(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function listImports(source) {
  return [...source.matchAll(/import\s+["'](.+?)["'];/g)].map((match) => match[1]);
}

function listCustomProperties(source) {
  return [...source.matchAll(/["'](--[^"']+)["']\s*:/g)].map((match) => match[1]);
}

function listSourceFiles(absoluteRoot) {
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(absoluteRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(entryPath));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(entry.name) &&
      !/\.test\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(entry.name) &&
      !/\.stories\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(entry.name) &&
      !/\.css\.ts$/.test(entry.name)
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function listStyleFiles(absoluteRoot) {
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(absoluteRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...listStyleFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".css.ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function main() {
  const repoRoot = resolveRepoRoot(process.argv.slice(2));
  const failures = [];

  const runtimeStylePath = path.join(repoRoot, "apps/code/src/styles/runtime.css.ts");
  const runtimeSource = readSourceIfExists(runtimeStylePath);
  if (runtimeSource) {
    const imports = listImports(runtimeSource);
    const compatImports = imports.filter(
      (specifier) => specifier === "./design-system.css" || specifier.startsWith("./ds-")
    );

    for (const specifier of compatImports) {
      if (
        !allowedRuntimeCompatStyleImports.has(specifier) &&
        !retiredRuntimeCompatStyleImports.has(specifier)
      ) {
        failures.push(
          `${toRepoPath(repoRoot, runtimeStylePath)}: unapproved app-local compat import ${specifier}.`
        );
      }

      if (retiredRuntimeCompatStyleImports.has(specifier)) {
        failures.push(
          `${toRepoPath(repoRoot, runtimeStylePath)}: retired app-local compat import ${specifier} must not return to the runtime bundle.`
        );
      }
    }
  }

  for (const relativePath of retiredRuntimeCompatStyleFiles) {
    if (fs.existsSync(path.join(repoRoot, relativePath))) {
      failures.push(
        `${relativePath}: retired app-local DS skin file still exists; keep this ownership in packages/design-system or delete it.`
      );
    }
  }

  const aliasPath = path.join(repoRoot, "apps/code/src/styles/tokens/dsAliases.css.ts");
  const aliasSource = readSourceIfExists(aliasPath);
  if (aliasSource) {
    for (const aliasName of listCustomProperties(aliasSource)) {
      const family = classifyCompatAliasFamily(aliasName);
      if (!family) {
        failures.push(
          `${toRepoPath(repoRoot, aliasPath)}: ${aliasName} uses an unregistered compat family. Register the family explicitly before adding new alias surfaces.`
        );
      }
    }
  }

  const compatClassScanRoots = [
    "apps/code/src",
    "packages/code-workspace-client/src",
    "packages/design-system/src",
  ];

  const sourceFiles = compatClassScanRoots.flatMap((relativeRoot) =>
    listSourceFiles(path.join(repoRoot, relativeRoot))
  );
  const styleFiles = compatClassScanRoots.flatMap((relativeRoot) =>
    listStyleFiles(path.join(repoRoot, relativeRoot))
  );

  for (const rule of restrictedCompatClassRules) {
    const pattern = new RegExp(rule.pattern, "g");

    for (const absolutePath of sourceFiles) {
      const repoPath = toRepoPath(repoRoot, absolutePath);
      if (rule.allowedPaths.has(repoPath)) {
        continue;
      }

      const source = readSourceIfExists(absolutePath);
      if (!source) {
        continue;
      }

      const matches = [...source.matchAll(pattern)];
      for (const match of matches) {
        failures.push(`${repoPath}: ${match[0]} is restricted to ${rule.label}; ${rule.guidance}`);
      }
    }
  }

  for (const rule of restrictedCompatVarRules) {
    const pattern = new RegExp(rule.pattern, "g");

    for (const absolutePath of styleFiles) {
      const repoPath = toRepoPath(repoRoot, absolutePath);
      if (rule.allowedPaths.has(repoPath)) {
        continue;
      }

      const source = readSourceIfExists(absolutePath);
      if (!source) {
        continue;
      }

      const matches = [...source.matchAll(pattern)];
      for (const match of matches) {
        failures.push(`${repoPath}: ${match[0]} is restricted to ${rule.label}; ${rule.guidance}`);
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Style compat boundary guard failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Style compat boundary guard: no violations detected.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
