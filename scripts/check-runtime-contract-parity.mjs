#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { spawnPnpmSync } from "./lib/spawn-pnpm.mjs";

/**
 * Keep the runtime contract gate focused on the highest-risk cross-language links:
 * frozen spec, TS contract tests, Rust runtime parity, Tauri parity, and the web client adapter.
 */
const steps = [
  {
    label: "Runtime contract freeze + source-of-truth",
    command: "pnpm",
    args: ["check:runtime-contract"],
  },
  {
    label: "Code runtime host contract tests",
    command: "pnpm",
    args: ["--filter", "@ku0/code-runtime-host-contract", "test"],
  },
  {
    label: "Native runtime host contract tests",
    command: "pnpm",
    args: ["--filter", "@ku0/native-runtime-host-contract", "test"],
  },
  {
    label: "Rust runtime capabilities parity",
    command: "pnpm",
    args: [
      "--filter",
      "@ku0/code-runtime-service-rs",
      "exec",
      "cargo",
      "test",
      "--manifest-path",
      "Cargo.toml",
      "lib_tests::rpc_capabilities_returns_method_catalog",
      "--",
      "--exact",
    ],
  },
  {
    label: "Tauri runtime capabilities parity",
    command: "cargo",
    args: [
      "test",
      "--manifest-path",
      "apps/code-tauri/src-tauri/Cargo.toml",
      "tests::rpc_capabilities_payload_matches_frozen_spec_and_gap_allowlist",
      "--",
      "--exact",
    ],
  },
  {
    label: "Code runtime host contract build",
    command: "pnpm",
    args: ["--filter", "@ku0/code-runtime-host-contract", "build"],
  },
  {
    label: "Web runtime client contract test",
    command: "pnpm",
    args: ["-C", "apps/code", "exec", "vitest", "run", "src/services/runtimeClient.test.ts"],
  },
];

function runStep(step) {
  process.stdout.write(`\n==> ${step.label}\n`);
  const result =
    step.command === "pnpm"
      ? spawnPnpmSync(step.args, {
          stdio: "inherit",
          env: process.env,
        })
      : spawnSync(step.command, step.args, {
          stdio: "inherit",
          env: process.env,
          shell: process.platform === "win32",
        });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  for (const step of steps) {
    runStep(step);
  }
}

main();
