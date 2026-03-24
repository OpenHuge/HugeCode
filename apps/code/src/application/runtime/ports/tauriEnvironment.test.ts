import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetTauriRuntimeEnvironmentForTests,
  __setTauriModuleLoaderForTests,
  detectTauriRuntime,
  openExternalUrlWithFallback,
  readTauriAppVersion,
  readTauriWindowLabel,
} from "./tauriEnvironment";

describe("tauriRuntimeEnvironment", () => {
  beforeEach(() => {
    __resetTauriRuntimeEnvironmentForTests();
    vi.restoreAllMocks();
    vi.spyOn(window, "open").mockReturnValue(null);
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

  it("rejects unsafe external URLs before invoking any opener", async () => {
    const openUrl = vi.fn(async () => undefined);
    __setTauriModuleLoaderForTests(async () => ({
      opener: {
        openUrl,
      },
    }));

    await expect(openExternalUrlWithFallback("javascript:alert(1)")).resolves.toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });
});
