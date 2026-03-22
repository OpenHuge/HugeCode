import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

export function resolvePnpmInvocation() {
  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    shell: process.platform === "win32",
  };
}

export function spawnPnpm(args, options = {}) {
  const { command, shell } = resolvePnpmInvocation();
  return spawn(command, args, {
    ...options,
    shell: options.shell ?? shell,
  });
}

export function spawnPnpmSync(args, options = {}) {
  const { command, shell } = resolvePnpmInvocation();
  return spawnSync(command, args, {
    ...options,
    shell: options.shell ?? shell,
  });
}
