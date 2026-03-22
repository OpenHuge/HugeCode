#!/usr/bin/env node

import process from "node:process";
import { spawnPnpmSync } from "./lib/spawn-pnpm.mjs";

function runPnpm(args, label) {
  process.stdout.write(`==> ${label}\n`);
  const result = spawnPnpmSync(args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  const exitCode = result.status ?? 1;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

runPnpm(["check:app-circular"], "App circular dependency guard");
