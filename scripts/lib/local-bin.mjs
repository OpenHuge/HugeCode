import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptsLibDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsLibDir, "..", "..");

const LOCAL_BINARY_COMMANDS = new Set(["madge", "oxfmt", "oxlint", "tsc", "turbo", "vitest"]);

export function isLocalBinaryCommand(command) {
  return LOCAL_BINARY_COMMANDS.has(command);
}

export function resolveLocalBinaryCommand(command) {
  if (!isLocalBinaryCommand(command)) {
    return null;
  }

  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  return path.join(repoRoot, "node_modules", ".bin", executable);
}

export function resolveCommandInvocation(command, args, options = {}) {
  const platform = options.platform ?? process.platform;
  const localBinaryCommand = isLocalBinaryCommand(command)
    ? path.join(repoRoot, "node_modules", ".bin", platform === "win32" ? `${command}.cmd` : command)
    : null;

  if (localBinaryCommand) {
    if (platform === "win32") {
      return {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", localBinaryCommand, ...args],
        display: [command, ...args],
      };
    }

    return {
      command: localBinaryCommand,
      args,
      display: [command, ...args],
    };
  }

  if (platform === "win32" && command === "pnpm") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "pnpm", ...args],
      display: ["pnpm", ...args],
    };
  }

  if (platform === "win32" && command === "node") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "node", ...args],
      display: ["node", ...args],
    };
  }

  return {
    command,
    args,
    display: [command, ...args],
  };
}
