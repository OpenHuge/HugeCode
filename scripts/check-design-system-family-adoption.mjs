#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { DESIGN_SYSTEM_FAMILY_CONTRACTS } from "./lib/design-system-family-contract-config.mjs";

function parseRootArg(argv) {
  const rootFlagIndex = argv.indexOf("--root");
  if (rootFlagIndex === -1) {
    return process.cwd();
  }

  const candidate = argv[rootFlagIndex + 1];
  if (!candidate) {
    throw new Error("Missing value for --root.");
  }

  return path.resolve(candidate);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function readFileIfPresent(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function resolveImportSourcePattern(importSource) {
  if (importSource === "app_design_system") {
    return /["'](?!@ku0\/design-system)[^"']*design-system["']/u;
  }

  return new RegExp(`["']${escapeRegExp(importSource)}["']`, "u");
}

function hasNamedImport(sourceText, importName, importSource) {
  const importNamePattern = escapeRegExp(importName);
  const importSourcePattern = resolveImportSourcePattern(importSource).source;
  const importPattern = new RegExp(
    `import\\s*\\{[\\s\\S]*\\b${importNamePattern}\\b[\\s\\S]*\\}\\s*from\\s*${importSourcePattern}`,
    "u"
  );
  return importPattern.test(sourceText);
}

function collectMissingImports(sourceText, evidence) {
  return evidence.requiredImports.filter(
    (importName) => !hasNamedImport(sourceText, importName, evidence.importSource)
  );
}

function collectMissingUsageSnippets(sourceText, evidence) {
  return evidence.requiredUsageSnippets.filter((snippet) => !sourceText.includes(snippet));
}

function validateEvidenceFile(repoRoot, family, evidence, failures) {
  const absolutePath = path.join(repoRoot, evidence.relativePath);
  const sourceText = readFileIfPresent(absolutePath);

  if (sourceText === null) {
    failures.push(
      `${family.publicComponentName}: missing adoption evidence file ${evidence.relativePath}.`
    );
    return;
  }

  const missingImports = collectMissingImports(sourceText, evidence);
  if (missingImports.length > 0) {
    failures.push(
      `${family.publicComponentName}: ${evidence.relativePath} is missing required import evidence for ${missingImports.join(", ")}.`
    );
  }

  const missingUsageSnippets = collectMissingUsageSnippets(sourceText, evidence);
  if (missingUsageSnippets.length > 0) {
    failures.push(
      `${family.publicComponentName}: ${evidence.relativePath} is missing required usage evidence for ${missingUsageSnippets.join(", ")}.`
    );
  }
}

function main() {
  const repoRoot = parseRootArg(process.argv.slice(2));
  const failures = [];

  for (const family of DESIGN_SYSTEM_FAMILY_CONTRACTS) {
    const adoption = family.adoption;
    if (!adoption) {
      continue;
    }

    for (const evidence of adoption.evidence) {
      validateEvidenceFile(repoRoot, family, evidence, failures);
    }

    if (adoption.type === "modal_shell_surface" && adoption.compatBridge) {
      validateEvidenceFile(repoRoot, family, adoption.compatBridge, failures);
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system family adoption check failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design-system family adoption check passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
