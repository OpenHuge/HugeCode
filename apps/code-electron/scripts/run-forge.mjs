import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildForgeEnvironment, resolveCommandInvocation } from "./run-forge-support.mjs";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const tempRootDir = resolve(packageDir, ".tmp");
const packageJson = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
const forgeConfigSource = resolve(packageDir, "forge.config.mjs");
const workspaceRoot = resolve(packageDir, "../..");
const requireFromWorkspace = createRequire(resolve(workspaceRoot, "package.json"));
const electronForgeCli = requireFromWorkspace.resolve("@electron-forge/cli/dist/electron-forge.js");
const localMakerDebSource = resolve(scriptDir, "maker-deb.cjs");

let forgeStageDir = "";
let forgePackageDir = "";
const nodeExecDir = dirname(process.execPath);

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

export function createStagedPackageJson(packageMetadata) {
  return {
    name: "hugecode",
    productName: "HugeCode",
    version: packageMetadata.version,
    author: typeof packageMetadata.author === "string" ? packageMetadata.author : "OpenHuge",
    description:
      typeof packageMetadata.description === "string"
        ? packageMetadata.description
        : "HugeCode beta desktop shell",
    productDescription: "HugeCode beta desktop shell",
    type: "module",
    main: "dist-electron/main/main.js",
    repository: packageMetadata.repository,
    config: {
      forge: "./forge.config.mjs",
    },
    dependencies: Object.fromEntries(
      Object.entries(packageMetadata.dependencies ?? {}).filter(
        ([, version]) => typeof version === "string" && !version.startsWith("workspace:")
      )
    ),
    devDependencies: {
      "@electron-forge/maker-deb": "7.11.1",
      electron: packageMetadata.devDependencies.electron,
    },
  };
}

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

  const stagedPackageJson = createStagedPackageJson(packageJson);

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
  const command = parseForgeCommand();
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
  const command = parseForgeCommand();
  await ensureDarwinDmgNativeDependency();
  await createStagePaths();

  try {
    await prepareStage();
    const processTempDir = resolve(tempRootDir, "process");
    await mkdir(processTempDir, { recursive: true });

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, [electronForgeCli, command], {
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

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await runForge();
}
