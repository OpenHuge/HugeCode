import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForDesktopUpdates,
  copyDesktopSupportSnapshot,
  consumePendingDesktopLaunchIntent,
  detectDesktopRuntimeHost,
  openPath,
  openUrl,
  resolveAppInfo,
  resolveDesktopDiagnosticsInfo,
  resolveAppVersion,
  resolveCurrentDesktopSession,
  resolveDesktopUpdaterState,
  resolveWindowLabel,
  restartDesktopUpdate,
  revealItemInDir,
  showDesktopNotification,
  subscribeToDesktopUpdateState,
} from "./desktopHostFacade";

const {
  detectTauriRuntimeMock,
  getDesktopHostBridgeMock,
  openTauriPathMock,
  openTauriUrlMock,
  readTauriAppVersionMock,
  readTauriWindowLabelMock,
  revealTauriItemInDirMock,
} = vi.hoisted(() => ({
  detectTauriRuntimeMock: vi.fn(),
  getDesktopHostBridgeMock: vi.fn(),
  openTauriPathMock: vi.fn(),
  openTauriUrlMock: vi.fn(),
  readTauriAppVersionMock: vi.fn(),
  readTauriWindowLabelMock: vi.fn(),
  revealTauriItemInDirMock: vi.fn(),
}));

vi.mock("../ports/desktopHostBridge", () => ({
  getDesktopHostBridge: getDesktopHostBridgeMock,
}));

vi.mock("../ports/tauriEnvironment", () => ({
  detectTauriRuntime: detectTauriRuntimeMock,
  readTauriAppVersion: readTauriAppVersionMock,
  readTauriWindowLabel: readTauriWindowLabelMock,
}));

vi.mock("../ports/tauriOpener", () => ({
  openTauriPath: openTauriPathMock,
  openTauriUrl: openTauriUrlMock,
  revealTauriItemInDir: revealTauriItemInDirMock,
}));

describe("desktopHostFacade", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDesktopHostBridgeMock.mockReturnValue(null);
    detectTauriRuntimeMock.mockResolvedValue(false);
    readTauriWindowLabelMock.mockResolvedValue(null);
    readTauriAppVersionMock.mockResolvedValue(null);
    openTauriPathMock.mockResolvedValue(false);
    openTauriUrlMock.mockResolvedValue(false);
    revealTauriItemInDirMock.mockResolvedValue(false);
    window.open = vi.fn(() => window) as typeof window.open;
  });

  it("prefers the electron bridge when it is present", async () => {
    const updaterStateUnsubscribe = vi.fn();
    const updaterStateListener = vi.fn(() => updaterStateUnsubscribe);
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      app: {
        getInfo: async () => ({
          channel: "beta",
          platform: "darwin",
          updateCapability: "automatic",
          updateMessage: "Automatic beta updates are enabled from the configured static feed.",
          updateMode: "enabled_beta_static_feed",
          version: "41.0.3",
        }),
        getVersion: async () => "41.0.3",
      },
      diagnostics: {
        copySupportSnapshot: async () => true,
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
          kind: "protocol",
          receivedAt: "2026-03-24T00:00:00.000Z",
          url: "hugecode://workspace/open?path=%2Fworkspace%2Freview",
        }),
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
      updater: {
        checkForUpdates: async () => ({
          capability: "automatic",
          mode: "enabled_beta_static_feed",
          provider: "static-storage",
          stage: "checking",
          version: "41.0.4",
        }),
        getState: async () => ({
          capability: "automatic",
          mode: "enabled_beta_static_feed",
          provider: "static-storage",
          stage: "downloaded",
          version: "41.0.4",
        }),
        onState: updaterStateListener,
        restartToApplyUpdate: async () => true,
      },
      shell: {
        openExternalUrl: async () => true,
        openPath: async () => true,
        revealItemInDir: async () => true,
      },
    });

    await expect(detectDesktopRuntimeHost()).resolves.toBe("electron");
    await expect(resolveAppInfo()).resolves.toMatchObject({
      channel: "beta",
      updateMode: "enabled_beta_static_feed",
      version: "41.0.3",
    });
    await expect(resolveDesktopDiagnosticsInfo()).resolves.toMatchObject({
      recentIncidentCount: 2,
      reportIssueUrl: "https://github.com/OpenHuge/HugeCode/issues/new",
    });
    await expect(copyDesktopSupportSnapshot()).resolves.toBe(true);
    await expect(resolveAppVersion()).resolves.toBe("41.0.3");
    await expect(consumePendingDesktopLaunchIntent()).resolves.toMatchObject({
      kind: "protocol",
    });
    await expect(resolveCurrentDesktopSession()).resolves.toMatchObject({
      id: "session-review",
      workspaceLabel: "review",
    });
    await expect(resolveDesktopUpdaterState()).resolves.toMatchObject({
      stage: "downloaded",
    });
    await expect(checkForDesktopUpdates()).resolves.toMatchObject({
      stage: "checking",
    });
    await expect(restartDesktopUpdate()).resolves.toBe(true);
    await expect(resolveWindowLabel("main")).resolves.toBe("review");
    await expect(showDesktopNotification({ title: "Build complete" })).resolves.toBe(true);
    await expect(openUrl("https://example.com")).resolves.toBe(true);
    await expect(openPath("/tmp/hugecode/logs")).resolves.toBe(true);
    await expect(revealItemInDir("/tmp/workspace")).resolves.toBe(true);
    const unsubscribe = subscribeToDesktopUpdateState(vi.fn());
    expect(updaterStateListener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(updaterStateUnsubscribe).toHaveBeenCalledTimes(1);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("falls back to tauri and browser helpers when no bridge is present", async () => {
    detectTauriRuntimeMock.mockResolvedValue(true);
    readTauriWindowLabelMock.mockResolvedValue("about");
    readTauriAppVersionMock.mockResolvedValue("9.9.9");
    openTauriPathMock.mockResolvedValue(true);
    openTauriUrlMock.mockResolvedValue(true);
    revealTauriItemInDirMock.mockResolvedValue(true);

    await expect(detectDesktopRuntimeHost()).resolves.toBe("tauri");
    await expect(resolveAppInfo()).resolves.toBeNull();
    await expect(resolveDesktopDiagnosticsInfo()).resolves.toBeNull();
    await expect(copyDesktopSupportSnapshot()).resolves.toBe(false);
    await expect(resolveAppVersion()).resolves.toBe("9.9.9");
    await expect(consumePendingDesktopLaunchIntent()).resolves.toBeNull();
    await expect(resolveCurrentDesktopSession()).resolves.toBeNull();
    await expect(resolveDesktopUpdaterState()).resolves.toEqual({
      capability: "unsupported",
      message: "Automatic desktop updates are unavailable in this environment.",
      mode: "unsupported_platform",
      provider: "none",
      stage: "idle",
    });
    await expect(checkForDesktopUpdates()).resolves.toEqual({
      capability: "unsupported",
      message: "Automatic desktop updates are unavailable in this environment.",
      mode: "unsupported_platform",
      provider: "none",
      stage: "idle",
    });
    await expect(restartDesktopUpdate()).resolves.toBe(false);
    await expect(resolveWindowLabel("main")).resolves.toBe("about");
    await expect(showDesktopNotification({ title: "No bridge" })).resolves.toBe(false);
    await expect(openUrl("https://example.com")).resolves.toBe(true);
    await expect(openPath("/tmp/hugecode/logs")).resolves.toBe(true);
    await expect(revealItemInDir("/tmp/workspace")).resolves.toBe(true);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("uses browser fallback when native openers fail", async () => {
    openTauriUrlMock.mockResolvedValue(false);
    window.open = vi.fn(() => null) as typeof window.open;

    await expect(openUrl("https://example.com")).resolves.toBe(false);
  });
});
