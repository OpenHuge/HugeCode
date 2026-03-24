import { signAsync } from "@electron/osx-sign";

export function hasForgeOsxSignConfig(packagerConfig = {}) {
  const osxSignConfig = packagerConfig.osxSign;
  return osxSignConfig !== undefined && osxSignConfig !== false;
}

export function shouldRepairDarwinArm64Signature({ arch, hasOsxSignConfig = false, platform }) {
  return platform === "darwin" && arch === "arm64" && !hasOsxSignConfig;
}

export async function repairDarwinArm64Signature(appPath, dependencies = {}) {
  const sign = dependencies.signAsync ?? signAsync;
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
