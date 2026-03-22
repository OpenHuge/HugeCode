#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildRustBuildEnv,
  prepareCargoTargetDirForBuild,
} from "../../../scripts/lib/cargo-target-cache.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = resolve(PACKAGE_ROOT, "Cargo.toml");
const BINARY_BASENAME = "code-runtime-service-rs";
const DEV_RUNNER_DIRNAME = "dev-runner";
const WINDOWS_BINARY_NAME = `${BINARY_BASENAME}.exe`;
const WINDOWS_PDB_NAME = `${BINARY_BASENAME}.pdb`;
const CHILD_SHUTDOWN_GRACE_MS = 2_000;

loadWorkspaceEnvLocal();

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
  const separatorIndex = withoutExport.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = withoutExport.slice(0, separatorIndex).trim();
  const rawValue = withoutExport.slice(separatorIndex + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
    return null;
  }

  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return {
      key,
      value: rawValue.slice(1, -1),
    };
  }

  return {
    key,
    value: rawValue,
  };
}

function loadWorkspaceEnvLocal() {
  const envPath = resolve(PACKAGE_ROOT, "../../.env.local");
  if (!existsSync(envPath)) {
    return false;
  }

  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
    return true;
  }

  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }

  return true;
}

function resolveCargoTargetDir() {
  const configuredTargetDir = process.env.CARGO_TARGET_DIR?.trim();
  if (configuredTargetDir) {
    return isAbsolute(configuredTargetDir)
      ? configuredTargetDir
      : resolve(PACKAGE_ROOT, configuredTargetDir);
  }

  const metadata = spawnSync(
    "cargo",
    ["metadata", "--manifest-path", MANIFEST_PATH, "--format-version", "1", "--no-deps"],
    {
      cwd: PACKAGE_ROOT,
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      windowsHide: false,
    }
  );
  if (metadata.status !== 0) {
    process.exit(metadata.status ?? 1);
  }

  const payload = JSON.parse(metadata.stdout);
  if (
    typeof payload?.target_directory !== "string" ||
    payload.target_directory.trim().length === 0
  ) {
    throw new Error("cargo metadata did not return a target directory.");
  }
  return payload.target_directory;
}

function runCargo(args) {
  const targetDir = resolveCargoTargetDir();
  const log = (message) => {
    process.stdout.write(`[runtime-service] ${message}\n`);
  };
  const { releaseLock } = prepareCargoTargetDirForBuild({
    startDir: PACKAGE_ROOT,
    relativeToDir: PACKAGE_ROOT,
    targetDir,
    log,
  });
  try {
    const { env, sccachePath } = buildRustBuildEnv({
      startDir: PACKAGE_ROOT,
      relativeToDir: PACKAGE_ROOT,
      targetDir,
    });
    if (sccachePath) {
      process.stdout.write(`[runtime-service] using sccache: ${sccachePath}\n`);
    }
    const result = spawnSync("cargo", args, {
      cwd: PACKAGE_ROOT,
      env,
      stdio: "inherit",
      windowsHide: false,
    });
    return {
      status: result.status ?? 1,
      targetDir,
    };
  } finally {
    releaseLock();
  }
}

function resolveRuntimeBinaryPath(targetDir) {
  return join(
    targetDir,
    "debug",
    process.platform === "win32" ? WINDOWS_BINARY_NAME : BINARY_BASENAME
  );
}

function terminateChild(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill(signal);
  setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    child.kill("SIGKILL");
  }, CHILD_SHUTDOWN_GRACE_MS).unref();
}

async function removeIfExists(filePath) {
  await rm(filePath, { force: true }).catch(() => {});
}

async function runWindowsDev() {
  const { status: buildExitCode, targetDir } = runCargo([
    "build",
    "--manifest-path",
    MANIFEST_PATH,
  ]);
  if (buildExitCode !== 0) {
    process.exit(buildExitCode);
  }

  const sourceBinaryPath = join(targetDir, "debug", WINDOWS_BINARY_NAME);
  const sourcePdbPath = join(targetDir, "debug", WINDOWS_PDB_NAME);
  const runnerDir = join(targetDir, DEV_RUNNER_DIRNAME);
  const runnerSuffix = `${Date.now()}-${process.pid}`;
  const runnerBinaryPath = join(runnerDir, `${BINARY_BASENAME}-${runnerSuffix}.exe`);
  const runnerPdbPath = join(runnerDir, `${BINARY_BASENAME}-${runnerSuffix}.pdb`);

  await mkdir(runnerDir, { recursive: true });
  await copyFile(sourceBinaryPath, runnerBinaryPath);
  if (existsSync(sourcePdbPath)) {
    await copyFile(sourcePdbPath, runnerPdbPath);
  }

  const child = spawn(runnerBinaryPath, process.argv.slice(2), {
    cwd: PACKAGE_ROOT,
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });

  const cleanup = async () => {
    await Promise.all([removeIfExists(runnerBinaryPath), removeIfExists(runnerPdbPath)]);
  };

  const signalHandler = (signal) => {
    terminateChild(child, signal);
  };

  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);
  process.on("SIGHUP", signalHandler);

  child.on("error", async () => {
    await cleanup();
    process.exit(1);
  });

  child.on("exit", async (code, signal) => {
    process.off("SIGINT", signalHandler);
    process.off("SIGTERM", signalHandler);
    process.off("SIGHUP", signalHandler);
    await cleanup();
    if (typeof code === "number") {
      process.exit(code);
    }
    process.exit(signal ? 1 : 0);
  });
}

function runDefaultDev() {
  const forwardedArgs = process.argv.slice(2);
  const { status: buildExitCode, targetDir } = runCargo([
    "build",
    "--manifest-path",
    MANIFEST_PATH,
  ]);
  if (buildExitCode !== 0) {
    process.exit(buildExitCode);
  }

  const child = spawn(resolveRuntimeBinaryPath(targetDir), forwardedArgs, {
    cwd: PACKAGE_ROOT,
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("error", () => {
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (typeof code === "number") {
      process.exit(code);
    }
    process.exit(signal ? 1 : 0);
  });
}

if (process.platform === "win32") {
  await runWindowsDev();
} else {
  runDefaultDev();
}
