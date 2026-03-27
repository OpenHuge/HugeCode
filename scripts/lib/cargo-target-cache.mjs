import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const DEFAULT_TARGET_DIR_RELATIVE = path.join(".cache", "cargo-target");
const DEFAULT_MAX_SIZE_BYTES = 6 * 1024 * BYTES_PER_MEBIBYTE;
const DEFAULT_MIN_FREE_BYTES = 4 * 1024 * BYTES_PER_MEBIBYTE;
const DEFAULT_HARD_MIN_FREE_BYTES = 2 * 1024 * BYTES_PER_MEBIBYTE;
const DEFAULT_SCAN_INTERVAL_MS = 60_000;
const DEFAULT_LOCK_POLL_MS = 250;
const DEFAULT_LOCK_TIMEOUT_MS = 15 * 60_000;
const DEFAULT_LOCK_STALE_AFTER_MS = 6 * 60 * 60_000;
const PRUNABLE_DIRECTORY_NAMES = new Set(["incremental"]);
const LOCK_METADATA_FILE_NAME = "owner.json";

function parseNonNegativeInteger(rawValue, envName) {
  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${envName} must be a non-negative integer, received: ${rawValue}`);
  }
  return value;
}

function readByteEnv(env, envName) {
  const rawValue = env[envName]?.trim();
  if (!rawValue) {
    return undefined;
  }
  return parseNonNegativeInteger(rawValue, envName) * BYTES_PER_MEBIBYTE;
}

function readMsEnv(env, envName) {
  const rawValue = env[envName]?.trim();
  if (!rawValue) {
    return undefined;
  }
  return parseNonNegativeInteger(rawValue, envName);
}

function resolveGuardConfig(env) {
  return {
    maxSizeBytes: readByteEnv(env, "HYPECODE_CARGO_TARGET_MAX_SIZE_MB") ?? DEFAULT_MAX_SIZE_BYTES,
    minFreeBytes: readByteEnv(env, "HYPECODE_CARGO_TARGET_MIN_FREE_MB") ?? DEFAULT_MIN_FREE_BYTES,
    hardMinFreeBytes:
      readByteEnv(env, "HYPECODE_CARGO_TARGET_HARD_MIN_FREE_MB") ?? DEFAULT_HARD_MIN_FREE_BYTES,
    scanIntervalMs:
      readMsEnv(env, "HYPECODE_CARGO_TARGET_SCAN_INTERVAL_MS") ?? DEFAULT_SCAN_INTERVAL_MS,
  };
}

function formatBytes(bytes) {
  if (bytes < BYTES_PER_MEBIBYTE) {
    return `${bytes} B`;
  }

  const gibibyte = BYTES_PER_MEBIBYTE * 1024;
  if (bytes >= gibibyte) {
    return `${(bytes / gibibyte).toFixed(1)} GiB`;
  }
  return `${(bytes / BYTES_PER_MEBIBYTE).toFixed(1)} MiB`;
}

export function findSccacheBinary(env = process.env) {
  const configuredWrapper = env.RUSTC_WRAPPER?.trim();
  if (configuredWrapper) {
    return configuredWrapper;
  }

  const locatorCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locatorCommand, ["sccache"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }

  const firstPath = result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstPath ?? null;
}

export function findWorkspaceRoot(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (
      existsSync(path.join(currentDir, "pnpm-workspace.yaml")) ||
      existsSync(path.join(currentDir, ".git"))
    ) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

export function resolveWorkspaceCargoTargetDir({
  startDir = process.cwd(),
  relativeToDir = startDir,
  env = process.env,
} = {}) {
  const configuredTargetDir = env.CARGO_TARGET_DIR?.trim();
  if (configuredTargetDir) {
    return path.isAbsolute(configuredTargetDir)
      ? configuredTargetDir
      : path.resolve(relativeToDir, configuredTargetDir);
  }

  const workspaceRoot = findWorkspaceRoot(startDir) ?? path.resolve(startDir);
  return path.join(workspaceRoot, DEFAULT_TARGET_DIR_RELATIVE);
}

function resolveGuardStatePath(targetDir) {
  const targetDirParent = path.dirname(targetDir);
  const targetDirBaseName = path.basename(targetDir);
  return path.join(targetDirParent, `${targetDirBaseName}-guard.json`);
}

function resolveGuardLockPath(targetDir) {
  const targetDirParent = path.dirname(targetDir);
  const targetDirBaseName = path.basename(targetDir);
  return path.join(targetDirParent, `${targetDirBaseName}.lock`);
}

function readGuardState(statePath) {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function writeGuardState(statePath, payload) {
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(payload, null, 2), "utf8");
}

function resolveExistingPath(candidatePath) {
  let currentPath = path.resolve(candidatePath);
  while (!existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return process.cwd();
    }
    currentPath = parentPath;
  }
  return currentPath;
}

function sleepSync(durationMs) {
  if (!(Number.isFinite(durationMs) && durationMs > 0)) {
    return;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") {
      return false;
    }
    return true;
  }
}

function readLockMetadata(lockPath) {
  try {
    return JSON.parse(readFileSync(path.join(lockPath, LOCK_METADATA_FILE_NAME), "utf8"));
  } catch {
    return null;
  }
}

function isStaleLock(lockPath, now, staleAfterMs) {
  const metadata = readLockMetadata(lockPath);
  if (
    metadata &&
    typeof metadata === "object" &&
    Number.isInteger(metadata.pid) &&
    metadata.pid > 0
  ) {
    if (!isProcessAlive(metadata.pid)) {
      return true;
    }
    if (
      Number.isFinite(metadata.acquiredAtMs) &&
      now - Number(metadata.acquiredAtMs) <= staleAfterMs
    ) {
      return false;
    }
  }

  try {
    const stats = lstatSync(lockPath);
    return now - stats.mtimeMs > staleAfterMs;
  } catch {
    return true;
  }
}

export function acquireCargoTargetGuardLock({
  targetDir,
  log = () => {},
  timeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  pollMs = DEFAULT_LOCK_POLL_MS,
  staleAfterMs = DEFAULT_LOCK_STALE_AFTER_MS,
  now = Date.now,
} = {}) {
  if (!targetDir) {
    throw new Error("targetDir is required to acquire the cargo target guard lock");
  }

  const lockPath = resolveGuardLockPath(targetDir);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const startMs = now();
  let reportedWait = false;

  function waitForActiveLockOrThrow(currentTimeMs) {
    if (isStaleLock(lockPath, currentTimeMs, staleAfterMs)) {
      rmSync(lockPath, { recursive: true, force: true });
      return;
    }

    if (currentTimeMs - startMs >= timeoutMs) {
      throw new Error(
        `Timed out waiting for cargo target guard lock at ${lockPath} after ${timeoutMs}ms`
      );
    }

    if (!reportedWait) {
      log(`waiting for cargo target guard lock at ${lockPath}`);
      reportedWait = true;
    }
    sleepSync(pollMs);
  }

  while (true) {
    try {
      mkdirSync(lockPath);
      try {
        writeFileSync(
          path.join(lockPath, LOCK_METADATA_FILE_NAME),
          JSON.stringify(
            {
              pid: process.pid,
              acquiredAtMs: now(),
              targetDir,
            },
            null,
            2
          ),
          "utf8"
        );
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          if (existsSync(lockPath)) {
            waitForActiveLockOrThrow(now());
          }
          continue;
        }
        throw error;
      }

      const releaseLock = () => {
        try {
          rmSync(lockPath, { recursive: true, force: true });
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return;
          }
          throw error;
        }
      };
      releaseLock.waitedForLock = reportedWait;
      return releaseLock;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }

      const currentTimeMs = now();
      waitForActiveLockOrThrow(currentTimeMs);
    }
  }
}

export function prepareCargoTargetDirForBuild({
  startDir = process.cwd(),
  relativeToDir = startDir,
  env = process.env,
  targetDir = resolveWorkspaceCargoTargetDir({ startDir, relativeToDir, env }),
  log = () => {},
} = {}) {
  const releaseLock = acquireCargoTargetGuardLock({
    targetDir,
    log,
  });
  const waitedForLock = releaseLock.waitedForLock === true;

  if (waitedForLock) {
    log(`reusing warm cargo target dir after waiting on guard lock: ${targetDir}`);
  } else {
    enforceCargoTargetDirBudget({
      startDir,
      relativeToDir,
      env,
      targetDir,
      log,
    });
  }

  return {
    releaseLock,
    targetDir,
    waitedForLock,
  };
}

function readAvailableBytes(targetDir) {
  const stats = statfsSync(resolveExistingPath(targetDir));
  const blockSize = Number(stats.bsize || stats.frsize || 0);
  const availableBlocks = Number(stats.bavail || stats.bfree || 0);
  return blockSize * availableBlocks;
}

function readDirectoryEntries(directoryPath) {
  try {
    return readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return [];
    }
    throw error;
  }
}

function measureDirectorySizeBytes(rootDir) {
  if (!existsSync(rootDir)) {
    return 0;
  }

  let totalBytes = 0;
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    for (const entry of readDirectoryEntries(currentDir)) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      try {
        totalBytes += lstatSync(absolutePath).size;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          continue;
        }
        throw error;
      }
    }
  }

  return totalBytes;
}

function collectPrunableDirectories(rootDir) {
  if (!existsSync(rootDir)) {
    return [];
  }

  const matches = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) {
      continue;
    }

    for (const entry of readDirectoryEntries(currentDir)) {
      if (!entry.isDirectory()) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      if (PRUNABLE_DIRECTORY_NAMES.has(entry.name)) {
        matches.push(absolutePath);
        continue;
      }

      stack.push(absolutePath);
    }
  }

  return matches.sort((left, right) => right.length - left.length);
}

function removeDirectories(directoryPaths) {
  for (const directoryPath of directoryPaths) {
    rmSync(directoryPath, { recursive: true, force: true });
  }
}

function buildReason({ overSizeBudget, belowFreeBudget }) {
  if (overSizeBudget && belowFreeBudget) {
    return "size and free-space budget exceeded";
  }
  if (overSizeBudget) {
    return "size budget exceeded";
  }
  return "free-space budget exceeded";
}

export function enforceCargoTargetDirBudget({
  startDir = process.cwd(),
  relativeToDir = startDir,
  env = process.env,
  targetDir = resolveWorkspaceCargoTargetDir({ startDir, relativeToDir, env }),
  log = () => {},
  now = Date.now(),
  maxSizeBytes,
  minFreeBytes,
  hardMinFreeBytes,
  scanIntervalMs,
} = {}) {
  if (env.HYPECODE_CARGO_TARGET_GUARD?.trim() === "0") {
    return {
      action: "disabled",
      targetDir,
      sizeBytes: existsSync(targetDir) ? measureDirectorySizeBytes(targetDir) : 0,
      freeBytes: readAvailableBytes(targetDir),
    };
  }

  const config = resolveGuardConfig(env);
  const effectiveMaxSizeBytes = maxSizeBytes ?? config.maxSizeBytes;
  const effectiveMinFreeBytes = minFreeBytes ?? config.minFreeBytes;
  const effectiveHardMinFreeBytes = hardMinFreeBytes ?? config.hardMinFreeBytes;
  const effectiveScanIntervalMs = scanIntervalMs ?? config.scanIntervalMs;
  const statePath = resolveGuardStatePath(targetDir);
  const previousState = readGuardState(statePath);
  const freeBytesBefore = readAvailableBytes(targetDir);
  const needsFreshScan =
    !previousState ||
    typeof previousState.checkedAtMs !== "number" ||
    typeof previousState.sizeBytes !== "number" ||
    now - previousState.checkedAtMs >= effectiveScanIntervalMs ||
    freeBytesBefore < effectiveMinFreeBytes;

  let sizeBytes = needsFreshScan ? measureDirectorySizeBytes(targetDir) : previousState.sizeBytes;
  let freeBytes = freeBytesBefore;
  const overSizeBudget = sizeBytes > effectiveMaxSizeBytes;
  const belowFreeBudget = freeBytes < effectiveMinFreeBytes;
  let action = "none";

  if (overSizeBudget || belowFreeBudget) {
    const prunableDirectories = collectPrunableDirectories(targetDir);
    if (prunableDirectories.length > 0) {
      removeDirectories(prunableDirectories);
      sizeBytes = measureDirectorySizeBytes(targetDir);
      freeBytes = readAvailableBytes(targetDir);
      action = "pruned-incremental";
      log(
        `pruned incremental cargo artifacts at ${targetDir} (${buildReason({
          overSizeBudget,
          belowFreeBudget,
        })})`
      );
    }

    if (sizeBytes > effectiveMaxSizeBytes || freeBytes < effectiveMinFreeBytes) {
      rmSync(targetDir, { recursive: true, force: true });
      mkdirSync(targetDir, { recursive: true });
      sizeBytes = 0;
      freeBytes = readAvailableBytes(targetDir);
      action = "cleaned-all";
      log(
        `cleared cargo target cache at ${targetDir} (${buildReason({
          overSizeBudget: sizeBytes > effectiveMaxSizeBytes || overSizeBudget,
          belowFreeBudget: freeBytes < effectiveMinFreeBytes || belowFreeBudget,
        })})`
      );
    }
  }

  writeGuardState(statePath, {
    checkedAtMs: now,
    sizeBytes,
    freeBytes,
    action,
  });

  if (freeBytes < effectiveHardMinFreeBytes) {
    throw new Error(
      `cargo target guard aborted build: ${formatBytes(freeBytes)} free on ${targetDir}, below hard minimum ${formatBytes(effectiveHardMinFreeBytes)}`
    );
  }

  return {
    action,
    targetDir,
    sizeBytes,
    freeBytes,
  };
}

export function buildRustBuildEnv({
  startDir = process.cwd(),
  relativeToDir = startDir,
  env = process.env,
  targetDir = resolveWorkspaceCargoTargetDir({ startDir, relativeToDir, env }),
  preferIncremental = true,
  preferSccache = true,
} = {}) {
  const nextEnv = {
    ...env,
    CARGO_TARGET_DIR: targetDir,
  };

  if (preferIncremental && !nextEnv.CARGO_INCREMENTAL?.trim()) {
    nextEnv.CARGO_INCREMENTAL = "1";
  }

  let sccachePath = null;
  if (preferSccache) {
    sccachePath = findSccacheBinary(nextEnv);
    if (sccachePath && !nextEnv.RUSTC_WRAPPER?.trim()) {
      nextEnv.RUSTC_WRAPPER = sccachePath;
    }
  }

  return {
    env: nextEnv,
    targetDir,
    sccachePath,
  };
}
