#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const ACTIVE_WORKSPACE_TASKS = [
  {
    manifestPath: "apps/code-t3/package.json",
    requiredScripts: ["build", "lint", "test", "typecheck"],
  },
  {
    manifestPath: "packages/design-system/package.json",
    requiredScripts: ["build", "lint", "test", "typecheck"],
  },
  {
    manifestPath: "packages/shared/package.json",
    requiredScripts: ["build", "lint", "test", "typecheck"],
  },
  {
    manifestPath: "packages/ui/package.json",
    requiredScripts: ["build", "lint", "test", "typecheck"],
  },
];

function readPackageJson(relativeManifestPath) {
  const manifestPath = path.join(repoRoot, relativeManifestPath);
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function main() {
  const missingScriptEntries = [];

  for (const entry of ACTIVE_WORKSPACE_TASKS) {
    const manifest = readPackageJson(entry.manifestPath);
    const scripts = manifest.scripts ?? {};
    const missingScripts = entry.requiredScripts.filter((scriptName) => !(scriptName in scripts));

    if (missingScripts.length > 0) {
      missingScriptEntries.push({
        packageName: manifest.name ?? entry.manifestPath,
        manifestPath: entry.manifestPath,
        missingScripts,
      });
    }
  }

  if (missingScriptEntries.length > 0) {
    const summary = missingScriptEntries
      .map(
        (entry) =>
          `${entry.packageName} (${entry.manifestPath}) missing scripts: ${entry.missingScripts.join(", ")}`
      )
      .join("\n");
    throw new Error(`Active workspace task coverage check failed.\n${summary}`);
  }

  process.stdout.write("Active workspace task coverage check passed.\n");
}

main();
