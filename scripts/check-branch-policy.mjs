#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { renderCheckMessage, writeCheckJson, writeLines } from "./lib/check-output.mjs";
import { evaluateBranchPolicy } from "./lib/branch-policy.mjs";

function usage() {
  process.stdout.write(`Usage: node scripts/check-branch-policy.mjs [--branch <name>] [--json]\n`);
}

function parseArgs(rawArgs) {
  let branch = null;
  let json = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--branch") {
      const value = rawArgs[index + 1];
      if (!value) {
        usage();
        process.exit(1);
      }
      branch = value;
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage();
      process.exit(0);
    }
    usage();
    process.exit(1);
  }

  return { branch, json };
}

function resolveCurrentBranch() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "HEAD";
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const branch = options.branch ?? resolveCurrentBranch();
  const result = evaluateBranchPolicy(branch);

  if (options.json) {
    writeCheckJson({
      check: "check-branch-policy",
      ok: result.ok,
      errors: result.ok ? [] : [result.detail],
      warnings: result.status === "warn" ? [result.detail] : [],
      details: {
        branch: result.branch,
        kind: result.kind,
      },
    });
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (result.ok) {
    const prefix = result.status === "warn" ? "WARN" : "PASS";
    writeLines(process.stdout, [
      renderCheckMessage(prefix, `Branch policy: ${result.detail}`),
      renderCheckMessage(prefix, "Branch policy check passed."),
    ]);
    process.exitCode = 0;
    return;
  }

  writeLines(process.stderr, [
    renderCheckMessage("FAIL", `Branch policy: ${result.detail}`),
    renderCheckMessage("FAIL", "Branch policy check failed."),
  ]);
  process.exitCode = 1;
}

main();
