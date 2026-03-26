import { access } from "node:fs/promises";
import { resolve } from "node:path";

const FORGE_COMMANDS = new Set(["package", "make", "publish"]);

export function parseRunForgeArgs(argv = process.argv.slice(2)) {
  const [command, ...forgeArgs] = argv;
  if (!command || !FORGE_COMMANDS.has(command)) {
    throw new Error("Usage: node ./scripts/run-forge.mjs <package|make|publish> [forge args]");
  }

  return {
    command,
    forgeArgs,
  };
}

export function shouldReusePackagedOutput({ command, forgeArgs = [] } = {}) {
  return (command === "make" || command === "publish") && forgeArgs.includes("--skip-package");
}

export function shouldUseLinuxDebianPackagingEnv({ command, platform = process.platform } = {}) {
  return platform === "linux" && (command === "make" || command === "publish");
}

export function resolveNodeInstaller({
  platform = process.platform,
  nodeInstaller = process.env.NODE_INSTALLER,
} = {}) {
  const trimmedNodeInstaller = nodeInstaller?.trim();
  if (platform === "win32") {
    return trimmedNodeInstaller || "pnpm";
  }
  return trimmedNodeInstaller || undefined;
}

export function buildForgeEnvironment({
  baseEnv,
  command,
  platform = process.platform,
  processTempDir,
}) {
  const useLinuxDebianPackagingEnv = shouldUseLinuxDebianPackagingEnv({
    command,
    platform,
  });
  const nodeInstaller = resolveNodeInstaller({
    platform,
    nodeInstaller: baseEnv.NODE_INSTALLER,
  });

  return {
    ...baseEnv,
    ELECTRON_FORGE_DISABLE_PUBLISH_SANDBOX_WARNING: "true",
    ...(useLinuxDebianPackagingEnv
      ? {
          TEMP: processTempDir,
          TMP: processTempDir,
          TMPDIR: processTempDir,
        }
      : {}),
    ...(nodeInstaller ? { NODE_INSTALLER: nodeInstaller } : {}),
  };
}

export async function resolveCommandInvocation({
  commandName,
  platform = process.platform,
  nodeExecDir,
  accessPath = access,
}) {
  if (commandName === "npm") {
    const npmCliCandidates = [
      resolve(nodeExecDir, "../lib/node_modules/npm/bin/npm-cli.js"),
      resolve(nodeExecDir, "node_modules/npm/bin/npm-cli.js"),
    ];

    for (const npmCliPath of npmCliCandidates) {
      try {
        await accessPath(npmCliPath);
        return {
          argsPrefix: [npmCliPath],
          command: process.execPath,
        };
      } catch {
        // Try the next Node installation layout.
      }
    }
  }

  if (platform === "win32" && (commandName === "npm" || commandName === "pnpm")) {
    return {
      argsPrefix: [],
      command: `${commandName}.cmd`,
    };
  }

  return {
    argsPrefix: [],
    command: commandName,
  };
}
