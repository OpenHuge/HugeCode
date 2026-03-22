import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const WINDOWS_SDK_COMPONENT_HINT = "Microsoft.VisualStudio.Component.Windows11SDK.22621";
const LEGACY_WINDOWS_POWERSHELL_PATH =
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

export function findWindowsVcvarsPath({ repoRoot = process.cwd() } = {}) {
  if (process.platform !== "win32") {
    return null;
  }

  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const candidatePaths = [];
  if (programFilesX86) {
    const vswherePath = path.join(
      programFilesX86,
      "Microsoft Visual Studio",
      "Installer",
      "vswhere.exe"
    );
    if (fs.existsSync(vswherePath)) {
      try {
        const installationPath = execFileSync(
          vswherePath,
          [
            "-latest",
            "-products",
            "*",
            "-requires",
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
            "-property",
            "installationPath",
          ],
          {
            cwd: repoRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }
        )
          .trim()
          .replace(/\r?\n.*/u, "");
        if (installationPath) {
          candidatePaths.push(
            path.join(installationPath, "VC", "Auxiliary", "Build", "vcvars64.bat")
          );
        }
      } catch {
        // Fall through to common install locations.
      }
    }
  }

  candidatePaths.push(
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat"
  );

  return candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) ?? null;
}

export function prependMissingPathEntries(currentValue, nextEntries) {
  const existingEntries = new Set(
    (currentValue ?? "")
      .split(";")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
  const missingEntries = nextEntries.filter((entry) => !existingEntries.has(entry.toLowerCase()));
  if (missingEntries.length === 0) {
    return currentValue ?? "";
  }
  return [...missingEntries, currentValue].filter(Boolean).join(";");
}

export function findWindowsSdkLayout() {
  if (process.platform !== "win32") {
    return null;
  }

  const candidateRoots = [
    "C:\\Program Files (x86)\\Windows Kits\\10\\Lib",
    "C:\\Program Files\\Windows Kits\\10\\Lib",
  ];

  for (const root of candidateRoots) {
    if (!fs.existsSync(root)) {
      continue;
    }

    const versions = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" })
      );

    for (const version of versions) {
      const versionRoot = path.join(root, version);
      const umLibPath = path.join(versionRoot, "um", "x64");
      const ucrtLibPath = path.join(versionRoot, "ucrt", "x64");
      const kernel32LibPath = path.join(umLibPath, "kernel32.lib");
      if (!fs.existsSync(kernel32LibPath)) {
        continue;
      }

      const includeRoot = versionRoot.replace(`${path.sep}Lib${path.sep}${version}`, "");
      const includePaths = [
        path.join(includeRoot, "Include", version, "ucrt"),
        path.join(includeRoot, "Include", version, "shared"),
        path.join(includeRoot, "Include", version, "um"),
        path.join(includeRoot, "Include", version, "winrt"),
        path.join(includeRoot, "Include", version, "cppwinrt"),
      ].filter((candidatePath) => fs.existsSync(candidatePath));

      return {
        version,
        kernel32LibPath,
        libPaths: [umLibPath, ucrtLibPath].filter((candidatePath) => fs.existsSync(candidatePath)),
        includePaths,
      };
    }
  }

  return null;
}

export function hasWindowsCommand(command, { repoRoot = process.cwd(), env = process.env } = {}) {
  if (process.platform !== "win32") {
    return false;
  }

  const result = spawnSync("where.exe", [command], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0;
}

export function loadWindowsMsvcEnv({ repoRoot = process.cwd() } = {}) {
  if (process.platform !== "win32") {
    return null;
  }

  if (hasWindowsCommand("link", { repoRoot })) {
    return null;
  }

  const vcvarsPath = findWindowsVcvarsPath({ repoRoot });
  if (!vcvarsPath) {
    return null;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hypecode-vcvars-"));
  const scriptPath = path.join(tempDir, "print-msvc-env.cmd");
  fs.writeFileSync(
    scriptPath,
    `@echo off\r\ncall "${vcvarsPath}" >nul\r\nif errorlevel 1 exit /b 1\r\nset\r\n`,
    "utf8"
  );

  let result;
  try {
    result = spawnSync("cmd.exe", ["/d", "/c", scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const env = {};
  for (const line of result.stdout.split(/\r?\n/u)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }
    env[key] = line.slice(separatorIndex + 1);
  }

  const windowsSdkLayout = findWindowsSdkLayout();
  if (windowsSdkLayout) {
    env.LIB = prependMissingPathEntries(env.LIB ?? "", windowsSdkLayout.libPaths);
    env.LIBPATH = prependMissingPathEntries(env.LIBPATH ?? "", windowsSdkLayout.libPaths);
    env.INCLUDE = prependMissingPathEntries(env.INCLUDE ?? "", windowsSdkLayout.includePaths);
  }

  return Object.keys(env).length > 0 ? env : null;
}

export function listInstalledRustTargets({ repoRoot = process.cwd(), env = process.env } = {}) {
  const result = spawnSync("rustup", ["target", "list", "--installed"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildWindowsPowerShellCandidates(env = process.env) {
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (candidate) => {
    if (!candidate || seen.has(candidate.toLowerCase())) {
      return;
    }
    seen.add(candidate.toLowerCase());
    candidates.push(candidate);
  };

  const programFiles = env.ProgramFiles;
  const programW6432 = env.ProgramW6432;
  if (programFiles) {
    pushCandidate(path.join(programFiles, "PowerShell", "7", "pwsh.exe"));
  }
  if (programW6432) {
    pushCandidate(path.join(programW6432, "PowerShell", "7", "pwsh.exe"));
  }
  pushCandidate(LEGACY_WINDOWS_POWERSHELL_PATH);
  pushCandidate("pwsh.exe");
  pushCandidate("pwsh");
  pushCandidate("powershell.exe");
  pushCandidate("powershell");
  return candidates;
}

export function findWindowsPowershellExecutable({
  repoRoot = process.cwd(),
  env = process.env,
} = {}) {
  if (process.platform !== "win32") {
    return null;
  }

  for (const candidate of buildWindowsPowerShellCandidates(env)) {
    if (candidate.endsWith(".exe") && fs.existsSync(candidate)) {
      return candidate;
    }
    if (hasWindowsCommand(candidate, { repoRoot, env })) {
      return candidate;
    }
  }

  return null;
}

export function findWindowsWebView2Runtime(env = process.env) {
  if (process.platform !== "win32") {
    return null;
  }

  const candidateBases = [env["ProgramFiles(x86)"], env.ProgramFiles, env.LOCALAPPDATA].filter(
    Boolean
  );

  for (const basePath of candidateBases) {
    const applicationRoot = path.join(basePath, "Microsoft", "EdgeWebView", "Application");
    if (!fs.existsSync(applicationRoot)) {
      continue;
    }

    const versions = fs
      .readdirSync(applicationRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true, sensitivity: "base" })
      );

    for (const version of versions) {
      const executablePath = path.join(applicationRoot, version, "msedgewebview2.exe");
      if (fs.existsSync(executablePath)) {
        return {
          version,
          executablePath,
        };
      }
    }
  }

  return null;
}
