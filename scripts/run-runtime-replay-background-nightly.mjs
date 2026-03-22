#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function resolveRuntimeReplayBackgroundNightlyIds(candidateIntakePath) {
  const resolvedPath = path.isAbsolute(candidateIntakePath)
    ? candidateIntakePath
    : path.resolve(process.cwd(), candidateIntakePath);
  const payload = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
  return Array.isArray(payload?.backgroundReadyNightlyIds)
    ? payload.backgroundReadyNightlyIds.filter(
        (entry) => typeof entry === "string" && entry.trim().length > 0
      )
    : [];
}

export function buildRuntimeReplayBackgroundNightlyPlan(ids) {
  const normalizedIds = [...new Set(ids)];
  if (normalizedIds.length === 0) {
    return {
      shouldRun: false,
      message: "No background-ready runtime replay samples were selected for nightly proving.",
      commandArgs: [],
    };
  }

  return {
    shouldRun: true,
    message: `Running nightly runtime replay proving for ${normalizedIds.length} sample(s).`,
    commandArgs: normalizedIds.flatMap((id) => ["--id", id]),
  };
}

function parseArgs(argv) {
  let candidateIntakePath = "artifacts/runtime-replay/candidate-intake.json";
  let extraArgs = [];
  const separatorIndex = argv.indexOf("--");
  const commandArgs = separatorIndex >= 0 ? argv.slice(0, separatorIndex) : argv;
  extraArgs = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : [];

  for (let index = 0; index < commandArgs.length; index += 1) {
    const arg = commandArgs[index];
    const next = commandArgs[index + 1];
    if (arg === "--candidate-intake" && next) {
      candidateIntakePath = next;
      index += 1;
    }
  }

  return {
    candidateIntakePath,
    extraArgs,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const ids = resolveRuntimeReplayBackgroundNightlyIds(options.candidateIntakePath);
  const plan = buildRuntimeReplayBackgroundNightlyPlan(ids);
  process.stdout.write(`${plan.message}\n`);
  if (!plan.shouldRun) {
    return;
  }

  const result = spawnSync(
    process.execPath,
    [
      path.resolve(process.cwd(), "scripts", "run-runtime-core-replay-e2e.mjs"),
      ...plan.commandArgs,
      ...options.extraArgs,
    ],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    }
  );

  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
