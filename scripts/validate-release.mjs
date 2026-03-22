#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { spawnPnpmSync } from "./lib/spawn-pnpm.mjs";

function runNodeScript(scriptPath, args = [], env = process.env) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env,
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPnpm(args, env = process.env) {
  const result = spawnPnpmSync(args, {
    stdio: "inherit",
    env,
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

const webE2EPort = process.env.WEB_E2E_PORT?.trim() || "5267";

runNodeScript("scripts/validate.mjs", ["--run-e2e", "--e2e=smoke,a11y,core,features"], {
  ...process.env,
  STYLE_BUDGET_PROFILE: "release",
});
runPnpm(["--filter", "@ku0/code", "build"]);
runPnpm(["check:code:bundle-budget"]);
runPnpm(["test:e2e:ux-audit"], {
  ...process.env,
  UX_AUDIT_URL: `http://127.0.0.1:${webE2EPort}/workspaces`,
  UX_AUDIT_MAX_P0: "0",
  UX_AUDIT_MAX_P1: "0",
  UX_AUDIT_MAX_P2: "8",
  UX_AUDIT_MAX_SKIPS: "0",
});
runNodeScript("scripts/check-ux-audit-report.mjs");
