#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolveGitComparisonBase } from "./lib/git-base-ref.mjs";
import { resolveCommandInvocation } from "./lib/local-bin.mjs";

const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

function resolveBaseRef() {
  const explicitCandidates = [
    process.env.TURBO_BASE_REF?.trim(),
    process.env.GITHUB_BASE_REF?.trim() ? `origin/${process.env.GITHUB_BASE_REF.trim()}` : null,
    process.env.GITHUB_BASE_REF?.trim() ?? null,
  ].filter(Boolean);
  const baseRef = resolveGitComparisonBase({ repoRoot: process.cwd(), includeHeadFallback: true });

  if (isCi && explicitCandidates.length > 0 && baseRef.ref === null) {
    const rendered = explicitCandidates.join(", ");
    process.stderr.write(
      `Failed to resolve an affected base ref in CI. Checked: ${rendered}. Ensure the base ref was fetched before running affected tasks.\n`
    );
    process.exit(1);
  }

  return baseRef;
}

function runTurbo(task, additionalArgs) {
  const { ref: baseRef, kind } = resolveBaseRef();
  const args = ["run", task];
  const forwardedArgs = additionalArgs[0] === "--" ? additionalArgs.slice(1) : additionalArgs;
  const env = { ...process.env };
  const hasExplicitFilter = forwardedArgs.some(
    (arg, index) =>
      arg.startsWith("--filter=") || (arg === "--filter" && index < forwardedArgs.length - 1)
  );

  if (baseRef) {
    if (hasExplicitFilter) {
      args.push(`--filter=...[${baseRef}]`);
    } else {
      args.push("--affected");
      env.TURBO_SCM_BASE = baseRef;
    }
    process.stdout.write(`Using affected base ref (${kind}): ${baseRef}\n`);
  } else {
    process.stdout.write("No affected base ref found; running Turbo without an affected filter.\n");
  }

  args.push(...forwardedArgs);

  const turboInvocation = resolveCommandInvocation("turbo", args);
  const result = spawnSync(turboInvocation.command, turboInvocation.args, {
    stdio: "inherit",
    env,
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
