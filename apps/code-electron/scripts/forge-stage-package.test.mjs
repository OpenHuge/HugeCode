import { describe, expect, it } from "vitest";
import {
  FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES,
  createForgeStagePackageJson,
  shouldInstallForgeStageDependencies,
} from "./forge-stage-package.mjs";

describe("forge stage package helpers", () => {
  it("keeps runtime deps and config-time forge deps in the staged package", () => {
    const stagedPackageJson = createForgeStagePackageJson({
      dependencies: {
        "@ku0/code-platform-interfaces": "workspace:*",
        "update-electron-app": "3.1.2",
      },
      devDependencies: {
        "@electron-forge/plugin-fuses": "^7.10.2",
        "@electron/fuses": "^1.8.0",
        electron: "41.0.3",
        vitest: "^4.1.0",
      },
      repository: {
        type: "git",
        url: "https://github.com/OpenHuge/HugeCode.git",
      },
      version: "0.1.0",
    });

    expect(stagedPackageJson.dependencies).toEqual({
      "update-electron-app": "3.1.2",
    });
    expect(stagedPackageJson.devDependencies).toEqual({
      "@electron-forge/plugin-fuses": "^7.10.2",
      "@electron/fuses": "^1.8.0",
      electron: "41.0.3",
    });
    expect(stagedPackageJson.author).toBe("OpenHuge");
    expect(stagedPackageJson.productDescription).toBe("HugeCode beta desktop shell");
    expect(FORGE_STAGE_CONFIG_TIME_DEV_DEPENDENCIES).toContain("@electron-forge/plugin-fuses");
  });

  it("requires installation when a staged package only has config-time dev deps", () => {
    const stagedPackageJson = createForgeStagePackageJson({
      dependencies: {},
      devDependencies: {
        "@electron-forge/plugin-fuses": "^7.10.2",
        "@electron/fuses": "^1.8.0",
        electron: "41.0.3",
      },
      repository: {
        type: "git",
        url: "https://github.com/OpenHuge/HugeCode.git",
      },
      version: "0.1.0",
    });

    expect(shouldInstallForgeStageDependencies(stagedPackageJson)).toBe(true);
  });
});
