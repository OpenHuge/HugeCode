import { describe, expect, it } from "vitest";
import { DESKTOP_HOST_IPC_CHANNELS } from "./ipc";

describe("desktopHostIpcChannels", () => {
  it("uses the namespaced HugeCode desktop bridge channels", () => {
    expect(DESKTOP_HOST_IPC_CHANNELS).toEqual({
      getAppInfo: "hugecode:desktop-host:get-app-info",
      getAppVersion: "hugecode:desktop-host:get-app-version",
      consumePendingLaunchIntent: "hugecode:desktop-host:consume-pending-launch-intent",
      pushLaunchIntent: "hugecode:desktop-host:push-launch-intent",
      pushUpdateState: "hugecode:desktop-host:push-update-state",
      getCurrentSession: "hugecode:desktop-host:get-current-session",
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
      getDiagnosticsInfo: "hugecode:desktop-host:get-diagnostics-info",
      copySupportSnapshot: "hugecode:desktop-host:copy-support-snapshot",
      getUpdateState: "hugecode:desktop-host:get-update-state",
      checkForUpdates: "hugecode:desktop-host:check-for-updates",
      restartToApplyUpdate: "hugecode:desktop-host:restart-to-apply-update",
      openExternalUrl: "hugecode:desktop-host:open-external-url",
      openPath: "hugecode:desktop-host:open-path",
      revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
    });
  });
});
