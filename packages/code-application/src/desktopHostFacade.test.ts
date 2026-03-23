import { describe, expect, it, vi } from "vitest";
import {
  detectDesktopRuntimeHost,
  openDesktopExternalUrl,
  resolveDesktopAppVersion,
  resolveDesktopSessionInfo,
  resolveDesktopWindowLabel,
  revealDesktopItemInDir,
  showDesktopNotification,
} from "./desktopHostFacade";

describe("desktopHostFacade", () => {
  it("prefers the desktop host kind for runtime detection", () => {
    expect(
      detectDesktopRuntimeHost({
        desktopHostBridge: { kind: "electron" },
        tauriRuntimeAvailable: true,
      })
    ).toBe("electron");
  });

  it("falls back to tauri or browser runtime detection", () => {
    expect(
      detectDesktopRuntimeHost({
        desktopHostBridge: null,
        tauriRuntimeAvailable: true,
      })
    ).toBe("tauri");
    expect(
      detectDesktopRuntimeHost({
        desktopHostBridge: null,
        tauriRuntimeAvailable: false,
      })
    ).toBe("browser");
  });

  it("resolves window labels and versions with bridge-first fallback order", async () => {
    const getLabel = vi.fn(async () => "review");
    const getVersion = vi.fn(async () => "41.0.3");

    await expect(
      resolveDesktopWindowLabel({
        desktopHostBridge: {
          kind: "electron",
          window: { getLabel },
        },
        defaultLabel: "main",
      })
    ).resolves.toBe("review");
    await expect(
      resolveDesktopAppVersion({
        desktopHostBridge: {
          kind: "electron",
          app: { getVersion },
        },
      })
    ).resolves.toBe("41.0.3");
  });

  it("falls back to supplied tauri resolvers when bridge values are unavailable", async () => {
    await expect(
      resolveDesktopWindowLabel({
        desktopHostBridge: null,
        defaultLabel: "main",
        getTauriWindowLabel: async () => "about",
      })
    ).resolves.toBe("about");
    await expect(
      resolveDesktopAppVersion({
        desktopHostBridge: null,
        getTauriAppVersion: async () => "9.9.9",
      })
    ).resolves.toBe("9.9.9");
  });

  it("returns the current desktop session when a valid bridge session exists", async () => {
    await expect(
      resolveDesktopSessionInfo({
        kind: "electron",
        session: {
          getCurrentSession: async () => ({
            id: "desktop-session-1",
            lastActiveAt: "2026-03-23T00:00:00.000Z",
            preferredBackendId: null,
            runtimeMode: "local",
            windowLabel: "main",
            workspaceLabel: "alpha",
            workspacePath: "/workspace/alpha",
          }),
        },
      })
    ).resolves.toMatchObject({
      id: "desktop-session-1",
      workspaceLabel: "alpha",
    });
  });

  it("runs notification and shell orchestration through the bridge first", async () => {
    const openExternalUrl = vi.fn(async () => true);
    const revealItemInDir = vi.fn(async () => true);
    const show = vi.fn(async () => true);

    const desktopHostBridge = {
      kind: "electron" as const,
      notifications: { show },
      shell: { openExternalUrl, revealItemInDir },
    };

    await expect(
      showDesktopNotification(
        {
          desktopHostBridge,
        },
        { title: "Build complete" }
      )
    ).resolves.toBe(true);
    await expect(
      openDesktopExternalUrl(
        {
          desktopHostBridge,
          openBrowserUrl: () => false,
        },
        "https://example.com"
      )
    ).resolves.toBe(true);
    await expect(
      revealDesktopItemInDir(
        {
          desktopHostBridge,
        },
        "/tmp/workspace"
      )
    ).resolves.toBe(true);
  });

  it("falls back to tauri and browser shell helpers when the bridge is unavailable", async () => {
    const openBrowserUrl = vi.fn(() => true);
    const openTauriUrl = vi.fn(async () => true);
    const revealTauriItem = vi.fn(async () => true);

    await expect(
      openDesktopExternalUrl(
        {
          desktopHostBridge: null,
          openBrowserUrl,
          openTauriUrl,
        },
        "https://example.com"
      )
    ).resolves.toBe(true);
    await expect(
      revealDesktopItemInDir(
        {
          desktopHostBridge: null,
          revealTauriItem,
        },
        "/tmp/workspace"
      )
    ).resolves.toBe(true);
    expect(openTauriUrl).toHaveBeenCalledWith("https://example.com");
    expect(revealTauriItem).toHaveBeenCalledWith("/tmp/workspace");
    expect(openBrowserUrl).not.toHaveBeenCalled();
  });

  it("blocks unsafe external urls before any desktop shell transport runs", async () => {
    const openBrowserUrl = vi.fn(() => true);
    const openTauriUrl = vi.fn(async () => true);
    const openExternalUrl = vi.fn(async () => true);

    await expect(
      openDesktopExternalUrl(
        {
          desktopHostBridge: {
            kind: "electron",
            shell: { openExternalUrl },
          },
          openBrowserUrl,
          openTauriUrl,
        },
        "javascript:alert(1)"
      )
    ).resolves.toBe(false);

    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(openTauriUrl).not.toHaveBeenCalled();
    expect(openBrowserUrl).not.toHaveBeenCalled();
  });
});
