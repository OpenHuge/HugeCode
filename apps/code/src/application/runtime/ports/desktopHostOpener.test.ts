import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetDesktopHostOpenerForTests,
  __setDesktopHostOpenerLoaderForTests,
  openDesktopCompatibilityPath,
  openDesktopCompatibilityUrl,
  revealDesktopCompatibilityItemInDir,
} from "./desktopHostOpener";

describe("desktopHostOpener", () => {
  beforeEach(() => {
    __resetDesktopHostOpenerForTests();
  });

  it("opens urls through the desktop host opener when available", async () => {
    const openExternalUrl = vi.fn(async () => undefined);
    __setDesktopHostOpenerLoaderForTests(async () => ({
      openUrl: openExternalUrl,
      revealItemInDir: vi.fn(async () => undefined),
    }));

    await expect(openDesktopCompatibilityUrl("https://example.com")).resolves.toBe(true);

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
  });

  it("reveals items through the desktop host opener when available", async () => {
    const openExternalUrl = vi.fn(async () => undefined);
    const openPath = vi.fn(async () => undefined);
    const revealItem = vi.fn(async () => undefined);
    __setDesktopHostOpenerLoaderForTests(async () => ({
      openPath,
      openUrl: openExternalUrl,
      revealItemInDir: revealItem,
    }));

    await expect(openDesktopCompatibilityPath("/tmp/hugecode/logs")).resolves.toBe(true);
    await expect(revealDesktopCompatibilityItemInDir("/tmp/workspace")).resolves.toBe(true);

    expect(openPath).toHaveBeenCalledWith("/tmp/hugecode/logs");
    expect(revealItem).toHaveBeenCalledWith("/tmp/workspace");
  });
  it("returns false for open urls when the desktop host opener is unavailable", async () => {
    __setDesktopHostOpenerLoaderForTests(async () => {
      throw new Error("unavailable");
    });

    await expect(openDesktopCompatibilityUrl("https://example.com")).resolves.toBe(false);
  });

  it("returns false when reveal-in-directory has no available desktop host opener", async () => {
    __setDesktopHostOpenerLoaderForTests(async () => {
      throw new Error("unavailable");
    });

    await expect(openDesktopCompatibilityPath("/tmp/hugecode/logs")).resolves.toBe(false);
    await expect(revealDesktopCompatibilityItemInDir("/tmp/workspace")).resolves.toBe(false);
  });
});
