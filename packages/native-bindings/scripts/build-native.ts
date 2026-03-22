import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRustBuildEnv,
  prepareCargoTargetDirForBuild,
  resolveWorkspaceCargoTargetDir,
} from "../../../scripts/lib/cargo-target-cache.mjs";

type BuildOptions = {
  packageRoot?: string;
  args?: string[];
};

const PACKAGE_MARKER = "[package]";

function resolveCargoRoot(packageRoot: string): string {
  const directManifest = path.join(packageRoot, "Cargo.toml");
  if (existsSync(directManifest)) {
    return packageRoot;
  }
  const nativeRoot = path.join(packageRoot, "native");
  const nativeManifest = path.join(nativeRoot, "Cargo.toml");
  if (existsSync(nativeManifest)) {
    return nativeRoot;
  }
  throw new Error(`Cargo.toml not found under ${packageRoot}`);
}

function getCrateName(cargoRoot: string): string {
  const cargoPath = path.join(cargoRoot, "Cargo.toml");
  if (!existsSync(cargoPath)) {
    throw new Error(`Cargo.toml not found at ${cargoPath}`);
  }
  const content = readFileSync(cargoPath, "utf8");
  const packageIndex = content.indexOf(PACKAGE_MARKER);
  if (packageIndex === -1) {
    throw new Error(`Missing [package] section in ${cargoPath}`);
  }
  const afterPackage = content.slice(packageIndex + PACKAGE_MARKER.length);
  const nextSectionIndex = afterPackage.search(/\n\[/);
  const packageSection =
    nextSectionIndex === -1 ? afterPackage : afterPackage.slice(0, nextSectionIndex);
  const match = packageSection.match(/^\s*name\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error(`Could not parse package name from ${cargoPath}`);
  }
  return match[1];
}

function getLibraryName(crateBaseName: string): string {
  if (process.platform === "win32") {
    return `${crateBaseName}.dll`;
  }
  if (process.platform === "darwin") {
    return `lib${crateBaseName}.dylib`;
  }
  return `lib${crateBaseName}.so`;
}

function splitArgs(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(" ")
    .map((arg) => arg.trim())
    .filter(Boolean);
}

function readFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flag && i + 1 < args.length) {
      return args[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag) || args.some((arg) => arg.startsWith(`${flag}=`));
}

function resolveTargetBaseDir(cargoRoot: string, targetDirFlag?: string): string {
  if (targetDirFlag) {
    return path.isAbsolute(targetDirFlag) ? targetDirFlag : path.resolve(cargoRoot, targetDirFlag);
  }
  const envDir = process.env.CARGO_TARGET_DIR;
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(cargoRoot, envDir);
  }
  return resolveWorkspaceCargoTargetDir({ startDir: cargoRoot, relativeToDir: cargoRoot });
}

function resolveCargoArgs(rawArgs: string[], envArgs: string[]) {
  const hasReleaseFlag = rawArgs.includes("--release") || envArgs.includes("--release");
  const filteredRawArgs = rawArgs.filter((arg) => arg !== "--release");
  const filteredEnvArgs = envArgs.filter((arg) => arg !== "--release");
  const combinedArgs = [...filteredRawArgs, ...filteredEnvArgs];
  const profile = readFlagValue(combinedArgs, "--profile");
  const target = readFlagValue(combinedArgs, "--target") ?? process.env.CARGO_BUILD_TARGET;
  const targetDirFlag = readFlagValue(combinedArgs, "--target-dir");
  const useRelease = hasReleaseFlag && !profile;
  const cargoArgs = [...(useRelease ? ["--release"] : []), ...combinedArgs];
  return {
    cargoArgs,
    profile,
    target,
    targetDirFlag,
  };
}

export function runNativeBuild(options: BuildOptions = {}): void {
  const packageRoot = options.packageRoot ?? process.cwd();
  const args = options.args ?? process.argv.slice(2);
  const cargoRoot = resolveCargoRoot(packageRoot);
  const crateName = getCrateName(cargoRoot);
  const crateBaseName = crateName.replace(/-/g, "_");
  const envArgs = splitArgs(process.env.CARGO_ARGS);
  const { cargoArgs, profile, target, targetDirFlag } = resolveCargoArgs(args, envArgs);
  const targetBaseDir = resolveTargetBaseDir(cargoRoot, targetDirFlag);
  const buildProfile = profile ?? (hasFlag(cargoArgs, "--release") ? "release" : "debug");
  const outputDir = target
    ? path.join(targetBaseDir, target, buildProfile)
    : path.join(targetBaseDir, buildProfile);
  const log = (message: string): void => {
    process.stdout.write(`[native build] ${message}\n`);
  };
  const { releaseLock } = prepareCargoTargetDirForBuild({
    startDir: cargoRoot,
    relativeToDir: cargoRoot,
    targetDir: targetBaseDir,
    log,
  });

  try {
    const { env, sccachePath } = buildRustBuildEnv({
      startDir: cargoRoot,
      relativeToDir: cargoRoot,
      targetDir: targetBaseDir,
    });

    // oxlint-disable-next-line no-console -- Build script output
    console.log(`Building ${crateName} (${buildProfile}${target ? `, target ${target}` : ""})...`);
    if (sccachePath) {
      process.stdout.write(`Using sccache: ${sccachePath}\n`);
    }

    execFileSync("cargo", ["build", ...cargoArgs], {
      cwd: cargoRoot,
      stdio: "inherit",
      env,
    });

    const source = path.join(outputDir, getLibraryName(crateBaseName));
    if (!existsSync(source)) {
      throw new Error(`Native library not found at ${source}`);
    }

    const distDir = path.join(packageRoot, "dist");
    mkdirSync(distDir, { recursive: true });
    const destination = path.join(distDir, `${crateBaseName}.node`);
    copyFileSync(source, destination);

    // oxlint-disable-next-line no-console -- Build script output
    console.log(`✓ Copied ${path.basename(destination)} to ${distDir}`);
  } finally {
    releaseLock();
  }
}

function isDirectInvocation(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectInvocation()) {
  runNativeBuild();
}
