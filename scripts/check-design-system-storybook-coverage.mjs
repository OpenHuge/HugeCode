#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { DESIGN_SYSTEM_FAMILY_CONTRACT_MAP } from "./lib/design-system-family-contract-config.mjs";

const INSPECTION_FAMILY_CONFIG = new Map([
  [
    "Rows",
    {
      exports: ["InlineActionRow", "MetadataList", "MetadataRow"],
      inspectionSurface: "Rows",
    },
  ],
  [
    "Shell",
    {
      exports: ["EmptySurface", "ShellFrame", "ShellSection", "ShellToolbar"],
      inspectionSurface: "Shell",
    },
  ],
]);

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

function collectPromotedComponentNames(publicComponentsText) {
  const names = [];
  const bulletPattern = /^\s*-\s+`(?<name>[A-Z][A-Za-z0-9]+)`\s*$/gmu;

  for (const match of publicComponentsText.matchAll(bulletPattern)) {
    const name = match.groups?.name?.trim();
    if (name) {
      names.push(name);
    }
  }

  return [...new Set(names)].sort((left, right) => left.localeCompare(right));
}

function hasNamedExport(indexSourceText, componentName) {
  const namePattern = escapeRegExp(componentName);
  const exportPattern = new RegExp(`export\\s*\\{[^}]*\\b${namePattern}\\b`, "u");
  return exportPattern.test(indexSourceText);
}

function hasInspectionSurface(repoRoot, componentName) {
  const componentsRoot = path.join(repoRoot, "packages", "ui", "src", "components");
  const candidates = [
    `${componentName}.stories.tsx`,
    `${componentName}.stories.ts`,
    `${componentName}.stories.jsx`,
    `${componentName}.stories.js`,
    `${componentName}.mdx`,
  ];

  return candidates.some((candidate) => fs.existsSync(path.join(componentsRoot, candidate)));
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
  const indexPath = path.join(repoRoot, "packages", "ui", "src", "index.ts");

  const publicComponentsText = readRequiredFile(publicComponentsPath, "Public components doc");
  const indexSourceText = readRequiredFile(indexPath, "@ku0/ui public barrel");
  const promotedComponents = collectPromotedComponentNames(publicComponentsText);
  const failures = [];

  for (const componentName of promotedComponents) {
    const governedFamily = DESIGN_SYSTEM_FAMILY_CONTRACT_MAP.get(componentName);
    const inspectionFamily = governedFamily ??
      INSPECTION_FAMILY_CONFIG.get(componentName) ?? {
        exports: [componentName],
        inspectionSurface: componentName,
      };
    const requiredExports = inspectionFamily.requiredUiExports ?? inspectionFamily.exports;

    const missingExports = requiredExports.filter(
      (exportName) => !hasNamedExport(indexSourceText, exportName)
    );
    if (missingExports.length > 0) {
      failures.push(
        `${componentName}: listed in PublicComponents.mdx but missing @ku0/ui export(s) in packages/ui/src/index.ts: ${missingExports.join(", ")}.`
      );
    }

    if (!hasInspectionSurface(repoRoot, inspectionFamily.inspectionSurface)) {
      failures.push(
        `${componentName}: listed in PublicComponents.mdx but missing Storybook/docs inspection surface in packages/ui/src/components for ${inspectionFamily.inspectionSurface}.`
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write("Design-system Storybook coverage check failed.\n");
    for (const failure of failures) {
      process.stderr.write(`- ${failure}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("Design-system Storybook coverage check passed.\n");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
