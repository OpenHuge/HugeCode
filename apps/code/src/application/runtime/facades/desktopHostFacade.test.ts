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
  resolveDesktopShellStartupStatus,
  resolveDesktopUpdaterState,
  resolveWindowLabel,
  restartDesktopUpdate,
  revealItemInDir,
  showDesktopNotification,
  subscribeToDesktopUpdateState,
} from "./desktopHostFacade";

const {
  getDesktopHostBridgeMock,
  openDesktopPathCompatibilityMock,
  openDesktopUrlCompatibilityMock,
  readDesktopAppVersionCompatibilityMock,
  readDesktopWindowLabelCompatibilityMock,
  revealDesktopItemCompatibilityMock,
} = vi.hoisted(() => ({
  getDesktopHostBridgeMock: vi.fn(),
  openDesktopPathCompatibilityMock: vi.fn(),
  openDesktopUrlCompatibilityMock: vi.fn(),
  readDesktopAppVersionCompatibilityMock: vi.fn(),
  readDesktopWindowLabelCompatibilityMock: vi.fn(),
  revealDesktopItemCompatibilityMock: vi.fn(),
}));

vi.mock("../ports/desktopHostBridge", () => ({
  getDesktopHostBridge: getDesktopHostBridgeMock,
}));

vi.mock("../ports/desktopHostEnvironment", () => ({
  readDesktopCompatibilityAppVersion: readDesktopAppVersionCompatibilityMock,
  readDesktopCompatibilityWindowLabel: readDesktopWindowLabelCompatibilityMock,
}));

vi.mock("../ports/tauriOpener", () => ({
  openDesktopCompatibilityPath: openDesktopPathCompatibilityMock,
  openDesktopCompatibilityUrl: openDesktopUrlCompatibilityMock,
  revealDesktopCompatibilityItemInDir: revealDesktopItemCompatibilityMock,
}));

describe("desktopHostFacade", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getDesktopHostBridgeMock.mockReturnValue(null);
    readDesktopWindowLabelCompatibilityMock.mockResolvedValue(null);
    readDesktopAppVersionCompatibilityMock.mockResolvedValue(null);
    openDesktopPathCompatibilityMock.mockResolvedValue(false);
    openDesktopUrlCompatibilityMock.mockResolvedValue(false);
    revealDesktopItemCompatibilityMock.mockResolvedValue(false);
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
    await expect(resolveDesktopShellStartupStatus()).resolves.toEqual({
      tone: "attention",
      label: "Electron host update active",
      detail: "Desktop update checks are active while the shell stays interactive.",
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

  it("falls back to compatibility helpers and browser behavior when no bridge is present", async () => {
    readDesktopWindowLabelCompatibilityMock.mockResolvedValue("about");
    readDesktopAppVersionCompatibilityMock.mockResolvedValue("9.9.9");
    openDesktopPathCompatibilityMock.mockResolvedValue(true);
    openDesktopUrlCompatibilityMock.mockResolvedValue(true);
    revealDesktopItemCompatibilityMock.mockResolvedValue(true);

    await expect(detectDesktopRuntimeHost()).resolves.toBe("browser");
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
    await expect(resolveDesktopShellStartupStatus()).resolves.toEqual({
      tone: "attention",
      label: "Browser host manual updates",
      detail: "Automatic desktop updates are unavailable in this environment.",
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
    openDesktopUrlCompatibilityMock.mockResolvedValue(false);
    window.open = vi.fn(() => null) as typeof window.open;

    await expect(openUrl("https://example.com")).resolves.toBe(false);
  });

  it("surfaces blocked desktop host startup when electron updater config is broken", async () => {
    getDesktopHostBridgeMock.mockReturnValue({
      kind: "electron",
      updater: {
        getState: async () => ({
          capability: "manual",
          mode: "misconfigured",
          provider: "none",
          stage: "idle",
          message: "Missing release feed configuration.",
        }),
      },
    });

    await expect(resolveDesktopShellStartupStatus()).resolves.toEqual({
      tone: "blocked",
      label: "Electron host startup blocked",
      detail: "Missing release feed configuration.",
    });
  });
});
