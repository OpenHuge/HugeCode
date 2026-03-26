const FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES = [
  "electron",
  "@electron-forge/plugin-fuses",
  "@electron/fuses",
  "@electron/osx-sign",
];

function isStageInstallableVersion(version) {
  return typeof version === "string" && !version.startsWith("workspace:");
}

function pickStageDependencies(dependencies = {}) {
  return Object.fromEntries(
    Object.entries(dependencies).filter(([, version]) => isStageInstallableVersion(version))
  );
}

export function createForgeStagePackageJson(packageJson) {
  const runtimeDependencies = pickStageDependencies(packageJson.dependencies);
  const stagedDevDependencies = Object.fromEntries(
    FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES.map((dependencyName) => [
      dependencyName,
      packageJson.devDependencies?.[dependencyName],
    ]).filter(([, version]) => isStageInstallableVersion(version))
  );

  return {
    name: "hugecode",
    productName: "HugeCode",
    version: packageJson.version,
    type: "module",
    main: "dist-electron/main/main.js",
    repository: packageJson.repository,
    config: {
      forge: "./forge.config.mjs",
    },
    dependencies: runtimeDependencies,
    devDependencies: stagedDevDependencies,
  };
}

export function shouldInstallForgeStageDependencies(stagedPackageJson) {
  return (
    Object.keys(stagedPackageJson.dependencies ?? {}).length > 0 ||
    Object.keys(stagedPackageJson.devDependencies ?? {}).length > 0
  );
}

export { FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES };
