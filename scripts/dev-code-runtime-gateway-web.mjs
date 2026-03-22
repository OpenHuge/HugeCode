#!/usr/bin/env node

import process from "node:process";
import { loadRootEnvLocal } from "./lib/load-env.mjs";
import { spawnPnpm } from "./lib/spawn-pnpm.mjs";

loadRootEnvLocal(import.meta.url);

const child = spawnPnpm(["dev:code:ui"], {
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT:
      process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT ?? "http://127.0.0.1:8788/rpc",
  },
});

child.on("error", (error) => {
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
