import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const requireFromHere = createRequire(import.meta.url);

async function loadAsarModule() {
  try {
    return await import("@electron/asar");
  } catch (error) {
    throw new Error(
      "Missing @electron/asar dependency required by Electron release-contract verification. Run pnpm install so root release scripts can inspect packaged app.asar outputs.",
      { cause: error }
    );
  }
}

function loadElectronFuses() {
  try {
    return requireFromHere("@electron/fuses");
  } catch (error) {
    throw new Error(
      "Missing @electron/fuses dependency required by Electron release-contract verification.",
      { cause: error }
    );
  }
}

async function listAsarPackageEntries(asarPath) {
  const { listPackage } = await loadAsarModule();
  return listPackage(asarPath);
}

export function createAsarExtractionCandidates(relativePath) {
  const normalizedPath = String(relativePath).replaceAll("\\", "/").replace(/^\/+/u, "");
  return Array.from(
    new Set([
      normalizedPath,
      `/${normalizedPath}`,
      normalizedPath.replaceAll("/", "\\"),
      `\\${normalizedPath.replaceAll("/", "\\")}`,
    ])
  );
}

async function resolveAsarArchiveEntryPath(asarPath, relativePath) {
  const requestedPath = String(relativePath).replaceAll("\\", "/").replace(/^\/+/u, "");
  const normalizedEntries = (await listAsarPackageEntries(asarPath)).map((entryPath) => ({
    normalizedPath: normalizeAsarPackageEntryPath(entryPath),
    rawPath: String(entryPath),
  }));
  const matchedEntry = normalizedEntries.find((entry) => {
    const normalizedEntryPath = entry.normalizedPath.replace(/^\/+/u, "");
    return normalizedEntryPath === requestedPath;
  });

  return matchedEntry?.rawPath ?? null;
}

async function extractAsarTextFile(asarPath, relativePath) {
  const { extractFile } = await loadAsarModule();
  const resolvedArchiveEntryPath = await resolveAsarArchiveEntryPath(asarPath, relativePath);
  const extractionCandidates = [
    ...createAsarExtractionCandidates(relativePath),
    ...(resolvedArchiveEntryPath ? [resolvedArchiveEntryPath] : []),
  ];
  let lastError = null;

  for (const candidatePath of extractionCandidates) {
    try {
      return extractFile(asarPath, candidatePath).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`"${relativePath}" was not found in this archive`, {
    cause: lastError,
  });
}

export function normalizeAsarPackageEntryPath(entryPath) {
  return String(entryPath).replaceAll("\\", "/");
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
  return normalizeAsarPackageEntryPath(relativePath);
}

async function findElectronPackagedAppAsarPath(repoRoot) {
  const outDir = resolve(repoRoot, "apps/code-electron/out");
  const appAsarRelativePath = await findFirstRelativeFile(outDir, isElectronPackagedAppAsarPath);
  if (!appAsarRelativePath) {
    throw new Error("Missing packaged Electron app.asar output under apps/code-electron/out.");
  }

  return {
    appAsarPath: resolve(outDir, appAsarRelativePath),
    appAsarRelativePath,
  };
}

function normalizeFuseBoolean(value) {
  if (value === true || value === "1" || value === 49) {
    return true;
  }
  if (value === false || value === "0" || value === 48) {
    return false;
  }
  return null;
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
  const { appAsarPath } = await findElectronPackagedAppAsarPath(repoRoot);
  const packageEntries = (await listAsarPackageEntries(appAsarPath)).map(
    normalizeAsarPackageEntryPath
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

export async function verifyElectronPackagedRendererTransport(repoRoot) {
  const { appAsarPath } = await findElectronPackagedAppAsarPath(repoRoot);
  const createDesktopMainCompositionModule = await extractAsarTextFile(
    appAsarPath,
    "dist-electron/main/createDesktopMainComposition.js"
  );
  const desktopAppProtocolModule = await extractAsarTextFile(
    appAsarPath,
    "dist-electron/main/desktopAppProtocol.js"
  );
  const desktopRendererTrustModule = await extractAsarTextFile(
    appAsarPath,
    "dist-electron/main/desktopRendererTrust.js"
  );

  if (createDesktopMainCompositionModule.includes("loadFile(")) {
    throw new Error(
      "Packaged Electron main composition still references loadFile(...). HugeCode must load packaged renderer content through hugecode-app://."
    );
  }
  if (!createDesktopMainCompositionModule.includes("createDesktopAppRendererUrl(")) {
    throw new Error(
      "Packaged Electron main composition must build packaged renderer entry URLs through createDesktopAppRendererUrl()."
    );
  }
  if (!desktopAppProtocolModule.includes('DESKTOP_APP_PROTOCOL_SCHEME = "hugecode-app"')) {
    throw new Error(
      "Packaged Electron app.asar is missing the internal hugecode-app protocol scheme constant."
    );
  }
  if (!desktopAppProtocolModule.includes("registerSchemesAsPrivileged")) {
    throw new Error(
      "Packaged Electron app.asar is missing privileged renderer protocol registration."
    );
  }
  if (desktopRendererTrustModule.includes('parsedUrl.protocol === "file:"')) {
    throw new Error(
      "Packaged Electron renderer trust must not treat file:// origins as trusted renderer content."
    );
  }

  return {
    appAsarPath,
    rendererTransport: "hugecode-app://app/index.html",
  };
}

export async function verifyElectronPackagedAppIntegrity(repoRoot) {
  const outDir = resolve(repoRoot, "apps/code-electron/out");

  if (process.platform === "darwin") {
    const macExecutableRelativePath = await findFirstRelativeFile(outDir, (relativePath) =>
      /(?:^|\/)HugeCode\.app\/Contents\/MacOS\/HugeCode$/u.test(relativePath)
    );
    if (!macExecutableRelativePath) {
      throw new Error("Missing packaged HugeCode macOS executable under apps/code-electron/out.");
    }

    const frameworkBinaryRelativePath = await findFirstRelativeFile(outDir, (relativePath) =>
      /(?:^|\/)HugeCode\.app\/Contents\/Frameworks\/Electron Framework\.framework\/Electron Framework$/u.test(
        relativePath
      )
    );
    if (!frameworkBinaryRelativePath) {
      throw new Error(
        "Missing packaged Electron Framework binary under apps/code-electron/out. Forge stage copies must not leave broken framework symlinks behind."
      );
    }

    return {
      appPath: resolve(
        outDir,
        macExecutableRelativePath.replace(/\/Contents\/MacOS\/HugeCode$/u, "")
      ),
      executablePath: resolve(outDir, macExecutableRelativePath),
      platform: "darwin",
    };
  }

  return {
    appPath: null,
    executablePath: null,
    platform: process.platform,
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
  if (context.packageJson.author !== "OpenHuge") {
    throw new Error('Electron package.json author must be "OpenHuge".');
  }
  if (context.packageJson.description !== "HugeCode beta desktop shell") {
    throw new Error('Electron package.json description must be "HugeCode beta desktop shell".');
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
  const debMaker = context.forgeConfig.makers?.find(
    (maker) => maker.name === "@electron-forge/maker-deb" || isLocalDebMakerName(maker.name)
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

  const debMakerConfig = debMaker?.config ?? debMaker?.configOrConfigFetcher ?? null;
  const debMakerOptions = debMakerConfig?.options ?? debMakerConfig;
  const debMakerBin = debMakerConfig?.bin ?? debMakerOptions?.bin ?? null;
  if (debMakerBin !== "HugeCode") {
    throw new Error('Deb maker options.bin must be "HugeCode" to match the packaged executable.');
  }
  if (squirrelMaker?.config?.authors !== "OpenHuge") {
    throw new Error('Squirrel maker authors must be "OpenHuge".');
  }
  if (squirrelMaker?.config?.description !== "HugeCode beta desktop shell") {
    throw new Error('Squirrel maker description must be "HugeCode beta desktop shell".');
  }

  return {
    expectedPublisherPrerelease,
  };
}

export function verifyElectronForgeFuseContract(context) {
  const { FuseV1Options, FuseVersion } = loadElectronFuses();
  const requiredForgeConfigDependencies = ["@electron-forge/plugin-fuses", "@electron/fuses"];
  for (const dependencyName of requiredForgeConfigDependencies) {
    const version = context.packageJson.devDependencies?.[dependencyName];
    if (typeof version !== "string" || version.startsWith("workspace:")) {
      throw new Error(
        `Electron Forge fuse support requires apps/code-electron/package.json devDependency ${dependencyName}.`
      );
    }
  }

  const fusesPlugin = (context.forgeConfig.plugins ?? []).find(
    (plugin) => plugin?.constructor?.name === "FusesPlugin" || plugin?.name === "fuses"
  );
  if (!fusesPlugin) {
    throw new Error("Missing Electron Forge fuses plugin in forge.config.mjs.");
  }

  const fuseConfig = fusesPlugin.fusesConfig ?? fusesPlugin.config ?? null;
  if (!fuseConfig) {
    throw new Error("Electron Forge fuses plugin is missing its fuse configuration payload.");
  }

  if (String(fuseConfig.version) !== String(FuseVersion.V1)) {
    throw new Error(`Electron Forge fuses plugin must use FuseVersion.V1.`);
  }

  const expectedFuseBooleans = {
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
  };

  for (const [fuseKey, expectedValue] of Object.entries(expectedFuseBooleans)) {
    const actualValue = normalizeFuseBoolean(fuseConfig[fuseKey]);
    if (actualValue !== expectedValue) {
      throw new Error(
        `Electron Forge fuse ${fuseKey} must be ${String(expectedValue)}, got ${String(fuseConfig[fuseKey])}.`
      );
    }
  }

  return {
    fuseConfig,
  };
}
