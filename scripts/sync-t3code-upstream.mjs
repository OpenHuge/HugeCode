#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const defaultRemote = "https://github.com/pingdotgg/t3code.git";
const vendorDir = resolve(repoRoot, ".codex/vendor/t3code");
const targetDir = resolve(repoRoot, "apps/code-t3/upstream");
const dryRun = process.argv.includes("--dry-run");
const refArg = process.argv.find((arg) => arg.startsWith("--ref="));
const remoteArg = process.argv.find((arg) => arg.startsWith("--remote="));
const ref = refArg?.slice("--ref=".length) || "main";
const remote = remoteArg?.slice("--remote=".length) || defaultRemote;

function run(command, args, cwd = repoRoot) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensureClone() {
  if (!existsSync(vendorDir)) {
    mkdirSync(dirname(vendorDir), { recursive: true });
    run("git", ["clone", "--depth", "1", "--branch", ref, remote, vendorDir]);
    return;
  }
  run("git", ["fetch", "--depth", "1", "origin", ref], vendorDir);
  run("git", ["checkout", "FETCH_HEAD"], vendorDir);
}

function readUpstreamHead() {
  return run("git", ["rev-parse", "HEAD"], vendorDir);
}

function sync() {
  ensureClone();
  const upstreamHead = readUpstreamHead();
  const sourceWebDir = resolve(vendorDir, "apps/web");
  const sourceLicense = resolve(vendorDir, "LICENSE");

  if (!existsSync(sourceWebDir)) {
    throw new Error(`t3code web app not found at ${sourceWebDir}`);
  }

  if (dryRun) {
    process.stdout.write(
      `Would sync ${sourceWebDir} to ${targetDir} from ${remote} ${upstreamHead}\n`
    );
    return;
  }

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceWebDir, targetDir, {
    recursive: true,
    filter(source) {
      return !source.includes("/node_modules/") && !source.includes("/dist/");
    },
  });

  if (existsSync(sourceLicense)) {
    writeFileSync(
      resolve(targetDir, "T3CODE_LICENSE"),
      readFileSync(sourceLicense, "utf8"),
      "utf8"
    );
  }

  writeFileSync(
    resolve(targetDir, "UPSTREAM.json"),
    `${JSON.stringify(
      {
        remote,
        ref,
        commit: upstreamHead,
        syncedAt: new Date().toISOString(),
        note: "Do not edit upstream files directly. Adapt through @ku0/code-t3-runtime-adapter and apps/code-t3/src.",
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  process.stdout.write(`Synced t3code apps/web at ${upstreamHead} into apps/code-t3/upstream.\n`);
}

try {
  sync();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
