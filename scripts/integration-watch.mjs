#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    repo: process.cwd(),
    intervalMins: 3,
    once: false,
    targetRef: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--repo") {
      args.repo = argv[index + 1] ?? args.repo;
      index += 1;
      continue;
    }
    if (token === "--interval-mins") {
      const value = Number(argv[index + 1]);
      if (Number.isFinite(value) && value > 0) {
        args.intervalMins = value;
      }
      index += 1;
      continue;
    }
    if (token === "--target-ref") {
      args.targetRef = argv[index + 1] ?? args.targetRef;
      index += 1;
      continue;
    }
    if (token === "--once") {
      args.once = true;
    }
  }

  return args;
}

function runGit(repo, gitArgs, allowFailure = false) {
  try {
    const output = execFileSync("git", gitArgs, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    const message =
      error instanceof Error ? error.message : `git ${gitArgs.join(" ")} failed unexpectedly`;
    throw new Error(message);
  }
}

function nowStamp() {
  return new Date().toISOString().replace("T", " ").replace("Z", "Z");
}

function parseRefs(raw) {
  if (!raw) {
    return [];
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [ref, sha, date, subject] = line.split("|");
      return { ref, sha, date, subject };
    });
}

function printSnapshot(options) {
  const { repo } = options;

  runGit(repo, ["fetch", "--all", "--prune"]);
  const localBranch = runGit(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const localSha = runGit(repo, ["rev-parse", "--short", "HEAD"]);
  const compareRef = options.targetRef || localBranch;
  const syncRef = options.targetRef || `origin/${localBranch}`;
  const targetSha = runGit(repo, ["rev-parse", "--short", compareRef], true);
  const aheadBehind = runGit(
    repo,
    ["rev-list", "--left-right", "--count", `${localBranch}...${syncRef}`],
    true
  );
  const [aheadRaw, behindRaw] = aheadBehind.split(/\s+/);
  const ahead = Number(aheadRaw || 0);
  const behind = Number(behindRaw || 0);

  const refsRaw = runGit(
    repo,
    [
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:short)|%(objectname:short)|%(committerdate:iso8601)|%(subject)",
      "refs/remotes/origin/feat/code-agent*",
      "refs/remotes/origin/feat/code-track*",
    ],
    true
  );
  const refs = parseRefs(refsRaw);

  const pending = refs
    .map((entry) => {
      const cherryRaw = runGit(repo, ["cherry", compareRef, entry.ref], true);
      const pendingCount = cherryRaw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("+ ")).length;
      return { ...entry, pendingCount };
    })
    .filter((entry) => entry.pendingCount > 0 && entry.ref !== compareRef && entry.ref !== syncRef);

  process.stdout.write(`\n[${nowStamp()}] Integration snapshot\n`);
  process.stdout.write(`repo: ${repo}\n`);
  process.stdout.write(`local: ${localBranch} @ ${localSha}\n`);
  process.stdout.write(
    `compare target: ${compareRef}${targetSha ? ` @ ${targetSha}` : " (not found)"}\n`
  );
  process.stdout.write(`sync target: ${syncRef}\n`);
  process.stdout.write(`sync: ahead ${ahead}, behind ${behind}\n`);

  if (pending.length === 0) {
    process.stdout.write("pending agent/track commits: none\n");
    return;
  }

  process.stdout.write("pending agent/track commits:\n");
  for (const entry of pending) {
    process.stdout.write(
      `- ${entry.ref}: ${entry.pendingCount} commit(s), latest ${entry.sha}, ${entry.date}, ${entry.subject}\n`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const intervalMs = Math.round(options.intervalMins * 60_000);

  printSnapshot(options);
  if (options.once) {
    return;
  }

  process.stdout.write(
    `\nwatching every ${options.intervalMins} minute(s). Press Ctrl+C to stop.\n`
  );
  setInterval(() => {
    try {
      printSnapshot(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`watch iteration failed: ${message}\n`);
    }
  }, intervalMs);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`integration-watch failed: ${message}\n`);
  process.exitCode = 1;
});
