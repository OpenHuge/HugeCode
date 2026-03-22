#!/usr/bin/env node

import process from "node:process";
import { loadRootEnvLocal } from "./lib/load-env.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

loadRootEnvLocal(import.meta.url);

const child = spawnPnpm(["--filter", "@ku0/code-runtime-service-rs", "dev"], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
