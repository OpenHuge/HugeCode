#!/usr/bin/env node

import process from "node:process";
import {
  WINDOWS_SDK_COMPONENT_HINT,
  findWindowsPowershellExecutable,
  findWindowsSdkLayout,
  findWindowsVcvarsPath,
  findWindowsWebView2Runtime,
  hasWindowsCommand,
  listInstalledRustTargets,
  loadWindowsMsvcEnv,
} from "./lib/windows-host.mjs";

const DEFAULT_TARGET = "x86_64-pc-windows-msvc";
const SUPPORTED_TARGETS = new Set(["x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc"]);

function readArgValue(flag) {
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag && index + 1 < argv.length) {
      return argv[index + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

function logStatus(level, message) {
  process.stdout.write(`[${level}] ${message}\n`);
}

function main() {
  const repoRoot = process.cwd();
  const target = readArgValue("--target")?.trim() || DEFAULT_TARGET;
  if (!SUPPORTED_TARGETS.has(target)) {
    process.stderr.write(
      `Unsupported Windows target \`${target}\`. Expected one of: ${Array.from(SUPPORTED_TARGETS).join(", ")}.\n`
    );
    process.exit(1);
  }

  if (process.platform !== "win32") {
    logStatus("info", `Windows host checks skipped on ${process.platform}.`);
    return;
  }

  const failures = [];
  const warnings = [];

  if (target === "aarch64-pc-windows-msvc") {
    warnings.push(
      "ARM64 desktop builds may also require the Visual Studio ARM64/ARM64EC C++ toolchain components in addition to the base x64 MSVC workload."
    );
  }

  const linkReady = hasWindowsCommand("link", { repoRoot });
  const vcvarsPath = findWindowsVcvarsPath({ repoRoot });
  const hydratedMsvcEnv = loadWindowsMsvcEnv({ repoRoot });
  if (linkReady) {
    logStatus("pass", "MSVC linker is already available on PATH.");
  } else if (vcvarsPath && hydratedMsvcEnv) {
    logStatus("pass", `Visual Studio toolchain detected via ${vcvarsPath}.`);
  } else {
    failures.push(
      "MSVC build tools were not detected. Install Visual Studio 2022 C++ build tools."
    );
  }

  const windowsSdkLayout = findWindowsSdkLayout();
  if (windowsSdkLayout) {
    logStatus(
      "pass",
      `Windows SDK ${windowsSdkLayout.version} detected (${windowsSdkLayout.kernel32LibPath}).`
    );
  } else {
    failures.push(
      `Windows SDK was not found. Install Visual Studio component ${WINDOWS_SDK_COMPONENT_HINT}.`
    );
  }

  const installedRustTargets = new Set(listInstalledRustTargets({ repoRoot }));
  if (installedRustTargets.has(target)) {
    logStatus("pass", `Rust target ${target} is installed.`);
  } else {
    failures.push(`Rust target ${target} is missing. Run \`rustup target add ${target}\`.`);
  }

  const powershellExecutable = findWindowsPowershellExecutable({ repoRoot });
  if (powershellExecutable) {
    logStatus("pass", `PowerShell runtime detected (${powershellExecutable}).`);
  } else {
    warnings.push(
      "PowerShell was not detected. Workspace picker and some Windows shell flows will degrade."
    );
  }

  const webviewRuntime = findWindowsWebView2Runtime();
  if (webviewRuntime) {
    logStatus(
      "pass",
      `WebView2 runtime detected (${webviewRuntime.version} at ${webviewRuntime.executablePath}).`
    );
  } else {
    warnings.push(
      "WebView2 runtime was not detected. `tauri dev` may fail locally, but Windows bundles use an embedded bootstrapper for end-user installs."
    );
  }

  for (const warning of warnings) {
    logStatus("warn", warning);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      logStatus("fail", failure);
    }
    process.exit(1);
  }

  logStatus("pass", `Windows host is ready for ${target} desktop verification/build flows.`);
}

main();
