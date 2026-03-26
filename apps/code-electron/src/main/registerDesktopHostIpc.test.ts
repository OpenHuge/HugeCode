import { describe, expect, it, vi } from "vitest";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
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
        closeWindow: vi.fn(),
        checkForUpdates: vi.fn(),
        copySupportSnapshot: vi.fn(),
        consumePendingLaunchIntent: vi.fn(),
        focusWindow: vi.fn(),
        getAppInfo: vi.fn(),
        getAppVersion: vi.fn(),
        getCurrentSession: vi.fn(),
        getDiagnosticsInfo: vi.fn(),
        getTrayState: vi.fn(),
        getUpdateState: vi.fn(),
        getWindowLabel: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openExternalUrl: vi.fn(),
        openPath: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        restartToApplyUpdate: vi.fn(),
        setTrayEnabled: vi.fn(),
        showNotification: vi.fn(),
      },
      ipcMain: {
        handle: handleMock,
      },
      isTrustedSender: () => true,
    });

    expect(handleMock).toHaveBeenCalledTimes(invokeChannels.length);
    expect(handleMock.mock.calls.map(([channel]) => channel).toSorted()).toEqual(
      invokeChannels.toSorted()
    );
  });

  it("blocks untrusted IPC senders before handler execution", async () => {
    const handleMock = vi.fn();
    const getAppVersion = vi.fn(() => "41.0.3");

    registerDesktopHostIpc({
      channels: DESKTOP_HOST_IPC_CHANNELS,
      handlers: {
        closeWindow: vi.fn(),
        checkForUpdates: vi.fn(),
        copySupportSnapshot: vi.fn(),
        consumePendingLaunchIntent: vi.fn(),
        focusWindow: vi.fn(),
        getAppInfo: vi.fn(),
        getAppVersion,
        getCurrentSession: vi.fn(),
        getDiagnosticsInfo: vi.fn(),
        getTrayState: vi.fn(),
        getUpdateState: vi.fn(),
        getWindowLabel: vi.fn(),
        listRecentSessions: vi.fn(),
        listWindows: vi.fn(),
        openExternalUrl: vi.fn(),
        openPath: vi.fn(),
        openWindow: vi.fn(),
        reopenSession: vi.fn(),
        revealItemInDir: vi.fn(),
        restartToApplyUpdate: vi.fn(),
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
