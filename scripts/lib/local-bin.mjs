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
