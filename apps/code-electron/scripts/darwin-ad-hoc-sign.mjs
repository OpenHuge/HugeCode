import { createRequire } from "node:module";
import { join } from "node:path";

const requireFromHere = createRequire(import.meta.url);

function loadOsxSign() {
  try {
    return requireFromHere("@electron/osx-sign");
  } catch (error) {
    throw new Error("Missing @electron/osx-sign dependency required for macOS ad-hoc signing.", {
      cause: error,
    });
  }
}

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

export async function repairDarwinArm64Signature(appPath, dependencies = {}) {
  const sign = dependencies.signAsync ?? loadOsxSign().signAsync;
  const logger = dependencies.logger ?? console;

  logger.info?.(`Re-signing packaged macOS arm64 app bundle: ${appPath}`);

  await sign({
    app: appPath,
    identity: "-",
    identityValidation: false,
    platform: "darwin",
    preAutoEntitlements: false,
    strictVerify: true,
  });
}
