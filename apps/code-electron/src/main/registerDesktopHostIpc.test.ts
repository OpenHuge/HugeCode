import { describe, expect, it, vi } from "vitest";
import { DESKTOP_HOST_IPC_CHANNELS } from "@ku0/code-platform-interfaces";
import { registerDesktopHostIpc } from "./registerDesktopHostIpc.js";

describe("registerDesktopHostIpc", () => {
  it("registers all desktop host IPC handlers", () => {
    const handleMock = vi.fn();
    const invokeChannels = Object.entries(DESKTOP_HOST_IPC_CHANNELS)
      .filter(
        ([channelName]) => channelName !== "pushLaunchIntent" && channelName !== "pushUpdateState"
      )
      .map(([, channel]) => channel);

    registerDesktopHostIpc({
      channels: DESKTOP_HOST_IPC_CHANNELS,
      handlers: {
        assessBrowserSurface: vi.fn(),
        closeWindow: vi.fn(),
        closeAiWebLabSession: vi.fn(),
        checkForUpdates: vi.fn(),
        copySupportSnapshot: vi.fn(),
        consumePendingLaunchIntent: vi.fn(),
        extractBrowserContent: vi.fn(),
        extractAiWebLabArtifact: vi.fn(),
        focusWindow: vi.fn(),
        focusAiWebLabSession: vi.fn(),
        getAppInfo: vi.fn(),
        getAppVersion: vi.fn(),
        getAiWebLabCatalog: vi.fn(),
        getAiWebLabState: vi.fn(),
        getCurrentSession: vi.fn(),
        getDiagnosticsInfo: vi.fn(),
        getLastBrowserAssessmentResult: vi.fn(),
        getLastBrowserExtractionResult: vi.fn(),
        getTrayState: vi.fn(),
        getUpdateState: vi.fn(),
        getWindowLabel: vi.fn(),
        listLocalChromeDebuggerEndpoints: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openDialog: vi.fn(),
        openAiWebLabEntrypoint: vi.fn(),
        openAiWebLabSession: vi.fn(),
        openExternalUrl: vi.fn(),
        openPathIn: vi.fn(),
        openPath: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        restartToApplyUpdate: vi.fn(),
        navigateAiWebLab: vi.fn(),
        setAiWebLabSessionMode: vi.fn(),
        setAiWebLabViewMode: vi.fn(),
        setTrayEnabled: vi.fn(),
        showNotification: vi.fn(),
      },
      ipcMain: {
        handle: handleMock,
      },
      isTrustedSender: () => true,
    });

    expect(handleMock).toHaveBeenCalledTimes(invokeChannels.length);
    expect(handleMock.mock.calls.map(([channel]) => channel).sort()).toEqual(
      [...invokeChannels].sort()
    );
  });

  it("blocks untrusted IPC senders before handler execution", async () => {
    const handleMock = vi.fn();
    const getAppVersion = vi.fn(() => "41.0.3");

    registerDesktopHostIpc({
      channels: DESKTOP_HOST_IPC_CHANNELS,
      handlers: {
        assessBrowserSurface: vi.fn(),
        closeWindow: vi.fn(),
        closeAiWebLabSession: vi.fn(),
        checkForUpdates: vi.fn(),
        copySupportSnapshot: vi.fn(),
        consumePendingLaunchIntent: vi.fn(),
        extractBrowserContent: vi.fn(),
        extractAiWebLabArtifact: vi.fn(),
        focusWindow: vi.fn(),
        focusAiWebLabSession: vi.fn(),
        getAppInfo: vi.fn(),
        getAppVersion,
        getAiWebLabCatalog: vi.fn(),
        getAiWebLabState: vi.fn(),
        getCurrentSession: vi.fn(),
        getDiagnosticsInfo: vi.fn(),
        getLastBrowserAssessmentResult: vi.fn(),
        getLastBrowserExtractionResult: vi.fn(),
        getTrayState: vi.fn(),
        getUpdateState: vi.fn(),
        getWindowLabel: vi.fn(),
        listLocalChromeDebuggerEndpoints: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openDialog: vi.fn(),
        openAiWebLabEntrypoint: vi.fn(),
        openAiWebLabSession: vi.fn(),
        openExternalUrl: vi.fn(),
        openPathIn: vi.fn(),
        openPath: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        restartToApplyUpdate: vi.fn(),
        navigateAiWebLab: vi.fn(),
        setAiWebLabSessionMode: vi.fn(),
        setAiWebLabViewMode: vi.fn(),
        setTrayEnabled: vi.fn(),
        showNotification: vi.fn(),
      },
      ipcMain: {
        handle: handleMock,
      },
      isTrustedSender: () => false,
    });

    const registeredHandler = handleMock.mock.calls.find(
      ([channel]) => channel === DESKTOP_HOST_IPC_CHANNELS.getAppVersion
    )?.[1];

    await expect(
      registeredHandler?.({
        sender: {},
        senderFrame: {
          url: "https://example.com",
        },
      })
    ).rejects.toThrow("Blocked untrusted desktop IPC sender.");
    expect(getAppVersion).not.toHaveBeenCalled();
  });
});
