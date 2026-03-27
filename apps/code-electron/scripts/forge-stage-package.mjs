const FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES = [
  "electron",
  "@electron-forge/plugin-fuses",
  "@electron/fuses",
  "@electron/osx-sign",
];

const WORKSPACE_PNPM_CONFIG_KEYS = ["overrides", "patchedDependencies"];

function isStageInstallableVersion(version) {
  return typeof version === "string" && !version.startsWith("workspace:");
}

function pickStageDependencies(dependencies = {}) {
  return Object.fromEntries(
    Object.entries(dependencies).filter(([, version]) => isStageInstallableVersion(version))
  );
}

function normalizeYamlScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseWorkspacePnpmConfigMap(workspaceConfigText, sectionName) {
  const lines = workspaceConfigText.split(/\r?\n/u);
  const sectionHeader = `${sectionName}:`;
  const sectionIndex = lines.findIndex((line) => line.trim() === sectionHeader);
  if (sectionIndex === -1) {
    return {};
  }

  const entries = {};
  for (const line of lines.slice(sectionIndex + 1)) {
    if (!line.startsWith("  ")) {
      break;
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizeYamlScalar(trimmed.slice(0, separatorIndex));
    const value = normalizeYamlScalar(trimmed.slice(separatorIndex + 1));
    if (key && value) {
      entries[key] = value;
    }
  }

  return entries;
}

export function createForgeStagePnpmConfig(workspaceConfigText) {
  if (typeof workspaceConfigText !== "string" || workspaceConfigText.trim().length === 0) {
    return undefined;
  }

  const stagePnpmConfig = {};
  for (const configKey of WORKSPACE_PNPM_CONFIG_KEYS) {
    const values = parseWorkspacePnpmConfigMap(workspaceConfigText, configKey);
    if (Object.keys(values).length > 0) {
      stagePnpmConfig[configKey] = values;
    }
  }

  if (stagePnpmConfig.patchedDependencies) {
    stagePnpmConfig.allowUnusedPatches = true;
  }

  return Object.keys(stagePnpmConfig).length > 0 ? stagePnpmConfig : undefined;
}

export function createForgeStagePackageJson(packageJson, stagePnpmConfig) {
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
    ...(stagePnpmConfig
      ? {
          pnpm: stagePnpmConfig,
        }
      : {}),
  };
}

export function shouldInstallForgeStageDependencies(stagedPackageJson) {
  return (
    Object.keys(stagedPackageJson.dependencies ?? {}).length > 0 ||
    Object.keys(stagedPackageJson.devDependencies ?? {}).length > 0
  );
}

export { FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES };
