#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { resolveLocalBinaryCommand } from "./lib/local-bin.mjs";

const repoRoot = process.cwd();
const forwardedArgs = process.argv.slice(2);
const workspaceUnitTestFilters = [
  "@ku0/code",
  "@ku0/code-web",
  "@ku0/code-runtime-client",
  "@ku0/code-runtime-host-contract",
  "@ku0/code-runtime-webmcp-client",
  "@ku0/code-workspace-client",
  "@ku0/design-system",
  "@ku0/discovery-rs",
  "@ku0/native-runtime-host-contract",
  "@ku0/shared",
  "@ku0/ui",
];

function shellQuote(token) {
  if (/^[A-Za-z0-9_./:@=-]+$/u.test(token)) {
    return token;
  }
  return `'${token.replace(/'/gu, "'\\''")}'`;
}

function resolveCommandInvocation(command, args) {
  const localBinaryCommand = resolveLocalBinaryCommand(command);
  if (localBinaryCommand) {
    return {
      command: localBinaryCommand,
      args,
      display: [command, ...args],
    };
  }

  if (process.platform === "win32" && command === "pnpm") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", ...args],
      display: [command, ...args],
    };
  }

  return {
    command,
    args,
    display: [command, ...args],
  };
}

function runCommand(command, args, label) {
  const invocation = resolveCommandInvocation(command, args);
  const rendered = invocation.display.map(shellQuote).join(" ");
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw new Error(`${label} failed to start: ${rendered}`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}: ${rendered}`);
  }
}

function buildWorkspaceUnitTestArgs() {
  const args = ["run", "test"];
  for (const filter of workspaceUnitTestFilters) {
    args.push(`--filter=${filter}`);
  }
  if (forwardedArgs.length > 0) {
    args.push("--", ...forwardedArgs);
  }
  return args;
}

try {
  runCommand(
    "vitest",
    ["run", "--config", "vitest.root.config.ts", ...forwardedArgs],
    "Root unit tests"
  );
  runCommand("turbo", buildWorkspaceUnitTestArgs(), "Workspace unit tests");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message) {
    process.stderr.write(`${message}\n`);
  }
  process.exitCode = 1;
}
