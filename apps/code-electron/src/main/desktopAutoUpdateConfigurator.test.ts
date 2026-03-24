import { describe, expect, it, vi } from "vitest";
import { UpdateSourceType } from "update-electron-app";
import {
  createDesktopAutoUpdateConfigurator,
  resolveDesktopAutoUpdateConfiguration,
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

  it("keeps beta updates manual unless a static feed is configured", () => {
    expect(
      resolveDesktopAutoUpdateConfiguration({
        channel: "beta",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
      })
    ).toBeNull();
  });

  it("uses the public GitHub update service for stable packaged releases", () => {
    expect(
      resolveDesktopAutoUpdateConfiguration({
        channel: "stable",
        repoUrl: "https://github.com/OpenHuge/HugeCode",
      })
    ).toEqual({
      kind: "public-github",
      repo: "OpenHuge/HugeCode",
    });
  });

  it("prefers an explicit static feed when one is configured", () => {
    const updateElectronAppImpl = vi.fn();
    const configurator = createDesktopAutoUpdateConfigurator({
      channel: "beta",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      staticUpdateBaseUrl: "https://downloads.example.com/hugecode/beta",
      updateElectronAppImpl,
    });

    expect(configurator.isAvailable).toBe(true);
    expect(configurator.initialize()).toBe(true);
    expect(updateElectronAppImpl).toHaveBeenCalledWith({
      notifyUser: false,
      updateSource: {
        baseUrl: "https://downloads.example.com/hugecode/beta",
        type: UpdateSourceType.StaticStorage,
      },
    });
  });

  it("configures public GitHub releases for stable builds", () => {
    const updateElectronAppImpl = vi.fn();
    const configurator = createDesktopAutoUpdateConfigurator({
      channel: "stable",
      repoUrl: "https://github.com/OpenHuge/HugeCode",
      updateElectronAppImpl,
    });

    expect(configurator.isAvailable).toBe(true);
    expect(configurator.initialize()).toBe(true);
    expect(updateElectronAppImpl).toHaveBeenCalledWith({
      notifyUser: false,
      updateSource: {
        repo: "OpenHuge/HugeCode",
        type: UpdateSourceType.ElectronPublicUpdateService,
      },
    });
  });
});
