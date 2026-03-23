#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRustBuildEnv,
  enforceCargoTargetDirBudget,
  findWorkspaceRoot,
  prepareCargoTargetDirForBuild,
  resolveWorkspaceCargoTargetDir,
} from "../../../scripts/lib/cargo-target-cache.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const workspaceRoot = findWorkspaceRoot(appRoot) ?? resolve(appRoot, "..", "..");

function log(message) {
  process.stdout.write(`[code-tauri] ${message}\n`);
}

function resolveTauriExecutable() {
  const executableName = process.platform === "win32" ? "tauri.cmd" : "tauri";
  const localExecutable = join(appRoot, "node_modules", ".bin", executableName);
  if (existsSync(localExecutable)) {
    return localExecutable;
  }

  const workspaceExecutable = join(workspaceRoot, "node_modules", ".bin", executableName);
  if (existsSync(workspaceExecutable)) {
    return workspaceExecutable;
  }

  return executableName;
}

const rawTauriArgs = process.argv.slice(2);
// `pnpm run <script> -- ...` forwards a literal `--` separator that Tauri should not see.
const tauriArgs =
  rawTauriArgs.length > 1 && rawTauriArgs[1] === "--"
    ? [rawTauriArgs[0], ...rawTauriArgs.slice(2)]
    : rawTauriArgs;
if (tauriArgs.length === 0) {
  process.stderr.write("Usage: node scripts/run-tauri.mjs <tauri-args...>\n");
  process.exit(1);
}
const tauriSubcommand = tauriArgs[0];

const targetDir = resolveWorkspaceCargoTargetDir({
  startDir: appRoot,
  relativeToDir: appRoot,
});
const isLongRunningDevCommand = tauriSubcommand === "dev";
const releaseLock = isLongRunningDevCommand
  ? null
  : prepareCargoTargetDirForBuild({
      startDir: appRoot,
      relativeToDir: appRoot,
      targetDir,
      log,
    }).releaseLock;

if (isLongRunningDevCommand) {
  enforceCargoTargetDirBudget({
    startDir: appRoot,
    relativeToDir: appRoot,
    targetDir,
    log,
  });
}

const { env, sccachePath } = buildRustBuildEnv({
  startDir: appRoot,
  relativeToDir: appRoot,
  targetDir,
});

log(`using cargo target dir: ${targetDir}`);
if (sccachePath) {
  log(`using sccache: ${sccachePath}`);
}

const tauriExecutable = resolveTauriExecutable();
const result = (() => {
  try {
    return spawnSync(tauriExecutable, tauriArgs, {
      cwd: appRoot,
      env,
      stdio: "inherit",
      shell: process.platform === "win32" && tauriExecutable.toLowerCase().endsWith(".cmd"),
    });
  } finally {
    releaseLock?.();
  }
})();

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
