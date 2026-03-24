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
const staticUpdateBaseUrlRoot = normalizeStaticUpdateBaseUrlRoot(
  process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL
);
const betaStaticUpdateBaseUrl =
  releaseChannel === "beta" && staticUpdateBaseUrlRoot
    ? buildStaticUpdateBaseUrl(staticUpdateBaseUrlRoot, process.platform, process.arch)
    : null;
export default {
  packagerConfig: {
    appBundleId: "com.openhuge.hugecode",
    asar: true,
    executableName: "HugeCode",
    name: "HugeCode",
    protocols: [
      {
        name: "HugeCode",
        schemes: ["hugecode"],
      },
    ],
  },
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
      [FuseV1Options.EnableCookieEncryption]: true,
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
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "HugeCode",
        ...(betaStaticUpdateBaseUrl
          ? {
              remoteReleases: betaStaticUpdateBaseUrl,
            }
          : {}),
        setupExe: "HugeCodeSetup.exe",
      },
    },
    new MakerDeb({
      bin: "HugeCode",
      options: {
        categories: ["Development"],
        maintainer: "OpenHuge",
        mimeType: ["x-scheme-handler/hugecode"],
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
