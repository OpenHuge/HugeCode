#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";
import { loadE2EMapConfig, recommendE2ECategoriesFromPaths } from "./lib/e2e-map.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

const e2eConfig = loadE2EMapConfig();
const DEFAULT_CATEGORIES = e2eConfig.categories;

const maxRoundsRaw = Number.parseInt(process.env.CORE_E2E_MAX_ROUNDS ?? "0", 10);
const maxRounds =
  Number.isNaN(maxRoundsRaw) || maxRoundsRaw <= 0 ? Number.POSITIVE_INFINITY : maxRoundsRaw;
const basePortRaw = Number.parseInt(process.env.CORE_E2E_BASE_PORT ?? "5200", 10);
const basePort = Number.isNaN(basePortRaw) || basePortRaw <= 0 ? 5200 : basePortRaw;
const maxParallelRaw = Number.parseInt(process.env.CORE_E2E_MAX_PARALLEL ?? "1", 10);
const maxParallel = Number.isNaN(maxParallelRaw) || maxParallelRaw <= 0 ? 1 : maxParallelRaw;
const rerunFailedOnlyRaw = (process.env.CORE_E2E_RERUN_FAILED_ONLY ?? "1").trim().toLowerCase();
const rerunFailedOnly = rerunFailedOnlyRaw !== "0" && rerunFailedOnlyRaw !== "false";
const changedOnlyEnvRaw = (process.env.CORE_E2E_CHANGED_ONLY ?? "0").trim().toLowerCase();

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    stdio: "inherit",
    ...options,
  });
}

function read(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readOrEmpty(command, commandArgs) {
  try {
    return read(command, commandArgs);
  } catch {
    return "";
  }
}

function parseCliSelection(rawArgs) {
  const explicitCategories = [];
  let changedOnly = changedOnlyEnvRaw === "1" || changedOnlyEnvRaw === "true";

  for (const rawArg of rawArgs) {
    const normalized = rawArg.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (normalized === "--changed") {
      changedOnly = true;
      continue;
    }
    explicitCategories.push(normalized);
  }

  return {
    explicitCategories,
    changedOnly,
  };
}

function collectChangedFiles() {
  const tracked = readOrEmpty("git", [
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "--relative",
    "HEAD",
  ])
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const untracked = readOrEmpty("git", ["ls-files", "--others", "--exclude-standard"])
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

function shouldSkipAutoDetectionPath(filePath) {
  if (filePath.startsWith("tests/e2e/")) {
    return true;
  }
  if (filePath.startsWith("docs/")) {
    return true;
  }
  if (filePath.startsWith(".playwright-cli/")) {
    return true;
  }
  return filePath.endsWith(".md") || filePath.endsWith(".mdx");
}

function resolveBaseCategories({ explicitCategories, changedOnly }) {
  if (explicitCategories.length > 0) {
    return explicitCategories;
  }

  if (!changedOnly) {
    return DEFAULT_CATEGORIES;
  }

  const changedFiles = collectChangedFiles();
  if (changedFiles.length === 0) {
    return [];
  }

  const recommended = recommendE2ECategoriesFromPaths(changedFiles, {
    config: e2eConfig,
    skipPath: shouldSkipAutoDetectionPath,
  });

  if (recommended.length === 0) {
    return [];
  }

  return recommended;
}

function validateCategories(categories) {
  const knownCategories = new Set(DEFAULT_CATEGORIES);
  const unknownCategories = categories.filter((category) => !knownCategories.has(category));
  if (unknownCategories.length > 0) {
    process.exit(1);
  }
}

function freePort(port) {
  try {
    const output = read("lsof", ["-ti", `tcp:${port}`]);
    if (!output) {
      return;
    }
    const pids = output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (pids.length === 0) {
      return;
    }

    run("kill", ["-9", ...pids]);
  } catch {
    // Ignore lookup failures if lsof is unavailable or no process is bound.
  }
}

function isWorktreeClean() {
  try {
    return read("git", ["status", "--porcelain"]).length === 0;
  } catch {
    return false;
  }
}

function syncCode(round) {
  run("git", ["fetch", "--prune", "origin"]);

  let upstream = "";
  try {
    upstream = read("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  } catch {
    return;
  }

  let ahead = 0;
  let behind = 0;
  try {
    const diff = read("git", ["rev-list", "--left-right", "--count", `HEAD...${upstream}`]);
    const [aheadRaw, behindRaw] = diff.split(/\s+/u);
    ahead = Number.parseInt(aheadRaw ?? "0", 10) || 0;
    behind = Number.parseInt(behindRaw ?? "0", 10) || 0;
  } catch {
    return;
  }

  if (behind === 0) {
    return;
  }

  if (!isWorktreeClean()) {
    return;
  }

  const pulled = run("git", ["pull", "--rebase", "--autostash"]);
  if ((pulled.status ?? 1) !== 0) {
    throw new Error("git pull --rebase --autostash failed");
  }
}

function runCategory(round, category, port) {
  return new Promise((resolve) => {
    freePort(port);

    const child = spawnPnpm([`test:e2e:${category}`], {
      stdio: "inherit",
      env: {
        ...process.env,
        CI: "1",
        WEB_E2E_PORT: String(port),
      },
    });

    child.on("error", () => {
      resolve({ category, exitCode: 1 });
    });

    child.on("exit", (code, signal) => {
      const exitCode = typeof code === "number" ? code : signal ? 1 : 0;
      resolve({ category, exitCode });
    });
  });
}

async function runWithConcurrency(items, concurrency, handler) {
  if (items.length === 0) {
    return [];
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await handler(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runCoreE2E(round, roundCategories) {
  const results = await runWithConcurrency(roundCategories, maxParallel, (category, index) => {
    const port = basePort + round * 100 + index;
    return runCategory(round, category, port);
  });

  const failed = results.filter((result) => result.exitCode !== 0).map((result) => result.category);
  return failed;
}

async function main() {
  const { explicitCategories, changedOnly } = parseCliSelection(process.argv.slice(2));
  const baseCategories = resolveBaseCategories({ explicitCategories, changedOnly });
  if (baseCategories.length === 0) {
    process.exit(0);
  }

  validateCategories(baseCategories);
  let previousFailed = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    try {
      syncCode(round);
    } catch {
      process.exit(1);
    }

    const roundCategories =
      round > 1 && rerunFailedOnly && previousFailed.length > 0 ? previousFailed : baseCategories;
    const failed = await runCoreE2E(round, roundCategories);

    if (failed.length === 0) {
      process.exit(0);
    }

    previousFailed = failed;
  }

  if (Number.isFinite(maxRounds)) {
  } else {
  }
  process.exit(1);
}

await main();
