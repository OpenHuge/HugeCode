#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cargoGuardScript = resolve(scriptDir, "../../../scripts/run-cargo-with-target-guard.mjs");
const packageDir = resolve(scriptDir, "..");
const forwardedArgs = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  [cargoGuardScript, "test", "--manifest-path", "Cargo.toml", ...forwardedArgs],
  {
    cwd: packageDir,
    env: {
      ...process.env,
      RUST_MIN_STACK: process.env.RUST_MIN_STACK ?? "16777216",
    },
    stdio: "inherit",
    windowsHide: false,
  }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
