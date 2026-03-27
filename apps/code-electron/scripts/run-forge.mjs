import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createForgeStagePackageJson,
  createForgeStagePnpmConfig,
  shouldInstallForgeStageDependencies,
} from "./forge-stage-package.mjs";
import { buildForgeEnvironment, resolveCommandInvocation } from "./run-forge-support.mjs";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const packageJson = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
const forgeConfigSource = resolve(packageDir, "forge.config.mjs");
const workspaceRoot = resolve(packageDir, "../..");
const workspacePnpmConfig = createForgeStagePnpmConfig(
  await readFile(resolve(workspaceRoot, "pnpm-workspace.yaml"), "utf8")
);
const requireFromWorkspace = createRequire(resolve(workspaceRoot, "package.json"));
const electronForgeCli = requireFromWorkspace.resolve("@electron-forge/cli/dist/electron-forge.js");
const darwinAdHocSignSource = resolve(scriptDir, "darwin-ad-hoc-sign.mjs");
const localMakerDebSource = resolve(scriptDir, "maker-deb.cjs");
const forgeTempRoot = resolve(workspaceRoot, "node_modules/.cache/hugecode-electron-forge");

let forgeStageDir = "";
let forgePackageDir = "";
const nodeExecDir = dirname(process.execPath);

const incompatibleForgeStageConfigEnvKeys = new Set([
  "npm_config_block_exotic_subdeps",
  "npm_config__jsr_registry",
  "npm_config_minimum_release_age",
  "npm_config_node_linker",
  "npm_config_npm_globalconfig",
  "npm_config_overrides",
  "npm_config_recursive",
  "npm_config_strict_dep_builds",
  "npm_config_verify_deps_before_run",
  "pnpm_config_block_exotic_subdeps",
  "pnpm_config_verify_deps_before_run",
]);

function parseForgeInvocation(argv = process.argv) {
  const [first, second] = argv.slice(2);
  if (first === "preflight") {
    return {
      mode: "preflight",
      command: second,
    };
  }

  return {
    mode: "forge",
    command: first,
  };
}

export function parseForgeCommand(argv = process.argv) {
  const { command } = parseForgeInvocation(argv);
  if (!command || !["package", "make", "publish"].includes(command)) {
    throw new Error(
      "Usage: node ./scripts/run-forge.mjs <package|make|publish> | node ./scripts/run-forge.mjs preflight <package|make|publish>"
    );
  }

  return command;
}

export function sanitizeSpawnEnv(baseEnv = process.env) {
  const sanitized = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    if (key.startsWith("=") || key.includes("\u0000")) {
      continue;
    }
    if (incompatibleForgeStageConfigEnvKeys.has(key.toLowerCase())) {
      continue;
    }
    if (typeof value !== "string" || value.includes("\u0000")) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function resolveCliCommand(commandName, platform = process.platform) {
  if (platform === "win32" && !commandName.includes(".")) {
    return `${commandName}.cmd`;
  }

  return commandName;
}

function quoteWindowsShellSegment(segment) {
  if (!/[\s"&|<>^()]/u.test(segment)) {
    return segment;
  }

  return `"${segment.replace(/"/gu, '""')}"`;
}

export function createCliInvocation(commandName, args, platform = process.platform) {
  const resolvedCommand = resolveCliCommand(commandName, platform);
  if (platform === "win32") {
    const shellCommand = [resolvedCommand, ...args].map(quoteWindowsShellSegment).join(" ");
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", shellCommand],
    };
  }

  return {
    command: resolvedCommand,
    args,
  };
}

export function createStagedPackageJson(packageMetadata) {
  return {
    author: typeof packageMetadata.author === "string" ? packageMetadata.author : "OpenHuge",
    description:
      typeof packageMetadata.description === "string"
        ? packageMetadata.description
        : "HugeCode beta desktop shell",
    productDescription: "HugeCode beta desktop shell",
    ...createForgeStagePackageJson(packageMetadata, workspacePnpmConfig),
  };
}

export function createForgeStageInstallArgs() {
  return ["install", "--ignore-scripts", "--ignore-workspace", "--no-lockfile"];
}

export function resolveForgeHostBinaryRequirements(command, platform = process.platform) {
  if (!["package", "make", "publish"].includes(command) || platform !== "linux") {
    return [];
  }

  const requirements = [
    {
      binary: "zip",
      rationale: "HugeCode stages a local Electron zip before invoking Forge packaging.",
    },
  ];

  if (command === "make" || command === "publish") {
    requirements.push(
      {
        binary: "dpkg",
        rationale: "Electron Forge's Debian maker needs dpkg to produce .deb artifacts.",
      },
      {
        binary: "fakeroot",
        rationale: "Electron Forge's Debian maker needs fakeroot to package .deb artifacts.",
      }
    );
  }

  return requirements;
}

async function canAccessExecutable(pathname, accessImpl) {
  try {
    await accessImpl(pathname);
    return true;
  } catch {
    return false;
  }
}

export async function resolveMissingForgeHostBinaries(
  command,
  options = {},
  dependencies = {
    accessImpl: access,
  }
) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const requirements = resolveForgeHostBinaryRequirements(command, platform);
  if (requirements.length === 0) {
    return [];
  }

  const pathValue = env.PATH ?? "";
  const pathEntries = pathValue.split(delimiter).filter(Boolean);
  const pathExts =
    platform === "win32"
      ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter(Boolean)
          .map((extension) => extension.toLowerCase())
      : [""];

  const missing = [];

  for (const requirement of requirements) {
    const hasBinary = await pathEntries.reduce(async (foundPromise, entry) => {
      if (await foundPromise) {
        return true;
      }

      for (const extension of pathExts) {
        const candidate =
          platform === "win32"
            ? resolve(
                entry,
                requirement.binary.endsWith(extension)
                  ? requirement.binary
                  : `${requirement.binary}${extension}`
              )
            : resolve(entry, requirement.binary);
        if (await canAccessExecutable(candidate, dependencies.accessImpl)) {
          return true;
        }
      }

      return false;
    }, Promise.resolve(false));

    if (!hasBinary) {
      missing.push(requirement);
    }
  }

  return missing;
}

export function formatForgeHostPreflightError(command, missing, platform = process.platform) {
  const names = missing.map((entry) => entry.binary).join(", ");
  const lines = [
    `Missing required host binaries for electron-forge ${command} on ${platform}: ${names}.`,
    "HugeCode now fails fast before build so release commands stop before expensive packaging work.",
  ];

  for (const requirement of missing) {
    lines.push(`- ${requirement.binary}: ${requirement.rationale}`);
  }

  if (platform === "linux") {
    lines.push("Install on Debian/Ubuntu: sudo apt-get install zip dpkg fakeroot");
  }

  return lines.join("\n");
}

export async function assertForgeHostBinaryRequirements(command, options = {}, dependencies) {
  const platform = options.platform ?? process.platform;
  const missing = await resolveMissingForgeHostBinaries(command, options, dependencies);
  if (missing.length > 0) {
    throw new Error(formatForgeHostPreflightError(command, missing, platform));
  }
}

async function runCommand(commandName, args, cwd, env = process.env) {
  const { argsPrefix, command } = await resolveCommandInvocation({
    commandName,
    nodeExecDir,
  });
  const invocation = createCliInvocation(command, [...argsPrefix, ...args], process.platform);

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env: sanitizeSpawnEnv(env),
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${invocation.command} ${invocation.args.join(" ")} failed with exit code ${code ?? -1}`
        )
      );
    });
    child.on("error", rejectPromise);
  });
}

async function createStagePaths() {
  await mkdir(forgeTempRoot, { recursive: true });
  forgeStageDir = await mkdtemp(resolve(forgeTempRoot, "stage-"));
  forgePackageDir = resolve(forgeStageDir, "app");
}

async function prepareStage() {
  await rm(forgePackageDir, { force: true, recursive: true });
  await rm(outDir, { force: true, recursive: true });
  await mkdir(forgePackageDir, { recursive: true });
  await mkdir(resolve(forgePackageDir, "dist-electron"), { recursive: true });
  await mkdir(resolve(forgePackageDir, "scripts"), { recursive: true });
  await cp(distDir, resolve(forgePackageDir, "dist-electron"), { recursive: true });
  await cp(forgeConfigSource, resolve(forgePackageDir, "forge.config.mjs"));
  await cp(darwinAdHocSignSource, resolve(forgePackageDir, "scripts/darwin-ad-hoc-sign.mjs"));
  await cp(localMakerDebSource, resolve(forgePackageDir, "scripts/maker-deb.cjs"));
  if (workspacePnpmConfig?.patchedDependencies) {
    const patchSourceDir = resolve(workspaceRoot, "patches");
    try {
      await access(patchSourceDir);
      await cp(patchSourceDir, resolve(forgePackageDir, "patches"), { recursive: true });
    } catch {
      // Keep the staged install running even if the workspace has no patch assets.
    }
  }

  const stagedPackageJson = createStagedPackageJson(packageJson);

  await writeFile(
    resolve(forgePackageDir, "package.json"),
    `${JSON.stringify(stagedPackageJson, null, 2)}\n`,
    "utf8"
  );
  await writeFile(resolve(forgePackageDir, ".npmrc"), "node-linker=hoisted\n", "utf8");

  if (shouldInstallForgeStageDependencies(stagedPackageJson)) {
<<<<<<< HEAD
    await runCommand(
      "pnpm",
      createForgeStageInstallArgs(workspaceRoot),
      forgePackageDir,
      process.env
    );
=======
    await runCommand("pnpm", createForgeStageInstallArgs(), forgePackageDir, process.env);
>>>>>>> ab2a52bb (fix: align forge stage install with workspace config)
  }
}

async function ensureDarwinDmgNativeDependency(command) {
  if (process.platform !== "darwin" || (command !== "make" && command !== "publish")) {
    return;
  }

  const pnpmStoreDir = resolve(workspaceRoot, "node_modules/.pnpm");
  const entries = await readdir(pnpmStoreDir, { withFileTypes: true });
  const nativePackages = [
    {
      binaryPath: "build/Release/volume.node",
      packageName: "macos-alias",
    },
    {
      binaryPath: "build/Release/xattr.node",
      packageName: "fs-xattr",
    },
  ];

  for (const nativePackage of nativePackages) {
    const matchingEntry = entries.find(
      (entry) => entry.isDirectory() && entry.name.startsWith(`${nativePackage.packageName}@`)
    );
    if (!matchingEntry) {
      continue;
    }

    const packageInstallDir = resolve(
      pnpmStoreDir,
      matchingEntry.name,
      `node_modules/${nativePackage.packageName}`
    );
    const nativeBinaryPath = resolve(packageInstallDir, nativePackage.binaryPath);

    try {
      await access(nativeBinaryPath);
      continue;
    } catch {
      // Fall through and rebuild the native addon explicitly.
    }

    await runCommand("pnpm", ["exec", "node-gyp", "rebuild"], packageInstallDir);
  }
}

async function runForge() {
  const invocation = parseForgeInvocation();
  const command = parseForgeCommand();

  await assertForgeHostBinaryRequirements(command, {
    env: sanitizeSpawnEnv(process.env),
  });
  if (invocation.mode === "preflight") {
    return;
  }

  await ensureDarwinDmgNativeDependency(command);
  await createStagePaths();

  try {
    await prepareStage();
    const processTempDir = resolve(forgeTempRoot, "process");
    await mkdir(processTempDir, { recursive: true });

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, [electronForgeCli, command], {
        cwd: forgePackageDir,
        env: sanitizeSpawnEnv(
          buildForgeEnvironment({
            baseEnv: process.env,
            command,
            processTempDir,
          })
        ),
        stdio: "inherit",
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolvePromise();
          return;
        }

        rejectPromise(new Error(`electron-forge ${command} failed with exit code ${code ?? -1}`));
      });
      child.on("error", rejectPromise);
    });

    const stagedOutDir = resolve(forgePackageDir, "out");
    try {
      await access(stagedOutDir);
      await cp(stagedOutDir, outDir, { recursive: true });
    } catch {
      // Some Forge commands may not emit an out directory.
    }
  } finally {
    if (forgeStageDir) {
      await rm(forgeStageDir, { force: true, recursive: true });
    }
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await runForge();
}
