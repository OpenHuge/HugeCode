import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRustBuildEnv,
  prepareCargoTargetDirForBuild,
  resolveWorkspaceCargoTargetDir,
} from "../../../scripts/lib/cargo-target-cache.mjs";

type NapiBuildOptions = {
  packageRoot?: string;
  cargoCwd?: string;
  args?: string[];
};

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

function stripFlag(
  args: string[],
  flag: string
): {
  args: string[];
  value?: string;
} {
  const filteredArgs: string[] = [];
  let value: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flag) {
      if (i + 1 < args.length) {
        value = args[i + 1];
        i += 1;
      }
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      value = arg.slice(flag.length + 1);
      continue;
    }
    filteredArgs.push(arg);
  }

  return { args: filteredArgs, value };
}

function findRepoRoot(startDir: string): string | null {
  let current = startDir;
  while (true) {
    if (
      existsSync(path.join(current, "pnpm-workspace.yaml")) ||
      existsSync(path.join(current, ".git"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveNapiExecutable(packageRoot: string): string {
  const binName = process.platform === "win32" ? "napi.cmd" : "napi";
  const localBin = path.join(packageRoot, "node_modules", ".bin", binName);
  if (existsSync(localBin)) {
    return localBin;
  }
  const repoRoot = findRepoRoot(packageRoot);
  if (repoRoot) {
    const rootBin = path.join(repoRoot, "node_modules", ".bin", binName);
    if (existsSync(rootBin)) {
      return rootBin;
    }
  }
  return binName;
}

function resolveTargetBaseDir(cargoRoot: string): string {
  const envDir = process.env.CARGO_TARGET_DIR;
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(cargoRoot, envDir);
  }
  return resolveWorkspaceCargoTargetDir({ startDir: cargoRoot, relativeToDir: cargoRoot });
}

function resolveCargoCwd(
  args: string[],
  packageRoot: string,
  fallback: string,
  legacyCargoCwd?: string
): string {
  if (legacyCargoCwd) {
    return legacyCargoCwd;
  }

  const manifestPathFlag = readFlagValue(args, "--manifest-path");
  if (manifestPathFlag) {
    return path.dirname(manifestPathFlag) || ".";
  }

  const cwdFlag = readFlagValue(args, "--cwd");
  if (cwdFlag) {
    return cwdFlag;
  }

  const nativeCandidate = path.join(packageRoot, fallback, "Cargo.toml");
  if (existsSync(nativeCandidate)) {
    return fallback;
  }
  return ".";
}

export function runNapiBuild(options: NapiBuildOptions = {}): void {
  const packageRoot = options.packageRoot ?? process.cwd();
  const rawArgs = options.args ?? process.argv.slice(2);
  const { args, value: legacyCargoCwd } = stripFlag(rawArgs, "--cargo-cwd");
  const fallbackCargoCwd = options.cargoCwd ?? "native";
  const cargoCwd = resolveCargoCwd(args, packageRoot, fallbackCargoCwd, legacyCargoCwd);
  const cargoRoot = path.resolve(packageRoot, cargoCwd);
  const targetBaseDir = resolveTargetBaseDir(cargoRoot);
  const napiArgs = ["build"];
  const log = (message: string): void => {
    process.stdout.write(`[napi build] ${message}\n`);
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

    if (!hasFlag(args, "--manifest-path") && !hasFlag(args, "--cwd")) {
      napiArgs.push("--manifest-path", path.join(cargoCwd, "Cargo.toml"));
    }

    napiArgs.push(...args);

    // oxlint-disable-next-line no-console -- Build script output
    console.log(`Running napi build (${path.relative(packageRoot, cargoRoot) || "."})...`);
    if (sccachePath) {
      process.stdout.write(`Using sccache: ${sccachePath}\n`);
    }

    const napiExecutable = resolveNapiExecutable(packageRoot);
    const useShell = process.platform === "win32" && napiExecutable.toLowerCase().endsWith(".cmd");

    execFileSync(napiExecutable, napiArgs, {
      cwd: packageRoot,
      stdio: "inherit",
      shell: useShell,
      env,
    });
  } finally {
    releaseLock();
  }
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
  runNapiBuild();
}
