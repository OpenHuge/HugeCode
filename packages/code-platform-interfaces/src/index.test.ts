import { describe, expect, it } from "vitest";
import {
  DESKTOP_HOST_IPC_CHANNELS,
  type DesktopAppInfo,
  type DesktopBrowserExtractionResult,
  type DesktopDiagnosticsInfo,
  type DesktopLaunchIntent,
  type DesktopUpdateState,
  isElectronDesktopHostBridge,
} from "./index";

describe("code-platform-interfaces", () => {
  it("recognizes the supported electron bridge kind", () => {
    expect(isElectronDesktopHostBridge({ kind: "electron" })).toBe(true);
  });

  it("rejects missing or unsupported bridge kinds", () => {
    expect(isElectronDesktopHostBridge(null)).toBe(false);
    expect(isElectronDesktopHostBridge({ kind: "electron-legacy" })).toBe(false);
    expect(isElectronDesktopHostBridge({})).toBe(false);
  });

  it("supports the public beta app, launch, and updater contracts", () => {
    const appInfo: DesktopAppInfo = {
      channel: "beta",
      platform: "darwin",
      updateCapability: "automatic",
      updateMessage: "Automatic beta updates are enabled from the configured static feed.",
      updateMode: "enabled_beta_static_feed",
      version: "0.1.0-beta.1",
    };
    const launchIntent: DesktopLaunchIntent = {
      kind: "protocol",
      receivedAt: "2026-03-24T00:00:00.000Z",
      url: "hugecode://workspace/open?path=%2Fworkspace%2Falpha",
    };
    const workspaceLaunchIntent: DesktopLaunchIntent = {
      kind: "workspace",
      launchPath: "/workspace/alpha/src/main.ts",
      launchPathKind: "file",
      receivedAt: "2026-03-24T00:00:00.000Z",
      workspaceLabel: "alpha",
      workspacePath: "/workspace/alpha",
    };
    const updateState: DesktopUpdateState = {
      capability: "automatic",
      message: "Automatic beta updates are enabled from the configured static feed.",
      mode: "enabled_beta_static_feed",
      provider: "static-storage",
      releaseUrl: "https://github.com/OpenHuge/HugeCode/releases/tag/v0.1.0-beta.2",
      stage: "available",
      version: "0.1.0-beta.2",
    };
    const diagnosticsInfo: DesktopDiagnosticsInfo = {
      crashDumpsDirectoryPath: "/tmp/hugecode/crash-dumps",
      incidentLogPath: "/tmp/hugecode/logs/desktop-incidents.ndjson",
      lastIncidentAt: "2026-03-24T00:05:00.000Z",
      logsDirectoryPath: "/tmp/hugecode/logs",
      recentIncidentCount: 2,
      reportIssueUrl: "https://github.com/OpenHuge/HugeCode/issues/new",
      supportSnapshotText: "HugeCode Desktop Support Snapshot",
    };

    expect(appInfo.channel).toBe("beta");
    expect(launchIntent.kind).toBe("protocol");
    expect(workspaceLaunchIntent.launchPathKind).toBe("file");
    expect(workspaceLaunchIntent.workspacePath).toBe("/workspace/alpha");
    expect(updateState.stage).toBe("available");
    expect(diagnosticsInfo.recentIncidentCount).toBe(2);
  });

  it("supports browser extraction result contracts with normalized text and trace details", () => {
    const extractionResult: DesktopBrowserExtractionResult = {
      status: "partial",
      normalizedText:
        "Mission Control can now project browser extraction capability state through the runtime facade.",
      snippet: "Mission Control can now project browser extraction capability state",
      sourceUrl: "https://example.com/runtime-browser-readiness",
      title: "Runtime browser readiness",
      errorCode: "SNIPPET_TRUNCATED",
      errorMessage: "Normalized text was truncated to the preview snippet window.",
      traceId: "browser-trace-1",
      trace: [
        {
          stage: "capture",
          message: "Captured page text from the active browser session.",
          at: "2026-03-29T00:00:00.000Z",
        },
        {
          stage: "normalize",
          message: "Collapsed whitespace and produced a preview snippet.",
          at: "2026-03-29T00:00:00.250Z",
          code: "SNIPPET_TRUNCATED",
        },
      ],
    };

    expect(extractionResult.status).toBe("partial");
    expect(extractionResult.normalizedText).toContain("runtime facade");
    expect(extractionResult.snippet).toContain("browser extraction");
    expect(extractionResult.trace).toHaveLength(2);
    expect(extractionResult.trace[1]?.stage).toBe("normalize");
    expect(extractionResult.traceId).toBe("browser-trace-1");
  });

  it("exports the canonical desktop host ipc channel contract", () => {
    expect(DESKTOP_HOST_IPC_CHANNELS).toEqual({
      getAppInfo: "hugecode:desktop-host:get-app-info",
      getAppVersion: "hugecode:desktop-host:get-app-version",
      getDiagnosticsInfo: "hugecode:desktop-host:get-diagnostics-info",
      copySupportSnapshot: "hugecode:desktop-host:copy-support-snapshot",
      extractBrowserContent: "hugecode:desktop-host:extract-browser-content",
      getLastBrowserExtractionResult: "hugecode:desktop-host:get-last-browser-extraction-result",
      consumePendingLaunchIntent: "hugecode:desktop-host:consume-pending-launch-intent",
      pushLaunchIntent: "hugecode:desktop-host:push-launch-intent",
      pushUpdateState: "hugecode:desktop-host:push-update-state",
      getCurrentSession: "hugecode:desktop-host:get-current-session",
      listLocalChromeDebuggerEndpoints:
        "hugecode:desktop-host:list-local-chrome-debugger-endpoints",
      listRecentSessions: "hugecode:desktop-host:list-recent-sessions",
      reopenSession: "hugecode:desktop-host:reopen-session",
      getWindowLabel: "hugecode:desktop-host:get-window-label",
      listWindows: "hugecode:desktop-host:list-windows",
      openWindow: "hugecode:desktop-host:open-window",
      focusWindow: "hugecode:desktop-host:focus-window",
      closeWindow: "hugecode:desktop-host:close-window",
      getTrayState: "hugecode:desktop-host:get-tray-state",
      setTrayEnabled: "hugecode:desktop-host:set-tray-enabled",
      showNotification: "hugecode:desktop-host:show-notification",
      openDialog: "hugecode:desktop-host:open-dialog",
      getUpdateState: "hugecode:desktop-host:get-update-state",
      checkForUpdates: "hugecode:desktop-host:check-for-updates",
      restartToApplyUpdate: "hugecode:desktop-host:restart-to-apply-update",
      openExternalUrl: "hugecode:desktop-host:open-external-url",
      openPathIn: "hugecode:desktop-host:open-path-in",
      openPath: "hugecode:desktop-host:open-path",
      revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
    });
  });
});
