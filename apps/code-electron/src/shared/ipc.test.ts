import { describe, expect, it } from "vitest";
import { DESKTOP_HOST_IPC_CHANNELS } from "./ipc";

describe("desktopHostIpcChannels", () => {
  it("uses the namespaced HugeCode desktop bridge channels", () => {
    expect(DESKTOP_HOST_IPC_CHANNELS).toEqual({
      getAppVersion: "hugecode:desktop-host:get-app-version",
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
      openExternalUrl: "hugecode:desktop-host:open-external-url",
      revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
      getBrowserWorkspaceSession: "hugecode:desktop-host:get-browser-workspace-session",
      ensureBrowserWorkspaceSession: "hugecode:desktop-host:ensure-browser-workspace-session",
      listBrowserWorkspaceSessions: "hugecode:desktop-host:list-browser-workspace-sessions",
      setBrowserWorkspaceHost: "hugecode:desktop-host:set-browser-workspace-host",
      setBrowserWorkspaceProfileMode: "hugecode:desktop-host:set-browser-workspace-profile-mode",
      setBrowserWorkspaceAgentAttached:
        "hugecode:desktop-host:set-browser-workspace-agent-attached",
      setBrowserWorkspacePreviewServerStatus:
        "hugecode:desktop-host:set-browser-workspace-preview-server-status",
      setBrowserWorkspaceDevtoolsOpen: "hugecode:desktop-host:set-browser-workspace-devtools-open",
      setBrowserWorkspacePaneState: "hugecode:desktop-host:set-browser-workspace-pane-state",
      reportBrowserWorkspaceVerification:
        "hugecode:desktop-host:report-browser-workspace-verification",
      getBrowserDebugSession: "hugecode:desktop-host:get-browser-debug-session",
      ensureBrowserDebugSession: "hugecode:desktop-host:ensure-browser-debug-session",
    });
  });
});
