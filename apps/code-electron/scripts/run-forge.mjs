import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildForgeEnvironment } from "./run-forge-support.mjs";
import {
  createForgeStagePackageJson,
  shouldInstallForgeStageDependencies,
} from "./forge-stage-package.mjs";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const tempRootDir = resolve(packageDir, ".tmp");
const packageJson = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
const forgeConfigSource = resolve(packageDir, "forge.config.mjs");
const workspaceRoot = resolve(packageDir, "../..");
const localMakerDebSource = resolve(scriptDir, "maker-deb.cjs");

let forgeStageDir = "";
let forgePackageDir = "";
let forgeStageElectronZipDir = "";

function normalizeCommandPath(commandPath) {
  return commandPath.replaceAll("\\", "/");
}

const incompatibleForgeStageConfigEnvKeys = new Set([
  "npm_config__jsr_registry",
  "npm_config_minimum_release_age",
  "npm_config_node_linker",
  "npm_config_npm_globalconfig",
  "npm_config_overrides",
  "npm_config_recursive",
  "npm_config_strict_dep_builds",
  "npm_config_verify_deps_before_run",
  "pnpm_config_verify_deps_before_run",
]);

export function parseForgeCommand(argv = process.argv) {
  const command = argv[2];
  if (!command || !["package", "make", "publish"].includes(command)) {
    throw new Error("Usage: node ./scripts/run-forge.mjs <package|make|publish>");
  }

  return command;
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
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", shellCommand],
    };
  }

  return {
    command: resolvedCommand,
    args,
  };
}

export function resolveForgeStageCommands(platform = process.platform) {
  return {
    electronForge: {
      command: normalizeCommandPath(
        platform === "win32"
          ? resolve(workspaceRoot, "node_modules/.bin/electron-forge.cmd")
          : resolve(workspaceRoot, "node_modules/.bin/electron-forge")
      ),
      shell: platform === "win32",
    },
    npm: {
      command: platform === "win32" ? "npm.cmd" : "npm",
      shell: platform === "win32",
    },
    pnpm: {
      command: platform === "win32" ? "pnpm.cmd" : "pnpm",
      shell: platform === "win32",
    },
  };
}

export function createStagedPackageJson(packageMetadata) {
  return createForgeStagePackageJson(packageMetadata);
}

export function createForgeStageEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const key of Object.keys(env)) {
    if (incompatibleForgeStageConfigEnvKeys.has(key.toLowerCase())) {
      delete env[key];
    }
  }

  return env;
}

export function resolveLocalElectronZipArtifactName(
  version = packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron,
  platform = process.platform,
  arch = process.arch
) {
  return `electron-v${String(version).replace(/^v/u, "")}-${platform}-${arch}.zip`;
}

export function createForgeExecutionEnv(baseEnv = process.env, electronZipDir = "") {
  const env = {
    ...createForgeStageEnv(baseEnv),
    ELECTRON_FORGE_DISABLE_PUBLISH_SANDBOX_WARNING: "true",
  };

  if (electronZipDir) {
    env.HUGECODE_ELECTRON_ZIP_DIR = electronZipDir;
  } else {
    delete env.HUGECODE_ELECTRON_ZIP_DIR;
  }

  return env;
}

export async function copyForgeOutDir(
  stagedOutDir,
  nextOutDir,
  dependencies = {
    accessImpl: access,
    cpImpl: cp,
    rmImpl: rm,
  }
) {
  await dependencies.accessImpl(stagedOutDir);
  await dependencies.rmImpl(nextOutDir, { force: true, recursive: true });
  await dependencies.cpImpl(stagedOutDir, nextOutDir, {
    force: true,
    recursive: true,
  });
}

async function runCommand(invocation, args, cwd, env = process.env) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(invocation.command, args, {
      cwd,
      env,
      shell: invocation.shell,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`${invocation.command} ${args.join(" ")} failed with exit code ${code ?? -1}`)
      );
    });
    child.on("error", rejectPromise);
  });
}

async function createStagePaths() {
  const forgeTempDir = resolve(tempRootDir, "forge");
  await mkdir(forgeTempDir, { recursive: true });
  forgeStageDir = await mkdtemp(resolve(forgeTempDir, "stage-"));
  forgePackageDir = resolve(forgeStageDir, "app");
  forgeStageElectronZipDir = resolve(forgeStageDir, "electron-zips");
}

async function prepareStage() {
  await rm(forgePackageDir, { force: true, recursive: true });
  await rm(outDir, { force: true, recursive: true });
  await mkdir(forgePackageDir, { recursive: true });
  await mkdir(resolve(forgePackageDir, "dist-electron"), { recursive: true });
  await mkdir(resolve(forgePackageDir, "scripts"), { recursive: true });
  await cp(distDir, resolve(forgePackageDir, "dist-electron"), { recursive: true });
  await cp(forgeConfigSource, resolve(forgePackageDir, "forge.config.mjs"));
  await cp(localMakerDebSource, resolve(forgePackageDir, "scripts/maker-deb.cjs"));

  const stagedPackageJson = createForgeStagePackageJson(packageJson);

  await writeFile(
    resolve(forgePackageDir, "package.json"),
    `${JSON.stringify(stagedPackageJson, null, 2)}\n`,
    "utf8"
  );

  if (shouldInstallForgeStageDependencies(stagedPackageJson)) {
    const { npm } = resolveForgeStageCommands();
    const stageEnv = createForgeStageEnv();
    await runCommand(
      npm,
      ["install", "--include=dev", "--ignore-scripts", "--no-package-lock"],
      forgePackageDir,
      stageEnv
    );
  }

  // Electron Forge's pnpm integration checks node-linker in the staged project,
  // but npm itself should not consume pnpm-only project config during install.
  await writeFile(resolve(forgePackageDir, ".npmrc"), "node-linker=hoisted\n", "utf8");
}

async function createLocalElectronZip() {
  const electronVersion =
    packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron ?? "";
  const normalizedVersion = String(electronVersion).replace(/^v/u, "");
  if (!normalizedVersion) {
    throw new Error("Missing electron version in apps/code-electron/package.json.");
  }

  const electronDistDir = resolve(workspaceRoot, "node_modules/electron/dist");
  await access(electronDistDir);
  await mkdir(forgeStageElectronZipDir, { recursive: true });

  const artifactName = resolveLocalElectronZipArtifactName(normalizedVersion);
  const artifactPath = resolve(forgeStageElectronZipDir, artifactName);

  if (process.platform === "darwin") {
    await runCommand(
      {
        command: "ditto",
        shell: false,
      },
      ["-c", "-k", "--sequesterRsrc", ".", artifactPath],
      electronDistDir
    );
    return forgeStageElectronZipDir;
  }

  if (process.platform === "win32") {
    await runCommand(
      {
        command: "powershell.exe",
        shell: true,
      },
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Compress-Archive -Path * -DestinationPath '${artifactPath.replace(/'/gu, "''")}' -Force`,
      ],
      electronDistDir
    );
    return forgeStageElectronZipDir;
  }

  await runCommand(
    {
      command: "zip",
      shell: false,
    },
    ["-qry", artifactPath, "."],
    electronDistDir
  );
  return forgeStageElectronZipDir;
}

async function ensureDarwinDmgNativeDependency(command = parseForgeCommand()) {
  if (process.platform !== "darwin" || (command !== "make" && command !== "publish")) {
    return;
  }

  const { pnpm } = resolveForgeStageCommands();
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

    await runCommand(pnpm, ["exec", "node-gyp", "rebuild"], packageInstallDir);
  }
}

async function runForge() {
  const command = parseForgeCommand();
  const { electronForge } = resolveForgeStageCommands();
  await ensureDarwinDmgNativeDependency(command);
  await createStagePaths();

  try {
    await prepareStage();
    const processTempDir = resolve(tempRootDir, "process");
    await mkdir(processTempDir, { recursive: true });
    const electronZipDir = await createLocalElectronZip();
    const forgeEnv = createForgeExecutionEnv(
      buildForgeEnvironment({
        baseEnv: process.env,
        command,
        processTempDir,
      }),
      electronZipDir
    );

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(electronForge.command, [command], {
        cwd: forgePackageDir,
        env: forgeEnv,
        shell: electronForge.shell,
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
      await copyForgeOutDir(stagedOutDir, outDir);
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
