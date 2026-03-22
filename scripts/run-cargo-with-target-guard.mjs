#!/usr/bin/env node

import process from "node:process";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildRustBuildEnv,
  prepareCargoTargetDirForBuild,
  resolveWorkspaceCargoTargetDir,
} from "./lib/cargo-target-cache.mjs";

function resolveCargoCommand() {
  return process.platform === "win32" ? "cargo.exe" : "cargo";
}

function parseCliArguments(argv) {
  const args = [...argv];
  let cwd = process.cwd();

  while (args.length > 0) {
    const current = args[0];
    if (current === "--cwd") {
      const value = args[1];
      if (!value) {
        throw new Error("--cwd requires a value");
      }
      cwd = resolve(process.cwd(), value);
      args.splice(0, 2);
      continue;
    }
    if (current.startsWith("--cwd=")) {
      cwd = resolve(process.cwd(), current.slice("--cwd=".length));
      args.shift();
      continue;
    }
    break;
  }

  return {
    cwd,
    cargoArgs: args,
  };
}

function log(message) {
  process.stdout.write(`[cargo-guard] ${message}\n`);
}

const { cwd, cargoArgs } = parseCliArguments(process.argv.slice(2));
if (cargoArgs.length === 0) {
  process.stderr.write(
    "Usage: node scripts/run-cargo-with-target-guard.mjs [--cwd <dir>] <cargo-args...>\n"
  );
  process.exit(1);
}

const targetDir = resolveWorkspaceCargoTargetDir({
  startDir: cwd,
  relativeToDir: cwd,
});
const { releaseLock } = prepareCargoTargetDirForBuild({
  startDir: cwd,
  relativeToDir: cwd,
  targetDir,
  log,
});

try {
  const { env, sccachePath } = buildRustBuildEnv({
    startDir: cwd,
    relativeToDir: cwd,
    targetDir,
  });

  log(`using cargo target dir: ${targetDir}`);
  if (sccachePath) {
    log(`using sccache: ${sccachePath}`);
  }

  const result = spawnSync(resolveCargoCommand(), cargoArgs, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: false,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
} finally {
  releaseLock();
}
