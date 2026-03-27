#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function readBooleanFlag(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

export function shouldPrewarmCodeRuntimeService(env = process.env) {
  return readBooleanFlag(env.CODE_RUNTIME_PREWARM) !== false;
}

export function buildCodeRuntimeServicePrewarmCommand(repoRoot = process.cwd()) {
  return {
    command: process.execPath,
    args: [
      path.join(repoRoot, "scripts", "run-cargo-with-target-guard.mjs"),
      "--cwd",
      "packages/code-runtime-service-rs",
      "build",
      "--manifest-path",
      "Cargo.toml",
    ],
    cwd: repoRoot,
  };
}

export function runCodeRuntimeServicePrewarm({
  repoRoot = process.cwd(),
  env = process.env,
  spawnSyncImpl = spawnSync,
} = {}) {
  if (!shouldPrewarmCodeRuntimeService(env)) {
    process.stdout.write(
      "[prewarm:code-runtime-service] Skipping runtime service prewarm because CODE_RUNTIME_PREWARM is disabled.\n"
    );
    return {
      skipped: true,
      status: 0,
    };
  }

  const command = buildCodeRuntimeServicePrewarmCommand(repoRoot);
  process.stdout.write(
    "[prewarm:code-runtime-service] Building code-runtime-service-rs ahead of desktop or cold-start validation.\n"
  );
  const result = spawnSyncImpl(command.command, command.args, {
    cwd: command.cwd,
    env,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  return {
    skipped: false,
    status: result.status ?? 1,
  };
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  const result = runCodeRuntimeServicePrewarm();
  process.exit(result.status);
}
