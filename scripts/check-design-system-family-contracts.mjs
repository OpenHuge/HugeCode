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

function readRequiredFile(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`${label} is missing at ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function publicDocsPromoteFamily(publicComponentsText, componentName) {
  const bulletPattern = new RegExp(`^\\s*-\\s+\`${escapeRegExp(componentName)}\`\\s*$`, "mu");
  return bulletPattern.test(publicComponentsText);
}

function hasNamedExport(indexSourceText, exportName) {
  const namePattern = escapeRegExp(exportName);
  const exportPattern = new RegExp(`export\\s*\\{[^}]*\\b${namePattern}\\b`, "u");
  return exportPattern.test(indexSourceText);
}

function assertFileExists(repoRoot, relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function main() {
  const repoRoot = parseRootArg(process.argv.slice(2));
  const publicComponentsPath = path.join(
    repoRoot,
    "packages",
    "ui",
    "src",
    "components",
    "PublicComponents.mdx"
  );
  const uiIndexPath = path.join(repoRoot, "packages", "ui", "src", "index.ts");

  const publicComponentsText = readRequiredFile(publicComponentsPath, "Public components doc");
  const uiIndexSourceText = readRequiredFile(uiIndexPath, "@ku0/ui public barrel");
  const failures = [];

  for (const family of DESIGN_SYSTEM_FAMILY_CONTRACTS) {
    if (!publicDocsPromoteFamily(publicComponentsText, family.publicComponentName)) {
      failures.push(
        `${family.publicComponentName}: missing promoted family entry in packages/ui/src/components/PublicComponents.mdx.`
      );
    }

    const missingUiExports = family.requiredUiExports.filter(
      (exportName) => !hasNamedExport(uiIndexSourceText, exportName)
    );
    if (missingUiExports.length > 0) {
      failures.push(
        `${family.publicComponentName}: missing @ku0/ui export(s) in packages/ui/src/index.ts: ${missingUiExports.join(", ")}.`
      );
    }

    if (!assertFileExists(repoRoot, family.requiredDesignSystemTest)) {
      failures.push(
        `${family.publicComponentName}: missing shared design-system test ${family.requiredDesignSystemTest}.`
      );
    }

    if (!assertFileExists(repoRoot, family.requiredUiTest)) {
      failures.push(
        `${family.publicComponentName}: missing @ku0/ui test ${family.requiredUiTest}.`
      );
    }

    if (
      typeof family.requiredAppCompatTest === "string" &&
      !assertFileExists(repoRoot, family.requiredAppCompatTest)
    ) {
      failures.push(
        `${family.publicComponentName}: missing app compatibility test ${family.requiredAppCompatTest}.`
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system family contract check failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design-system family contract check passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
