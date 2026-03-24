import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!command || !["package", "make", "publish"].includes(command)) {
  throw new Error("Usage: node ./scripts/run-forge.mjs <package|make|publish>");
}

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const packageDir = resolve(scriptDir, "..");
const distDir = resolve(packageDir, "dist-electron");
const outDir = resolve(packageDir, "out");
const packageJson = JSON.parse(await readFile(resolve(packageDir, "package.json"), "utf8"));
const workspacePackageJson = JSON.parse(
  await readFile(resolve(packageDir, "../../package.json"), "utf8")
);
const forgeConfigSource = resolve(packageDir, "forge.config.mjs");
const workspaceRoot = resolve(packageDir, "../..");
const electronForgeBin =
  process.platform === "win32"
    ? resolve(workspaceRoot, "node_modules/.bin/electron-forge.cmd")
    : resolve(workspaceRoot, "node_modules/.bin/electron-forge");

let forgeStageDir = "";
let forgePackageDir = "";

async function createStagePaths() {
  forgeStageDir = await mkdtemp(resolve(tmpdir(), "hugecode-electron-forge-"));
  forgePackageDir = resolve(forgeStageDir, "app");
}

async function prepareStage() {
  await rm(resolve(packageDir, ".forge-stage"), { force: true, recursive: true });
  await rm(outDir, { force: true, recursive: true });
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
      "@electron-forge/cli": workspacePackageJson.devDependencies["@electron-forge/cli"],
      "@electron-forge/maker-deb":
        workspacePackageJson.devDependencies["@electron-forge/maker-deb"],
      "@electron-forge/maker-dmg":
        workspacePackageJson.devDependencies["@electron-forge/maker-dmg"],
      "@electron-forge/maker-squirrel":
        workspacePackageJson.devDependencies["@electron-forge/maker-squirrel"],
      "@electron-forge/maker-zip":
        workspacePackageJson.devDependencies["@electron-forge/maker-zip"],
      "@electron-forge/publisher-github":
        workspacePackageJson.devDependencies["@electron-forge/publisher-github"],
    },
  };

  await writeFile(
    resolve(forgePackageDir, "package.json"),
    `${JSON.stringify(stagedPackageJson, null, 2)}\n`,
    "utf8"
  );
  await writeFile(resolve(forgePackageDir, ".npmrc"), "node-linker=hoisted\n", "utf8");
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

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn("pnpm", ["exec", "node-gyp", "rebuild"], {
        cwd: packageInstallDir,
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
            `node-gyp rebuild for ${nativePackage.packageName} failed with exit code ${code ?? -1}`
          )
        );
      });
      child.on("error", rejectPromise);
    });
  }
}

async function runForge() {
  await ensureDarwinDmgNativeDependency();
  await createStagePaths();

  try {
    await prepareStage();

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(electronForgeBin, [command], {
        cwd: forgePackageDir,
        env: {
          ...process.env,
          ELECTRON_FORGE_DISABLE_PUBLISH_SANDBOX_WARNING: "true",
        },
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
