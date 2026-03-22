#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { formatProcessTree, terminateProcessTree } from "./lib/process-tree.mjs";

const DEFAULT_TIMEOUT_MS = 15_000;
const REPRO_TARGETS = [
  "src/features/composer/components/ComposerInput.tsx",
  "src/features/composer/components/ComposerInput.lazy.test.tsx",
  "src/features/layout/hooks/layoutNodes/buildSecondaryNodes.test.tsx",
];

function writeStdoutLine(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderrLine(message) {
  process.stderr.write(`${message}\n`);
}

function shellQuote(token) {
  if (/^[A-Za-z0-9_./:@=-]+$/u.test(token)) {
    return token;
  }
  return `'${token.replace(/'/gu, "'\\''")}'`;
}

function parseTimeoutMs(rawValue) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
}

const cliTimeoutArg = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--timeout-ms="));
const timeoutMs = parseTimeoutMs(
  cliTimeoutArg
    ? cliTimeoutArg.slice("--timeout-ms=".length)
    : process.env.VALIDATE_APPS_CODE_RELATED_TIMEOUT_MS
);
const args = [
  "-C",
  "apps/code",
  "exec",
  "vitest",
  "related",
  "--run",
  "--passWithNoTests",
  ...REPRO_TARGETS,
];

writeStdoutLine("[debug-apps-code-vitest-related-hang] reproducer targets:");
for (const target of REPRO_TARGETS) {
  writeStdoutLine(`- ${target}`);
}
writeStdoutLine(
  `[debug-apps-code-vitest-related-hang] command: ${["pnpm", ...args].map(shellQuote).join(" ")}`
);
writeStdoutLine(`[debug-apps-code-vitest-related-hang] timeout: ${timeoutMs}ms`);

const child = spawn("pnpm", args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

let settled = false;
const finish = async (code) => {
  if (settled) {
    return;
  }
  settled = true;
  process.exit(code);
};

child.once("error", async (error) => {
  writeStderrLine(`[debug-apps-code-vitest-related-hang] failed to start: ${error.message}`);
  await finish(1);
});

child.once("close", async (code) => {
  if (settled) {
    return;
  }
  await finish(code ?? 1);
});

setTimeout(async () => {
  if (settled) {
    return;
  }
  const pid = child.pid;
  writeStderrLine(
    `[debug-apps-code-vitest-related-hang] timed out after ${timeoutMs}ms; dumping process tree before cleanup`
  );
  if (Number.isInteger(pid) && pid > 0) {
    writeStderrLine(formatProcessTree(pid));
    await terminateProcessTree(pid, { graceMs: 750 });
  }
  await finish(1);
}, timeoutMs);
