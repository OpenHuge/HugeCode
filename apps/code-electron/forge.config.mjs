import MakerDeb from "./scripts/maker-deb.cjs";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

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

const releaseChannel = process.env.HUGECODE_ELECTRON_RELEASE_CHANNEL?.trim() || "beta";
const electronZipDir = process.env.HUGECODE_ELECTRON_ZIP_DIR?.trim() || null;
const staticUpdateBaseUrlRoot = normalizeStaticUpdateBaseUrlRoot(
  process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL
);
const productAuthor = "OpenHuge";
const productDescription = "HugeCode beta desktop shell";
const betaStaticUpdateBaseUrl =
  releaseChannel === "beta" && staticUpdateBaseUrlRoot
    ? buildStaticUpdateBaseUrl(staticUpdateBaseUrlRoot, process.platform, process.arch)
    : null;
const packagerConfig = {
  appBundleId: "com.openhuge.hugecode",
  asar: true,
  ...(electronZipDir
    ? {
        electronZipDir,
      }
    : {}),
  executableName: "HugeCode",
  name: "HugeCode",
  protocols: [
    {
      name: "HugeCode",
      schemes: ["hugecode"],
    },
  ],
};
export default {
  packagerConfig,
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: false,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
  makers: [
    {
      name: "@electron-forge/maker-zip",
      config: betaStaticUpdateBaseUrl
        ? {
            macUpdateManifestBaseUrl: betaStaticUpdateBaseUrl,
          }
        : undefined,
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        title: "HugeCode Beta",
      },
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        authors: productAuthor,
        description: productDescription,
        name: "HugeCode",
        authors: "OpenHuge",
        description: "HugeCode beta desktop shell",
        ...(betaStaticUpdateBaseUrl
          ? {
              remoteReleases: betaStaticUpdateBaseUrl,
            }
          : {}),
        setupExe: "HugeCodeSetup.exe",
      },
    },
    new MakerDeb({
      options: {
        bin: "HugeCode",
        categories: ["Development"],
        maintainer: "OpenHuge",
        mimeType: ["x-scheme-handler/hugecode"],
        productName: "HugeCode",
        productDescription: "HugeCode beta desktop shell",
        section: "devel",
      },
    }),
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        draft: false,
        prerelease: releaseChannel !== "stable",
        repository: {
          name: "HugeCode",
          owner: "OpenHuge",
        },
      },
    },
  ],
};
