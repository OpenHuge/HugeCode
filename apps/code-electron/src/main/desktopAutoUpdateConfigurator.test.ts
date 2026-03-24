import { describe, expect, it, vi } from "vitest";
import { UpdateSourceType } from "update-electron-app";
import {
  buildStaticUpdateBaseUrl,
  createDesktopAutoUpdateConfigurator,
  normalizeStaticUpdateBaseUrlRoot,
  resolveDesktopAutoUpdateStrategy,
  resolveGitHubRepositorySlug,
} from "./desktopAutoUpdateConfigurator.js";

describe("desktopAutoUpdateConfigurator", () => {
  it("resolves GitHub repository slugs from canonical repository URLs", () => {
    expect(resolveGitHubRepositorySlug("https://github.com/OpenHuge/HugeCode")).toBe(
      "OpenHuge/HugeCode"
    );
    expect(resolveGitHubRepositorySlug("https://github.com/OpenHuge/HugeCode.git")).toBe(
      "OpenHuge/HugeCode"
    );
    expect(resolveGitHubRepositorySlug("https://example.com/OpenHuge/HugeCode")).toBeNull();
  });

  it("normalizes static update feed roots and per-platform feed urls", () => {
    expect(normalizeStaticUpdateBaseUrlRoot("https://downloads.example.com/hugecode/beta/")).toBe(
      "https://downloads.example.com/hugecode/beta"
    );
    expect(
      normalizeStaticUpdateBaseUrlRoot("ftp://downloads.example.com/hugecode/beta")
    ).toBeNull();
    expect(
      buildStaticUpdateBaseUrl("https://downloads.example.com/hugecode/beta", "darwin", "arm64")
    ).toBe("https://downloads.example.com/hugecode/beta/darwin/arm64");
  });

  it("keeps beta updates manual unless a static feed is configured", () => {
    expect(
      resolveDesktopAutoUpdateStrategy({
        arch: "x64",
        channel: "beta",
        isPackaged: true,
        platform: "darwin",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
        staticUpdateBaseUrl: null,
      })
    ).toEqual({
      capability: "manual",
      message:
        "Beta builds update manually from GitHub Releases unless HUGECODE_ELECTRON_UPDATE_BASE_URL is configured.",
      mode: "disabled_beta_manual",
      provider: "none",
    });
  });

  it("uses the public GitHub update service for stable packaged releases", () => {
    expect(
      resolveDesktopAutoUpdateStrategy({
        arch: "x64",
        channel: "stable",
        isPackaged: true,
        platform: "darwin",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
        staticUpdateBaseUrl: null,
      })
    ).toEqual({
      capability: "automatic",
      githubRepo: "OpenHuge/HugeCode",
      message: "Automatic stable updates are enabled through the public Electron update service.",
      mode: "enabled_stable_public_service",
      provider: "public-github",
    });
  });

  it("uses a static feed for packaged beta releases when configured", () => {
    expect(
      resolveDesktopAutoUpdateStrategy({
        arch: "arm64",
        channel: "beta",
        isPackaged: true,
        platform: "darwin",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
        staticUpdateBaseUrl: "https://downloads.example.com/hugecode/beta/",
      })
    ).toEqual({
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      staticFeedBaseUrl: "https://downloads.example.com/hugecode/beta/darwin/arm64",
    });
  });

  it("fails soft for invalid static beta feed configuration", () => {
    expect(
      resolveDesktopAutoUpdateStrategy({
        arch: "x64",
        channel: "beta",
        isPackaged: true,
        platform: "win32",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
        staticUpdateBaseUrl: "file:///tmp/hugecode-updates",
      })
    ).toEqual({
      capability: "manual",
      message:
        "Beta auto-update is disabled because HUGECODE_ELECTRON_UPDATE_BASE_URL must be an absolute http(s) URL.",
      mode: "misconfigured",
      provider: "none",
    });
  });

  it("disables real auto-updates in unpackaged flows and during squirrel first run", () => {
    expect(
      resolveDesktopAutoUpdateStrategy({
        arch: "x64",
        channel: "stable",
        isPackaged: false,
        platform: "darwin",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
        staticUpdateBaseUrl: null,
      })
    ).toMatchObject({
      capability: "manual",
      mode: "disabled_unpacked",
      provider: "none",
    });

    expect(
      resolveDesktopAutoUpdateStrategy({
        arch: "x64",
        channel: "stable",
        isPackaged: true,
        platform: "win32",
        processArgv: ["HugeCode.exe", "--squirrel-firstrun"],
        repoUrl: "https://github.com/OpenHuge/HugeCode",
        staticUpdateBaseUrl: null,
      })
    ).toMatchObject({
      capability: "manual",
      mode: "disabled_first_run_lock",
      provider: "none",
    });
  });

  it("configures a static beta feed exactly once and logs the selected mode", () => {
    const updateElectronAppImpl = vi.fn();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const configurator = createDesktopAutoUpdateConfigurator({
      arch: "x64",
      channel: "beta",
      isPackaged: true,
      logger,
      platform: "win32",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      staticUpdateBaseUrl: "https://downloads.example.com/hugecode/beta",
      updateElectronAppImpl,
    });

    expect(configurator.initialize()).toBe(true);
    expect(configurator.initialize()).toBe(true);
    expect(updateElectronAppImpl).toHaveBeenCalledTimes(1);
    expect(updateElectronAppImpl).toHaveBeenCalledWith({
      notifyUser: false,
      updateSource: {
        baseUrl: "https://downloads.example.com/hugecode/beta/win32/x64",
        type: UpdateSourceType.StaticStorage,
      },
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('"mode":"enabled_beta_static_feed"')
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs misconfiguration without initializing a provider", () => {
    const updateElectronAppImpl = vi.fn();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const configurator = createDesktopAutoUpdateConfigurator({
      arch: "x64",
      channel: "stable",
      isPackaged: true,
      logger,
      platform: "darwin",
      repoUrl: "https://example.com/OpenHuge/HugeCode",
      staticUpdateBaseUrl: null,
      updateElectronAppImpl,
    });

    expect(configurator.initialize()).toBe(false);
    expect(updateElectronAppImpl).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('"mode":"misconfigured"'));
  });

  it("fails soft and logs provider initialization failures", () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const configurator = createDesktopAutoUpdateConfigurator({
      arch: "x64",
      channel: "stable",
      isPackaged: true,
      logger,
      platform: "darwin",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      updateElectronAppImpl: vi.fn(() => {
        throw new Error("missing runtime dependency");
      }),
    });

    expect(configurator.initialize()).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"event":"desktop_updater_initialization_failed"')
    );
  });
});
