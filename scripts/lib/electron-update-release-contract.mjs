import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function listAsarPackageEntries(asarPath) {
  try {
    const { listPackage } = await import("@electron/asar");
    return listPackage(asarPath);
  } catch (error) {
    throw new Error(
      "Missing @electron/asar dependency required by Electron release-contract verification. Run pnpm install so root release scripts can inspect packaged app.asar outputs.",
      { cause: error }
    );
  }
}

function normalizeStaticUpdateBaseUrlRoot(staticUpdateBaseUrl) {
  const trimmed = staticUpdateBaseUrl?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return trimmed.replace(/\/+$/u, "");
  } catch {
    return null;
  }
}

function buildStaticUpdateBaseUrl(rootBaseUrl, platform, arch) {
  return `${rootBaseUrl.replace(/\/+$/u, "")}/${platform}/${arch}`;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listRelativeFiles(rootDir, prefix = "") {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = resolve(rootDir, entry.name);
      if (entry.isDirectory()) {
        return listRelativeFiles(absolutePath, relativePath);
      }

      return [relativePath];
    })
  );

  return files.flat();
}

async function findFirstRelativeFile(rootDir, matcher) {
  const relativeFiles = await listRelativeFiles(rootDir);
  return relativeFiles.find((file) => matcher(file)) ?? null;
}

function isLocalDebMakerName(makerName) {
  return (
    makerName === "deb" ||
    (typeof makerName === "string" && /(?:^|[\\/])scripts[\\/]maker-deb\.cjs$/u.test(makerName))
  );
}

export function normalizeElectronPackagedEntryPath(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

export function isElectronPackagedAppAsarPath(relativePath) {
  return /(?:^|\/)resources\/app\.asar$/iu.test(normalizeElectronPackagedEntryPath(relativePath));
}

export async function loadElectronReleaseContract(repoRoot) {
  const forgeConfigPath = resolve(repoRoot, "apps/code-electron/forge.config.mjs");
  const packageJsonPath = resolve(repoRoot, "apps/code-electron/package.json");
  const { default: forgeConfig } = await import(pathToFileURL(forgeConfigPath).href);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const releaseChannel = process.env.HUGECODE_ELECTRON_RELEASE_CHANNEL?.trim() || "beta";
  const staticUpdateBaseUrlRoot = normalizeStaticUpdateBaseUrlRoot(
    process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL
  );
  const betaStaticFeedUrl =
    releaseChannel === "beta" && staticUpdateBaseUrlRoot
      ? buildStaticUpdateBaseUrl(staticUpdateBaseUrlRoot, process.platform, process.arch)
      : null;
  const updateMode =
    releaseChannel === "stable"
      ? "enabled_stable_public_service"
      : betaStaticFeedUrl
        ? "enabled_beta_static_feed"
        : "disabled_beta_manual";
  const provider =
    updateMode === "enabled_stable_public_service"
      ? "public-github"
      : updateMode === "enabled_beta_static_feed"
        ? "static-storage"
        : "none";

  return {
    betaStaticFeedUrl,
    forgeConfig,
    packageJson,
    provider,
    releaseChannel,
    staticUpdateBaseUrlRoot,
    updateMode,
  };
}

export async function verifyElectronPackagedUpdaterRuntime(repoRoot) {
  const outDir = resolve(repoRoot, "apps/code-electron/out");
  const appAsarRelativePath = await findFirstRelativeFile(outDir, isElectronPackagedAppAsarPath);
  if (!appAsarRelativePath) {
    throw new Error("Missing packaged Electron app.asar output under apps/code-electron/out.");
  }

  const appAsarPath = resolve(outDir, appAsarRelativePath);
  const packageEntries = (await listAsarPackageEntries(appAsarPath)).map(
    normalizeElectronPackagedEntryPath
  );
  const hasUpdateElectronApp = packageEntries.includes(
    "/node_modules/update-electron-app/package.json"
  );
  if (!hasUpdateElectronApp) {
    throw new Error(
      "Packaged Electron app.asar is missing node_modules/update-electron-app/package.json."
    );
  }
  const hasBundledElectron = packageEntries.includes("/node_modules/electron/package.json");
  if (hasBundledElectron) {
    throw new Error("Packaged Electron app.asar must not bundle node_modules/electron.");
  }

  return {
    appAsarPath,
    bundledElectronPresent: false,
    packagedUpdaterRuntimePresent: true,
  };
}

export async function verifyElectronMakeArtifacts(repoRoot) {
  const makeDir = resolve(repoRoot, "apps/code-electron/out/make");
  const files = await listRelativeFiles(makeDir);
  if (files.length === 0) {
    throw new Error("Missing Electron make output under apps/code-electron/out/make.");
  }

  if (process.platform === "darwin") {
    if (!files.some((file) => file.endsWith(".dmg"))) {
      throw new Error("Missing macOS DMG artifact in apps/code-electron/out/make.");
    }
    if (
      !files.some((file) => file.startsWith(`zip/darwin/${process.arch}/`) && file.endsWith(".zip"))
    ) {
      throw new Error(
        `Missing macOS ZIP update artifact under apps/code-electron/out/make/zip/darwin/${process.arch}.`
      );
    }
  }

  if (process.platform === "win32") {
    if (!files.some((file) => file.endsWith(".exe"))) {
      throw new Error(
        "Missing Windows Squirrel setup .exe artifact in apps/code-electron/out/make."
      );
    }
    if (!files.some((file) => file.endsWith(".nupkg"))) {
      throw new Error("Missing Windows Squirrel .nupkg artifact in apps/code-electron/out/make.");
    }
    if (!files.some((file) => file.endsWith("/RELEASES") || file === "RELEASES")) {
      throw new Error("Missing Windows Squirrel RELEASES metadata in apps/code-electron/out/make.");
    }
  }

  if (process.platform === "linux" && !files.some((file) => file.endsWith(".deb"))) {
    throw new Error("Missing Linux .deb artifact in apps/code-electron/out/make.");
  }

  return {
    files,
  };
}

export function verifyElectronForgeUpdateContract(context) {
  const makerNames = new Set((context.forgeConfig.makers ?? []).map((maker) => maker.name));
  const githubPublisher = (context.forgeConfig.publishers ?? []).find(
    (publisher) => publisher.name === "@electron-forge/publisher-github"
  );
  if (!githubPublisher) {
    throw new Error("Missing GitHub publisher in Electron Forge config.");
  }

  const requiredMakerGroups = [
    ["@electron-forge/maker-zip"],
    ["@electron-forge/maker-dmg"],
    ["@electron-forge/maker-squirrel"],
    ["@electron-forge/maker-deb", "local-maker-deb"],
  ];

  for (const acceptedMakerNames of requiredMakerGroups) {
    const hasAcceptedMaker = acceptedMakerNames.some((makerName) =>
      makerName === "local-maker-deb"
        ? [...makerNames].some((configuredMakerName) => isLocalDebMakerName(configuredMakerName))
        : makerNames.has(makerName)
    );
    if (!hasAcceptedMaker) {
      throw new Error(
        `Missing required Electron Forge maker. Expected one of: ${acceptedMakerNames.join(", ")}`
      );
    }
  }

  if (
    typeof context.packageJson.repository?.url !== "string" ||
    !context.packageJson.repository.url.includes("OpenHuge/HugeCode")
  ) {
    throw new Error("Electron package.json repository metadata must point to OpenHuge/HugeCode.");
  }

  const expectedPublisherPrerelease = context.releaseChannel !== "stable";
  if (githubPublisher.config?.prerelease !== expectedPublisherPrerelease) {
    throw new Error(
      `GitHub publisher prerelease=${String(
        githubPublisher.config?.prerelease
      )} does not match release channel ${context.releaseChannel}.`
    );
  }

  const zipMaker = context.forgeConfig.makers?.find(
    (maker) => maker.name === "@electron-forge/maker-zip"
  );
  const squirrelMaker = context.forgeConfig.makers?.find(
    (maker) => maker.name === "@electron-forge/maker-squirrel"
  );

  if (context.updateMode === "enabled_beta_static_feed") {
    if (zipMaker?.config?.macUpdateManifestBaseUrl !== context.betaStaticFeedUrl) {
      throw new Error(
        `ZIP maker macUpdateManifestBaseUrl must match beta static feed ${context.betaStaticFeedUrl}.`
      );
    }
    if (squirrelMaker?.config?.remoteReleases !== context.betaStaticFeedUrl) {
      throw new Error(
        `Squirrel remoteReleases must match beta static feed ${context.betaStaticFeedUrl}.`
      );
    }
  } else {
    if (zipMaker?.config?.macUpdateManifestBaseUrl) {
      throw new Error(
        "ZIP maker static update manifest must not be configured outside beta static-feed mode."
      );
    }
    if (squirrelMaker?.config?.remoteReleases) {
      throw new Error(
        "Squirrel remoteReleases must not be configured outside beta static-feed mode."
      );
    }
  }

  return {
    expectedPublisherPrerelease,
  };
}
