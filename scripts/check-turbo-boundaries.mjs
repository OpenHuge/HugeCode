#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { renderCheckMessage, writeLines } from "./lib/check-output.mjs";
import { resolveCommandInvocation } from "./lib/local-bin.mjs";

const strict = process.argv.includes("--strict");
const boundaryFilters = [
  "@ku0/code",
  "@ku0/code-runtime-client",
  "@ku0/code-runtime-webmcp-client",
  "@ku0/code-runtime-host-contract",
  "@ku0/code-runtime-service-rs",
];
const turboInvocation = resolveCommandInvocation("turbo", [
  "boundaries",
  ...boundaryFilters.flatMap((filter) => ["--filter", filter]),
]);
const result = spawnSync(turboInvocation.command, turboInvocation.args, {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "pipe",
});

const stdout = result.stdout?.trim() ?? "";
const stderr = result.stderr?.trim() ?? "";

if (stdout.length > 0) {
  writeLines(process.stdout, [stdout]);
}
if (stderr.length > 0) {
  writeLines(process.stderr, [stderr]);
}

if (result.status === 0) {
  process.exit(0);
}

const advisoryMessage = renderCheckMessage(
  "check-turbo-boundaries",
  "Turbo boundaries reported advisory violations. Script remains non-blocking unless --strict is set."
);

if (strict) {
  writeLines(process.stderr, [advisoryMessage]);
  process.exit(result.status ?? 1);
}

writeLines(process.stderr, [advisoryMessage]);
process.exit(0);
