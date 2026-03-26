import {
  type DesktopBrowserDebugSessionInfo,
  type DesktopBrowserDebugSessionInput,
  type DesktopBrowserWorkspaceSessionInfo,
  type DesktopBrowserWorkspaceSessionInput,
  type DesktopBrowserWorkspaceSessionKind,
  type DesktopBrowserWorkspaceSessionQuery,
  type DesktopBrowserWorkspaceNavigateInput,
  type DesktopBrowserWorkspaceSetPaneStateInput,
  type DesktopBrowserWorkspaceReportVerificationInput,
  type DesktopBrowserWorkspaceSetAgentAttachedInput,
  type DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  type DesktopBrowserWorkspaceSetHostInput,
  type DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  type DesktopBrowserWorkspaceSetProfileModeInput,
  isElectronDesktopHostBridge,
  type DesktopHostBridge,
  type DesktopHostKind,
  type DesktopNotificationInput,
  type DesktopRuntimeMode,
  type DesktopSessionInfo,
  type DesktopTrayState,
  type DesktopWindowInfo,
  type DesktopWindowLabel,
  type OpenDesktopWindowInput,
} from "@ku0/code-platform-interfaces";

export type {
  DesktopHostBridge,
  DesktopHostKind,
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionInput,
  DesktopBrowserWorkspaceSessionKind,
  DesktopBrowserWorkspaceSessionQuery,
  DesktopBrowserWorkspaceNavigateInput,
  DesktopBrowserWorkspaceSetPaneStateInput,
  DesktopBrowserWorkspaceReportVerificationInput,
  DesktopBrowserWorkspaceSetAgentAttachedInput,
  DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  DesktopBrowserWorkspaceSetHostInput,
  DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  DesktopBrowserWorkspaceSetProfileModeInput,
  DesktopNotificationInput,
  DesktopRuntimeMode,
  DesktopSessionInfo,
  DesktopTrayState,
  DesktopWindowInfo,
  DesktopWindowLabel,
  OpenDesktopWindowInput,
};

declare global {
  interface Window {
    hugeCodeDesktopHost?: DesktopHostBridge;
  }
}

export function getDesktopHostBridge(): DesktopHostBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const bridge = window.hugeCodeDesktopHost;
  if (!isElectronDesktopHostBridge(bridge)) {
    return null;
  }

  return bridge;
}
