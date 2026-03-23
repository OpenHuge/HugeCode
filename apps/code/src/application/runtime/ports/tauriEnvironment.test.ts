import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetTauriRuntimeEnvironmentForTests,
  __setTauriModuleLoaderForTests,
  detectDesktopRuntimeHost,
  detectTauriRuntime,
  openExternalUrlWithFallback,
  resolveAppVersion,
  resolveCurrentDesktopSession,
  resolveWindowLabel,
  showDesktopNotification,
} from "./tauriEnvironment";

describe("tauriRuntimeEnvironment", () => {
  beforeEach(() => {
    __resetTauriRuntimeEnvironmentForTests();
    delete window.hugeCodeDesktopHost;
    window.open = vi.fn(() => window) as typeof window.open;
  });

  it("prefers the Electron desktop host bridge when it is present", async () => {
    window.hugeCodeDesktopHost = {
      kind: "electron",
      app: {
        getVersion: async () => "41.0.3",
      },
      session: {
        getCurrentSession: async () => ({
          id: "session-review",
          windowLabel: "main",
          workspacePath: "/workspace/review",
          workspaceLabel: "review",
          preferredBackendId: "backend-1",
          runtimeMode: "remote",
          lastActiveAt: "2026-03-23T03:00:00.000Z",
        }),
      },
      window: {
        getLabel: async () => "review",
      },
      notifications: {
        show: async () => true,
      },
      shell: {
        openExternalUrl: async () => true,
      },
    };

    await expect(detectDesktopRuntimeHost()).resolves.toBe("electron");
    await expect(detectTauriRuntime()).resolves.toBe(false);
    await expect(resolveAppVersion()).resolves.toBe("41.0.3");
    await expect(resolveCurrentDesktopSession()).resolves.toMatchObject({
      id: "session-review",
      workspaceLabel: "review",
    });
    await expect(resolveWindowLabel("main")).resolves.toBe("review");
    await expect(
      showDesktopNotification({
        title: "Build complete",
        body: "Workspace review is ready.",
      })
    ).resolves.toBe(true);
    await expect(openExternalUrlWithFallback("https://example.com")).resolves.toBe(true);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("falls back when the Tauri module loader fails", async () => {
    __setTauriModuleLoaderForTests(async () => {
      throw new Error("module unavailable");
    });

    await expect(detectTauriRuntime()).resolves.toBe(false);
    await expect(resolveAppVersion()).resolves.toBeNull();
    await expect(resolveCurrentDesktopSession()).resolves.toBeNull();
    await expect(resolveWindowLabel("workspace")).resolves.toBe("workspace");
    await expect(showDesktopNotification({ title: "Example" })).resolves.toBe(false);
    await expect(openExternalUrlWithFallback("https://example.com")).resolves.toBe(true);
    expect(window.open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    );
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
    await expect(resolveAppVersion()).resolves.toBe("9.9.9");
    await expect(resolveCurrentDesktopSession()).resolves.toBeNull();
    await expect(resolveWindowLabel("main")).resolves.toBe("about");
    await expect(showDesktopNotification({ title: "No bridge" })).resolves.toBe(false);
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
