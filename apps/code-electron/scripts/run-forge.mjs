import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildForgeEnvironment, resolveCommandInvocation } from "./run-forge-support.mjs";

const command = process.argv[2];
if (!command || !["package", "make", "publish"].includes(command)) {
  throw new Error("Usage: node ./scripts/run-forge.mjs <package|make|publish>");
}

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const tempRootDir = resolve(packageDir, ".tmp");
const packageJson = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
const forgeConfigSource = resolve(packageDir, "forge.config.mjs");
const workspaceRoot = resolve(packageDir, "../..");
const electronForgeBin =
  process.platform === "win32"
    ? resolve(workspaceRoot, "node_modules/.bin/electron-forge.cmd")
    : resolve(workspaceRoot, "node_modules/.bin/electron-forge");
const localMakerDebSource = resolve(scriptDir, "maker-deb.cjs");

let forgeStageDir = "";
let forgePackageDir = "";
const nodeExecDir = dirname(process.execPath);

async function runCommand(commandName, args, cwd) {
  const { argsPrefix, command } = await resolveCommandInvocation({
    commandName,
    nodeExecDir,
  });

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, [...argsPrefix, ...args], {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${command} ${[...argsPrefix, ...args].join(" ")} failed with exit code ${code ?? -1}`
        )
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

  const stagedPackageJson = {
    name: "hugecode",
    productName: "HugeCode",
    version: packageJson.version,
    description: "HugeCode beta desktop shell",
    productDescription: "HugeCode beta desktop shell",
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

  if (Object.keys(stagedPackageJson.dependencies ?? {}).length > 0) {
    await runCommand(
      "npm",
      ["install", "--include=dev", "--ignore-scripts", "--no-package-lock"],
      forgePackageDir
    );
  }
}

async function ensureDarwinDmgNativeDependency() {
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
  await ensureDarwinDmgNativeDependency();
  await createStagePaths();

  try {
    await prepareStage();
    const processTempDir = resolve(tempRootDir, "process");
    await mkdir(processTempDir, { recursive: true });

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(electronForgeBin, [command], {
        cwd: forgePackageDir,
        env: buildForgeEnvironment({
          baseEnv: process.env,
          command,
          processTempDir,
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

await runForge();
