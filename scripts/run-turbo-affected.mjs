#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolveLocalBinaryCommand } from "./lib/local-bin.mjs";

const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

function hasCommitRef(ref) {
  const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function resolveUpstreamRef() {
  const result = spawnSync(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }
  );
  if (result.status !== 0) {
    return null;
  }
  const upstream = result.stdout?.trim();
  return upstream ? upstream : null;
}

function resolveBaseCandidates() {
  const explicit = process.env.TURBO_BASE_REF?.trim();
  const githubBaseRef = process.env.GITHUB_BASE_REF?.trim();
  const upstreamRef = resolveUpstreamRef();
  const explicitCandidates = [];
  const fallbackCandidates = [];

  if (explicit) {
    explicitCandidates.push(explicit);
  }

  if (githubBaseRef) {
    explicitCandidates.push(`origin/${githubBaseRef}`, githubBaseRef);
  }

  if (upstreamRef) {
    explicitCandidates.push(upstreamRef);
  }

  fallbackCandidates.push(
    "origin/main",
    "main",
    "origin/master",
    "master",
    "origin/fastcode",
    "fastcode",
    "HEAD~1"
  );

  return {
    explicit: [...new Set(explicitCandidates.filter(Boolean))],
    fallback: [...new Set(fallbackCandidates.filter(Boolean))],
  };
}

function resolveBaseRef() {
  const { explicit, fallback } = resolveBaseCandidates();

  for (const candidate of explicit) {
    if (hasCommitRef(candidate)) {
      return { ref: candidate, kind: "explicit" };
    }
  }

  if (isCi && explicit.length > 0) {
    const rendered = explicit.join(", ");
    process.stderr.write(
      `Failed to resolve an affected base ref in CI. Checked: ${rendered}. Ensure the base ref was fetched before running affected tasks.\n`
    );
    process.exit(1);
  }

  for (const candidate of fallback) {
    if (hasCommitRef(candidate)) {
      return { ref: candidate, kind: "fallback" };
    }
  }

  return { ref: null, kind: "none" };
}

function runTurbo(task, additionalArgs) {
  const { ref: baseRef, kind } = resolveBaseRef();
  const args = ["run", task];
  const forwardedArgs = additionalArgs[0] === "--" ? additionalArgs.slice(1) : additionalArgs;

  if (baseRef) {
    args.push(`--filter=...[${baseRef}]`);
    process.stdout.write(`Using affected base ref (${kind}): ${baseRef}\n`);
  } else {
    process.stdout.write("No affected base ref found; running Turbo without an affected filter.\n");
  }

  args.push(...forwardedArgs);

  const turboCommand = resolveLocalBinaryCommand("turbo");
  const result = spawnSync(turboCommand, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    process.stderr.write(`${String(result.error)}\n`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function main() {
  const [task, ...additionalArgs] = process.argv.slice(2);
  if (!task) {
    process.exit(1);
  }

  runTurbo(task, additionalArgs);
}

main();
