import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";

export function hasForgeOsxSignConfig(packagerConfig = {}) {
  const osxSignConfig = packagerConfig.osxSign;
  return osxSignConfig !== undefined && osxSignConfig !== false;
}

export function shouldRepairDarwinArm64Signature({ arch, hasOsxSignConfig = false, platform }) {
  return platform === "darwin" && arch === "arm64" && !hasOsxSignConfig;
}

export function resolveDarwinAppBundlePath(packageOutputPath, appName = "HugeCode") {
  if (packageOutputPath.endsWith(".app")) {
    return packageOutputPath.replaceAll("\\", "/");
  }

  return join(packageOutputPath, `${appName}.app`).replaceAll("\\", "/");
}

export async function resolveDarwinCodesignTargetPaths(appPath, dependencies = {}) {
  const accessImpl = dependencies.accessImpl ?? access;
  const normalizedAppPath = appPath.replaceAll("\\", "/");
  const frameworkExecutablePath = `${normalizedAppPath}/Contents/Frameworks/Electron Framework.framework/Electron Framework`;

  try {
    await accessImpl(frameworkExecutablePath);
  } catch {
    return [normalizedAppPath];
  }

  return [frameworkExecutablePath, normalizedAppPath];
}

async function runCodesign(arguments_, dependencies = {}) {
  const spawnImpl = dependencies.spawnImpl ?? spawn;

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawnImpl("codesign", arguments_, {
      shell: false,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`codesign ${arguments_.join(" ")} failed with exit code ${code ?? -1}`)
      );
    });
  });
}

export async function repairDarwinArm64Signature(appPath, dependencies = {}) {
  const logger = dependencies.logger ?? console;
  const targetPaths = await resolveDarwinCodesignTargetPaths(appPath, dependencies);

  logger.info?.(`Re-signing packaged macOS arm64 app bundle: ${appPath}`);
  logger.info?.(`Re-signing targets: ${targetPaths.join(", ")}`);

  for (const targetPath of targetPaths) {
    await runCodesign(
      [
        "--force",
        "--sign",
        "-",
        "--timestamp=none",
        ...(targetPath.endsWith(".app") ? ["--deep"] : []),
        targetPath,
      ],
      dependencies
    );
  }

  await runCodesign(["--verify", "--deep", "--strict", appPath], dependencies);
}
