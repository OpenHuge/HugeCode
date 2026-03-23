import {
  type DesktopBrowserDebugSessionInfo,
  type DesktopBrowserDebugSessionInput,
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
