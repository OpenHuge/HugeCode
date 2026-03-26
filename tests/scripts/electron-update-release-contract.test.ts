import { FuseV1Options } from "@electron/fuses";
import { describe, expect, it } from "vitest";
import {
  isElectronPackagedAppAsarPath,
  normalizeAsarPackageEntryPath,
  normalizeElectronPackagedEntryPath,
  verifyElectronForgeUpdateContract,
} from "../../scripts/lib/electron-update-release-contract.mjs";

describe("normalizeElectronPackagedEntryPath", () => {
  it("normalizes Windows-style packaged entry paths", () => {
    expect(
      normalizeElectronPackagedEntryPath(
        "HugeCode-win32-x64\\resources\\app.asar\\node_modules\\update-electron-app\\package.json"
      )
    ).toBe("HugeCode-win32-x64/resources/app.asar/node_modules/update-electron-app/package.json");
  });
});

describe("isElectronPackagedAppAsarPath", () => {
  it("matches the macOS packaged app layout", () => {
    expect(
      isElectronPackagedAppAsarPath("HugeCode-darwin-x64/HugeCode.app/Contents/Resources/app.asar")
    ).toBe(true);
  });

  it("matches the linux packaged app layout", () => {
    expect(isElectronPackagedAppAsarPath("HugeCode-linux-x64/resources/app.asar")).toBe(true);
  });

  it("matches the windows packaged app layout", () => {
    expect(isElectronPackagedAppAsarPath("HugeCode-win32-x64/resources/app.asar")).toBe(true);
    expect(isElectronPackagedAppAsarPath("HugeCode-win32-x64\\resources\\app.asar")).toBe(true);
  });

  it("rejects unrelated files under the out directory", () => {
    expect(
      isElectronPackagedAppAsarPath("HugeCode-darwin-x64/HugeCode.app/Contents/Resources/helper")
    ).toBe(false);
    expect(isElectronPackagedAppAsarPath("HugeCode-linux-x64/resources/default_app.asar")).toBe(
      false
    );
  });
});

describe("normalizeAsarPackageEntryPath", () => {
  it("normalizes Windows asar entry separators to POSIX style", () => {
    expect(normalizeAsarPackageEntryPath("\\node_modules\\update-electron-app\\package.json")).toBe(
      "/node_modules/update-electron-app/package.json"
    );
  });

  it("keeps POSIX-style asar entry separators untouched", () => {
    expect(normalizeAsarPackageEntryPath("/node_modules/update-electron-app/package.json")).toBe(
      "/node_modules/update-electron-app/package.json"
    );
  });
});

describe("verifyElectronForgeUpdateContract", () => {
  it("accepts the repo-local deb maker as satisfying Linux packaging support", () => {
    expect(() =>
      verifyElectronForgeUpdateContract({
        forgeConfig: {
          makers: [
            { name: "@electron-forge/maker-zip" },
            { name: "@electron-forge/maker-dmg" },
            {
              name: "@electron-forge/maker-squirrel",
              config: {
                authors: "OpenHuge",
                description: "HugeCode beta desktop shell",
              },
            },
            { name: "deb", config: { bin: "HugeCode" } },
          ],
          publishers: [
            {
              config: {
                prerelease: true,
              },
              name: "@electron-forge/publisher-github",
            },
          ],
        },
        packageJson: {
          author: "OpenHuge",
          description: "HugeCode beta desktop shell",
          repository: {
            url: "https://github.com/OpenHuge/HugeCode.git",
          },
        },
        releaseChannel: "beta",
        updateMode: "disabled_beta_manual",
      })
    ).not.toThrow();
  });
});

describe("Electron Forge fuse contract", () => {
  it("disables extra file:// privileges for packaged renderer content", async () => {
    const { default: forgeConfig } = await import("../../apps/code-electron/forge.config.mjs");
    const fusesPlugin = (forgeConfig.plugins ?? []).find(
      (plugin) => plugin?.constructor?.name === "FusesPlugin" || plugin?.name === "fuses"
    );
    const fuseConfig = fusesPlugin?.fusesConfig ?? fusesPlugin?.config ?? null;

    expect(fuseConfig?.[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(false);
  });
});
