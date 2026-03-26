import { describe, expect, it, vi } from "vitest";
import {
  checkDesktopForUpdates,
  copyDesktopSupportSnapshot,
  consumeDesktopLaunchIntent,
  detectDesktopRuntimeHost,
  openDesktopExternalUrl,
  openDesktopPath,
  resolveDesktopAppInfo,
  resolveDesktopDiagnosticsInfo,
  resolveDesktopAppVersion,
  resolveDesktopSessionInfo,
  resolveDesktopWindowLabel,
  resolveDesktopUpdateState,
  restartDesktopToApplyUpdate,
  revealDesktopItemInDir,
  showDesktopNotification,
  subscribeDesktopLaunchIntents,
  subscribeDesktopUpdateState,
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

  it("resolves app info, launch intent, and updater state from the desktop bridge", async () => {
    const checkForUpdates = vi.fn(async () => ({
      capability: "automatic" as const,
      mode: "enabled_stable_public_service" as const,
      provider: "public-github" as const,
      stage: "checking" as const,
    }));
    const restartToApplyUpdate = vi.fn(async () => true);

    const desktopHostBridge = {
      kind: "electron" as const,
      app: {
        getInfo: async () => ({
          channel: "beta" as const,
          platform: "darwin" as const,
          updateCapability: "automatic" as const,
          updateMessage: "Automatic beta updates are enabled from the configured static feed.",
          updateMode: "enabled_beta_static_feed" as const,
          version: "0.1.0-beta.1",
        }),
      },
      diagnostics: {
        copySupportSnapshot: vi.fn(async () => true),
        getInfo: async () => ({
          crashDumpsDirectoryPath: "/tmp/hugecode/crash-dumps",
          incidentLogPath: "/tmp/hugecode/logs/desktop-incidents.ndjson",
          lastIncidentAt: "2026-03-24T00:05:00.000Z",
          logsDirectoryPath: "/tmp/hugecode/logs",
          recentIncidentCount: 2,
          reportIssueUrl: "https://github.com/OpenHuge/HugeCode/issues/new",
          supportSnapshotText: "HugeCode Desktop Support Snapshot",
        }),
      },
      launch: {
        consumePendingIntent: async () => ({
          kind: "protocol" as const,
          receivedAt: "2026-03-24T00:00:00.000Z",
          url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
        }),
        onIntent: vi.fn(() => () => undefined),
      },
      updater: {
        checkForUpdates,
        getState: async () => ({
          capability: "automatic" as const,
          mode: "enabled_beta_static_feed" as const,
          provider: "static-storage" as const,
          stage: "available" as const,
          version: "0.1.0-beta.2",
        }),
        restartToApplyUpdate,
      },
    };

    await expect(resolveDesktopAppInfo(desktopHostBridge)).resolves.toMatchObject({
      channel: "beta",
      updateMode: "enabled_beta_static_feed",
      version: "0.1.0-beta.1",
    });
    await expect(
      resolveDesktopDiagnosticsInfo({
        desktopHostBridge,
      })
    ).resolves.toMatchObject({
      recentIncidentCount: 2,
      reportIssueUrl: "https://github.com/OpenHuge/HugeCode/issues/new",
    });
    await expect(copyDesktopSupportSnapshot({ desktopHostBridge })).resolves.toBe(true);
    await expect(consumeDesktopLaunchIntent(desktopHostBridge)).resolves.toMatchObject({
      kind: "protocol",
    });
    await expect(resolveDesktopUpdateState(desktopHostBridge)).resolves.toMatchObject({
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      stage: "available",
    });
    await expect(checkDesktopForUpdates(desktopHostBridge)).resolves.toMatchObject({
      mode: "enabled_stable_public_service",
      provider: "public-github",
      stage: "checking",
    });
    await expect(restartDesktopToApplyUpdate(desktopHostBridge)).resolves.toBe(true);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(restartToApplyUpdate).toHaveBeenCalledTimes(1);
  });

  it("subscribes to live desktop launch intents when the bridge exposes them", () => {
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    const onIntent = vi.fn(() => unsubscribe);

    const result = subscribeDesktopLaunchIntents(
      {
        kind: "electron",
        launch: {
          onIntent,
        },
      },
      listener
    );

    expect(onIntent).toHaveBeenCalledWith(listener);
    result();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("subscribes to live desktop update state when the bridge exposes it", () => {
    const listener = vi.fn();
    const unsubscribe = vi.fn();
    const onState = vi.fn(() => unsubscribe);

    const result = subscribeDesktopUpdateState(
      {
        kind: "electron",
        updater: {
          onState,
        },
      },
      listener
    );

    expect(onState).toHaveBeenCalledWith(listener);
    result();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("returns safe null or idle fallbacks when the new desktop capabilities are unavailable", async () => {
    await expect(resolveDesktopAppInfo(null)).resolves.toBeNull();
    await expect(resolveDesktopDiagnosticsInfo({ desktopHostBridge: null })).resolves.toBeNull();
    await expect(copyDesktopSupportSnapshot({ desktopHostBridge: null })).resolves.toBe(false);
    await expect(consumeDesktopLaunchIntent(null)).resolves.toBeNull();
    await expect(resolveDesktopUpdateState(null)).resolves.toEqual({
      capability: "unsupported",
      message: "Automatic desktop updates are unavailable in this environment.",
      mode: "unsupported_platform",
      provider: "none",
      stage: "idle",
    });
    await expect(checkDesktopForUpdates(null)).resolves.toEqual({
      capability: "unsupported",
      message: "Automatic desktop updates are unavailable in this environment.",
      mode: "unsupported_platform",
      provider: "none",
      stage: "idle",
    });
    await expect(restartDesktopToApplyUpdate(null)).resolves.toBe(false);
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
    const openPath = vi.fn(async () => true);
    const revealItemInDir = vi.fn(async () => true);
    const show = vi.fn(async () => true);

    const desktopHostBridge = {
      kind: "electron" as const,
      notifications: { show },
      shell: { openExternalUrl, openPath, revealItemInDir },
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
      openDesktopPath(
        {
          desktopHostBridge,
        },
        "/tmp/hugecode/logs"
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
    const openTauriPath = vi.fn(async () => true);
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
      openDesktopPath(
        {
          desktopHostBridge: null,
          openTauriPath,
        },
        "/tmp/hugecode/logs"
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
    expect(openTauriPath).toHaveBeenCalledWith("/tmp/hugecode/logs");
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
