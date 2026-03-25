import { describe, expect, it } from "vitest";
import {
  isElectronPackagedAppAsarPath,
  verifyElectronForgeUpdateContract,
} from "../../scripts/lib/electron-update-release-contract.mjs";

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

describe("verifyElectronForgeUpdateContract", () => {
  it("accepts the repo-local deb maker as satisfying Linux packaging support", () => {
    expect(() =>
      verifyElectronForgeUpdateContract({
        forgeConfig: {
          makers: [
            { name: "@electron-forge/maker-zip", config: {} },
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
          repository: {
            url: "https://github.com/OpenHuge/HugeCode.git",
          },
        },
        releaseChannel: "beta",
        updateMode: "disabled_beta_manual",
      })
    ).not.toThrow();
  });

  it("accepts a repo-local deb maker instance when config is stored on configOrConfigFetcher", () => {
    expect(() =>
      verifyElectronForgeUpdateContract({
        forgeConfig: {
          makers: [
            { name: "@electron-forge/maker-zip", config: {} },
            { name: "@electron-forge/maker-dmg" },
            {
              name: "@electron-forge/maker-squirrel",
              config: {
                authors: "OpenHuge",
                description: "HugeCode beta desktop shell",
              },
            },
            {
              configOrConfigFetcher: {
                bin: "HugeCode",
                options: {
                  section: "devel",
                },
              },
              name: "deb",
            },
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
