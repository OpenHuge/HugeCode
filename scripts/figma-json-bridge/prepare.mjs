#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnPnpmSync } from "../lib/spawn-pnpm.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

export function resolveBridgePaths(baseRoot = repoRoot) {
  return {
    manifestPath: path.join(baseRoot, "scripts", "figma-json-bridge", "manifest.json"),
    figmaCodegenMapPath: path.join(
      baseRoot,
      "scripts",
      "figma-json-bridge",
      "generated",
      "figmaCodegenMap.js"
    ),
  };
}

function formatFailureDetails(result) {
  if (result.signal) {
    return `tokens:build exited from signal ${result.signal}`;
  }

  return `tokens:build exited with status ${result.status ?? "unknown"}`;
}

function collectMissingPrerequisites(paths) {
  const missing = [];

  if (!fs.existsSync(paths.manifestPath)) {
    missing.push(paths.manifestPath);
  }
  if (!fs.existsSync(paths.figmaCodegenMapPath)) {
    missing.push(paths.figmaCodegenMapPath);
  }

  return missing;
}

export function formatPrepareSummary(paths, baseRoot = repoRoot) {
  return [
    "Figma bridge free workflow is prepared.",
    `Manifest: ${path.relative(baseRoot, paths.manifestPath)}`,
    `Generated token map: ${path.relative(baseRoot, paths.figmaCodegenMapPath)}`,
    "Next steps:",
    "1. Run `pnpm -C tools/figma bridge:listen`.",
    "2. Import `scripts/figma-json-bridge/manifest.json` into Figma Desktop.",
    "3. Open `HugeCode Local Figma Bridge` and use `Token And Code Inspector` or export to localhost.",
  ].join("\n");
}

export function runPrepare({
  baseRoot = repoRoot,
  spawnPnpmSyncImpl = spawnPnpmSync,
  stdout = process.stdout,
} = {}) {
  const paths = resolveBridgePaths(baseRoot);
  const result = spawnPnpmSyncImpl(["tokens:build"], {
    cwd: baseRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Failed to refresh token pipeline: ${formatFailureDetails(result)}`);
  }

  const missing = collectMissingPrerequisites(paths);
  if (missing.length > 0) {
    throw new Error(
      `Figma bridge prerequisites are missing after tokens:build:\n${missing.join("\n")}`
    );
  }

  stdout.write(`${formatPrepareSummary(paths, baseRoot)}\n`);
  return paths;
}

try {
  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runPrepare();
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
