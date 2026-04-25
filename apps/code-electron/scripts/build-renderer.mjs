import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRendererTarget } from "./renderer-target.mjs";

const packageDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = resolveRendererTarget();

const build = spawnSync("pnpm", ["-C", target.packageDir, "exec", "vite", "build"], {
  cwd: packageDir,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const prepare = spawnSync("node", ["./scripts/prepare-renderer.mjs"], {
  cwd: packageDir,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

process.exit(prepare.status ?? 0);
