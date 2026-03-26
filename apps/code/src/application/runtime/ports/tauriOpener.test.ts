import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetTauriOpenerForTests,
  __setTauriOpenerLoaderForTests,
  openTauriPath,
  openTauriUrl,
  revealTauriItemInDir,
} from "./tauriOpener";

describe("tauriOpener", () => {
  beforeEach(() => {
    __resetTauriOpenerForTests();
  });

  it("opens urls through the Tauri opener when available", async () => {
    const openExternalUrl = vi.fn(async () => undefined);
    __setTauriOpenerLoaderForTests(async () => ({
      openUrl: openExternalUrl,
      revealItemInDir: vi.fn(async () => undefined),
    }));

    await expect(openTauriUrl("https://example.com")).resolves.toBe(true);

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
  });

  it("reveals items through the Tauri opener when available", async () => {
    const openExternalUrl = vi.fn(async () => undefined);
    const openPath = vi.fn(async () => undefined);
    const revealItem = vi.fn(async () => undefined);
    __setTauriOpenerLoaderForTests(async () => ({
      openPath,
      openUrl: openExternalUrl,
      revealItemInDir: revealItem,
    }));

    await expect(openTauriPath("/tmp/hugecode/logs")).resolves.toBe(true);
    await expect(revealTauriItemInDir("/tmp/workspace")).resolves.toBe(true);

    expect(openPath).toHaveBeenCalledWith("/tmp/hugecode/logs");
    expect(revealItem).toHaveBeenCalledWith("/tmp/workspace");
  });
  it("returns false for open urls when the Tauri opener is unavailable", async () => {
    __setTauriOpenerLoaderForTests(async () => {
      throw new Error("unavailable");
    });

    await expect(openTauriUrl("https://example.com")).resolves.toBe(false);
  });

  it("returns false when reveal-in-directory has no available Tauri opener", async () => {
    __setTauriOpenerLoaderForTests(async () => {
      throw new Error("unavailable");
    });

    await expect(openTauriPath("/tmp/hugecode/logs")).resolves.toBe(false);
    await expect(revealTauriItemInDir("/tmp/workspace")).resolves.toBe(false);
  });
});
