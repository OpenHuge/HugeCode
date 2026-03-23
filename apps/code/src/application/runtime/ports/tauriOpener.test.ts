import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetTauriOpenerForTests,
  __setTauriOpenerLoaderForTests,
  openUrl,
  revealItemInDir,
} from "./tauriOpener";

describe("tauriOpener", () => {
  beforeEach(() => {
    __resetTauriOpenerForTests();
    delete window.hugeCodeDesktopHost;
    window.open = vi.fn(() => window) as typeof window.open;
  });

  it("prefers the Electron host bridge for shell actions", async () => {
    const openExternalUrl = vi.fn(async () => true);
    const revealItem = vi.fn(async () => true);
    window.hugeCodeDesktopHost = {
      kind: "electron",
      shell: {
        openExternalUrl,
        revealItemInDir: revealItem,
      },
    };

    await openUrl("https://example.com");
    await revealItemInDir("/tmp/workspace");

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(revealItem).toHaveBeenCalledWith("/tmp/workspace");
  });

  it("falls back to the Tauri opener loader when the desktop bridge is unavailable", async () => {
    const openExternalUrl = vi.fn(async () => undefined);
    const revealItem = vi.fn(async () => undefined);
    __setTauriOpenerLoaderForTests(async () => ({
      openUrl: openExternalUrl,
      revealItemInDir: revealItem,
    }));

    await openUrl("https://example.com");
    await revealItemInDir("/tmp/workspace");

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(revealItem).toHaveBeenCalledWith("/tmp/workspace");
  });

  it("rejects unsafe external URLs before touching native bridges", async () => {
    const openExternalUrl = vi.fn(async () => true);
    const openTauriUrl = vi.fn(async () => undefined);
    window.hugeCodeDesktopHost = {
      kind: "electron",
      shell: {
        openExternalUrl,
      },
    };
    __setTauriOpenerLoaderForTests(async () => ({
      openUrl: openTauriUrl,
      revealItemInDir: vi.fn(async () => undefined),
    }));

    await expect(openUrl("javascript:alert(1)")).rejects.toThrow("Blocked unsafe external URL.");

    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(openTauriUrl).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("uses a browser fallback for openUrl when native desktop bridges are unavailable", async () => {
    __setTauriOpenerLoaderForTests(async () => {
      throw new Error("unavailable");
    });

    await openUrl("https://example.com");

    expect(window.open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("throws when reveal-in-directory has no available desktop bridge", async () => {
    __setTauriOpenerLoaderForTests(async () => {
      throw new Error("unavailable");
    });

    await expect(revealItemInDir("/tmp/workspace")).rejects.toThrow(
      "Desktop reveal-in-directory bridge unavailable."
    );
  });
});
