#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnPnpmSync } from "./lib/spawn-pnpm.mjs";

const MODES = new Set(["auto", "fast", "full", "skip"]);
const DIST_INDEX_PATH = path.join(process.cwd(), "apps", "code", "dist", "index.html");

function readArgValue(flag) {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === flag && i + 1 < argv.length) {
      return argv[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

function normalizeMode(value) {
  if (!value) {
    return undefined;
  }
  return value.trim().toLowerCase();
}

function resolveMode() {
  const argMode = normalizeMode(readArgValue("--mode"));
  if (argMode) {
    return argMode;
  }
  const envMode = normalizeMode(process.env.DESKTOP_PREBUILD_MODE);
  if (envMode) {
    return envMode;
  }
  if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
    return "full";
  }
  return "auto";
}

function runTurboBuild({ filter, only, modeLabel }) {
  const args = ["-w", "turbo", "run", "build", "--filter", filter];
  if (only) {
    args.push("--only");
  }
  args.push("--output-logs", process.env.DESKTOP_PREBUILD_OUTPUT_LOGS ?? "new-only");

  const result = spawnPnpmSync(args, {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function ensurePreparedDist() {
  if (fs.existsSync(DIST_INDEX_PATH)) {
    return 0;
  }

  return 1;
}

const mode = resolveMode();
if (!MODES.has(mode)) {
  process.exit(1);
}

if (mode === "skip") {
  process.exit(ensurePreparedDist());
}

if (mode === "full") {
  process.exit(runTurboBuild({ filter: "@ku0/code", only: false, modeLabel: "full" }));
}

if (mode === "fast") {
  process.exit(runTurboBuild({ filter: "@ku0/code", only: true, modeLabel: "fast" }));
}

const fastStatus = runTurboBuild({ filter: "@ku0/code", only: true, modeLabel: "auto-fast" });
if (fastStatus === 0) {
  process.exit(0);
}

process.exit(runTurboBuild({ filter: "@ku0/code", only: false, modeLabel: "auto-full-fallback" }));
