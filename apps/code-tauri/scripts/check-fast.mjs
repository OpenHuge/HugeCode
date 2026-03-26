#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acquireCargoTargetGuardLock,
  buildRustBuildEnv,
  enforceCargoTargetDirBudget,
  resolveWorkspaceCargoTargetDir,
} from "../../../scripts/lib/cargo-target-cache.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = join(scriptDir, "..");
const rustRoot = join(appRoot, "src-tauri");
const cacheDir = join(appRoot, ".cache");
const cacheFile = join(cacheDir, "check-fast-cache.json");
const workspaceRoot = join(appRoot, "..", "..");

const trackedConfig = ["Cargo.toml", "Cargo.lock", "tauri.conf.json", "build.rs"];

function normalizeGitPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function log(message) {
  process.stdout.write(`[code-tauri check] ${message}\n`);
}

function runGit(args, { cwd = workspaceRoot, allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  });

  if (result.status !== 0 && !allowFailure) {
    const rendered = result.stderr?.trim() || `git ${args.join(" ")} failed`;
    throw new Error(rendered);
  }

  return result;
}

function resolveDiffArgs(baseRef, headRef) {
  const candidates = [
    ["diff", "--name-only", `${baseRef}...${headRef}`],
    ["diff", "--name-only", baseRef, headRef],
  ];

  for (const candidate of candidates) {
    const result = runGit(candidate, { allowFailure: true });
    if (result.status === 0) {
      return candidate.slice(2);
    }
  }

  throw new Error(`Unable to diff ${baseRef} against ${headRef}`);
}

function hasRustInputChangesBetweenRefs(baseRef, headRef) {
  const diffArgs = resolveDiffArgs(baseRef, headRef);
  const changedFiles = runGit(["diff", "--name-only", ...diffArgs])
    .stdout.split("\n")
    .map((file) => normalizeGitPath(file.trim()))
    .filter(Boolean);

  const rustRootRelative = normalizeGitPath(relative(workspaceRoot, rustRoot));
  return changedFiles.some(
    (file) => file === rustRootRelative || file.startsWith(`${rustRootRelative}/`)
  );
}

async function listRustFiles(root) {
  const files = [];
  await scanRustFiles(root, files);

  files.sort();
  return files;
}

async function scanRustFiles(dir, files) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name)) {
        await scanRustFiles(absolute, files);
      }
      continue;
    }
    if (entry.isFile() && shouldTrackFile(entry.name, absolute)) {
      files.push(absolute);
    }
  }
}

function shouldSkipDirectory(name) {
  return name === "target" || name === ".git";
}

function shouldTrackFile(name, absolutePath) {
  return name.endsWith(".rs") || trackedConfig.includes(relative(rustRoot, absolutePath));
}

async function hashFiles(files) {
  const hash = createHash("sha256");
  for (const filePath of files) {
    const content = await readFile(filePath);
    hash.update(relative(rustRoot, filePath));
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function resolveRustcVersion() {
  const output = spawnSync("rustc", ["-V"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (output.status !== 0) {
    return "unknown";
  }
  return output.stdout.trim();
}

async function readCache() {
  try {
    const raw = await readFile(cacheFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeCache(cache) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf8");
}

function isCacheCurrent(cache, { signature, rustcVersion, targetDir }) {
  return Boolean(
    cache &&
    cache.signature === signature &&
    cache.rustcVersion === rustcVersion &&
    cache.targetDir === targetDir
  );
}

function resolveTargetDir() {
  return resolveWorkspaceCargoTargetDir({
    startDir: workspaceRoot,
    relativeToDir: workspaceRoot,
  });
}

async function main() {
  const force = process.env.CODE_TAURI_CHECK_FORCE === "1";
  const baseRef = process.env.CODE_TAURI_CHECK_BASE_REF?.trim();
  const headRef = process.env.CODE_TAURI_CHECK_HEAD_REF?.trim() || "HEAD";
  const rustcVersion = resolveRustcVersion();
  const targetDir = resolveTargetDir();

  if (!force && baseRef && !hasRustInputChangesBetweenRefs(baseRef, headRef)) {
    log(`no Rust source/config change detected from ${baseRef} to ${headRef}, skip cargo check`);
    return;
  }

  const files = await listRustFiles(rustRoot);
  const signature = await hashFiles(files);

  if (!force) {
    const cache = await readCache();
    if (isCacheCurrent(cache, { signature, rustcVersion, targetDir })) {
      log(
        `no Rust source/config change detected, skip cargo check (set CODE_TAURI_CHECK_FORCE=1 to force)`
      );
      return;
    }
  }

  const releaseLock = acquireCargoTargetGuardLock({
    targetDir,
    log,
  });
  const waitedForLock = releaseLock.waitedForLock === true;

  try {
    if (!force && waitedForLock) {
      const cache = await readCache();
      if (isCacheCurrent(cache, { signature, rustcVersion, targetDir })) {
        log(`another process already checked the current Rust inputs, skip duplicate cargo check`);
        return;
      }
      log(`reusing warm cargo target dir after waiting on guard lock: ${targetDir}`);
    } else {
      enforceCargoTargetDirBudget({
        startDir: workspaceRoot,
        relativeToDir: workspaceRoot,
        targetDir,
        log,
      });
    }

    const { env, sccachePath } = buildRustBuildEnv({
      startDir: workspaceRoot,
      relativeToDir: workspaceRoot,
      targetDir,
    });
    env.CARGO_BUILD_JOBS = env.CARGO_BUILD_JOBS || String(Math.max(1, cpus().length - 1));

    log(`target dir: ${env.CARGO_TARGET_DIR}`);
    if (sccachePath) {
      log(`using sccache: ${sccachePath}`);
    }

    const startedAt = Date.now();
    const result = spawnSync(
      "cargo",
      ["check", "--manifest-path", "src-tauri/Cargo.toml", "-p", "code-tauri"],
      {
        cwd: appRoot,
        env,
        stdio: "inherit",
        shell: process.platform === "win32",
        windowsHide: true,
      }
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    const elapsedMs = Date.now() - startedAt;
    await writeCache({
      signature,
      rustcVersion,
      targetDir,
      checkedAt: new Date().toISOString(),
      elapsedMs,
    });

    log(`completed in ${(elapsedMs / 1000).toFixed(2)}s`);
  } finally {
    releaseLock();
  }
}

const targetDirStatsPath = resolveTargetDir();
try {
  await stat(targetDirStatsPath);
} catch {
  await mkdir(targetDirStatsPath, { recursive: true });
}

await main();
