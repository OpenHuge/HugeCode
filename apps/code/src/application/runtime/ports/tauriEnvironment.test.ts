import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetTauriRuntimeEnvironmentForTests,
  __setTauriModuleLoaderForTests,
  detectTauriRuntime,
  openExternalUrlWithFallback,
  resolveAppVersion,
  resolveWindowLabel,
} from "./tauriEnvironment";

describe("tauriRuntimeEnvironment", () => {
  beforeEach(() => {
    __resetTauriRuntimeEnvironmentForTests();
    window.open = vi.fn(() => window) as typeof window.open;
  });

  it("falls back when the Tauri module loader fails", async () => {
    __setTauriModuleLoaderForTests(async () => {
      throw new Error("module unavailable");
    });

    await expect(detectTauriRuntime()).resolves.toBe(false);
    await expect(resolveAppVersion()).resolves.toBeNull();
    await expect(resolveWindowLabel("workspace")).resolves.toBe("workspace");
    await expect(openExternalUrlWithFallback("https://example.com")).resolves.toBe(true);
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("uses the loaded Tauri modules when they are available", async () => {
    const openUrl = vi.fn(async () => undefined);
    __setTauriModuleLoaderForTests(async () => ({
      app: {
        getVersion: async () => "9.9.9",
      },
      core: {
        isTauri: () => true,
      },
      opener: {
        openUrl,
      },
      window: {
        getCurrentWindow: () => ({
          label: "about",
        }),
      },
    }));

    await expect(detectTauriRuntime()).resolves.toBe(true);
    await expect(resolveAppVersion()).resolves.toBe("9.9.9");
    await expect(resolveWindowLabel("main")).resolves.toBe("about");
    await expect(openExternalUrlWithFallback("https://example.com")).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledWith("https://example.com");
    expect(window.open).not.toHaveBeenCalled();
  });

  it("returns false when neither Tauri nor browser fallback can open an external link", async () => {
    __setTauriModuleLoaderForTests(async () => ({
      opener: {
        openUrl: async () => {
          throw new Error("native opener unavailable");
        },
      },
    }));
    window.open = vi.fn(() => null) as typeof window.open;

    await expect(openExternalUrlWithFallback("https://example.com")).resolves.toBe(false);
  });
});
