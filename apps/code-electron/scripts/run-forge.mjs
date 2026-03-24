import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const SUPPORTED_COMMANDS = new Set(["package", "make", "publish"]);
const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const scriptPath = fileURLToPath(import.meta.url);
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const packageJson = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
const forgeConfigSource = resolve(packageDir, "forge.config.mjs");
const workspaceRoot = resolve(packageDir, "../..");
const electronForgeBin =
  process.platform === "win32"
    ? resolve(workspaceRoot, "node_modules/.bin/electron-forge.cmd")
    : resolve(workspaceRoot, "node_modules/.bin/electron-forge");

let forgeStageDir = "";
let forgePackageDir = "";

export function sanitizeSpawnEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key, value]) =>
        !key.startsWith("=") &&
        !key.includes("\u0000") &&
        typeof value === "string" &&
        !value.includes("\u0000")
    )
  );
}

export function resolveStageInstallCommand(env = process.env) {
  const packageManagerEntrypoint = env.npm_execpath?.trim();
  if (packageManagerEntrypoint) {
    return {
      commandName: process.execPath,
      args: [packageManagerEntrypoint, "install", "--ignore-scripts"],
    };
  }

  return {
    commandName: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["install", "--ignore-scripts"],
  };
}

async function runCommand(commandName, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(commandName, args, {
      cwd,
      env: sanitizeSpawnEnv(process.env),
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`${commandName} ${args.join(" ")} failed with exit code ${code ?? -1}`)
      );
    });
    child.on("error", rejectPromise);
  });
}

async function createStagePaths() {
  forgeStageDir = await mkdtemp(resolve(tmpdir(), "hugecode-electron-forge-"));
  forgePackageDir = resolve(forgeStageDir, "app");
}

async function prepareStage() {
  await rm(forgePackageDir, { force: true, recursive: true });
  await rm(outDir, { force: true, recursive: true });
  await mkdir(forgePackageDir, { recursive: true });
  await mkdir(resolve(forgePackageDir, "dist-electron"), { recursive: true });
  await cp(distDir, resolve(forgePackageDir, "dist-electron"), { recursive: true });
  await cp(forgeConfigSource, resolve(forgePackageDir, "forge.config.mjs"));

  const stagedPackageJson = {
    name: "hugecode",
    productName: "HugeCode",
    version: packageJson.version,
    type: "module",
    main: "dist-electron/main/main.js",
    repository: packageJson.repository,
    config: {
      forge: "./forge.config.mjs",
    },
    dependencies: Object.fromEntries(
      Object.entries(packageJson.dependencies ?? {}).filter(
        ([, version]) => typeof version === "string" && !version.startsWith("workspace:")
      )
    ),
    devDependencies: {
      electron: packageJson.devDependencies.electron,
    },
  };

  await writeFile(
    resolve(forgePackageDir, "package.json"),
    `${JSON.stringify(stagedPackageJson, null, 2)}\n`,
    "utf8"
  );
  await writeFile(resolve(forgePackageDir, ".npmrc"), "node-linker=hoisted\n", "utf8");

  const hasStageDependencies =
    Object.keys(stagedPackageJson.dependencies ?? {}).length > 0 ||
    Object.keys(stagedPackageJson.devDependencies ?? {}).length > 0;
  if (hasStageDependencies) {
    const installCommand = resolveStageInstallCommand();
    await runCommand(installCommand.commandName, installCommand.args, forgePackageDir);
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

async function runForge(command) {
  await ensureDarwinDmgNativeDependency(command);
  await createStagePaths();

  try {
    await prepareStage();

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(electronForgeBin, [command], {
        cwd: forgePackageDir,
        env: sanitizeSpawnEnv({
          ...process.env,
          ELECTRON_FORGE_DISABLE_PUBLISH_SANDBOX_WARNING: "true",
        }),
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

export async function runForgeCli(command = process.argv[2]) {
  if (!command || !SUPPORTED_COMMANDS.has(command)) {
    throw new Error("Usage: node ./scripts/run-forge.mjs <package|make|publish>");
  }

  await runForge(command);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await runForgeCli();
}
