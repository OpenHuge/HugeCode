import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetTauriRuntimeEnvironmentForTests,
  __setTauriModuleLoaderForTests,
  detectTauriRuntime,
  readTauriAppVersion,
  readTauriWindowLabel,
} from "./tauriEnvironment";

describe("tauriRuntimeEnvironment", () => {
  beforeEach(() => {
    __resetTauriRuntimeEnvironmentForTests();
  });

  it("falls back when the Tauri module loader fails", async () => {
    __setTauriModuleLoaderForTests(async () => {
      throw new Error("module unavailable");
    });

    await expect(detectTauriRuntime()).resolves.toBe(false);
    await expect(readTauriAppVersion()).resolves.toBeNull();
    await expect(readTauriWindowLabel()).resolves.toBeNull();
  });

  it("uses the loaded Tauri modules when they are available", async () => {
    __setTauriModuleLoaderForTests(async () => ({
      app: {
        getVersion: async () => "9.9.9",
      },
      core: {
        isTauri: () => true,
      },
      window: {
        getCurrentWindow: () => ({
          label: "about",
        }),
      },
    }));

    await expect(detectTauriRuntime()).resolves.toBe(true);
    await expect(readTauriAppVersion()).resolves.toBe("9.9.9");
    await expect(readTauriWindowLabel()).resolves.toBe("about");
  });
});
