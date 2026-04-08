import {
  type AiWebLabProviderId,
  type DesktopAppInfo,
  type DesktopAiWebLabArtifact,
  type DesktopAiWebLabCatalog,
  type DesktopAiWebLabNavigationInput,
  type DesktopAiWebLabOpenInput,
  type DesktopAiWebLabSessionMode,
  type DesktopAiWebLabState,
  type DesktopAiWebLabViewMode,
  type DesktopDiagnosticsInfo,
  type LocalChromeDebuggerEndpointDescriptor,
  isElectronDesktopHostBridge,
  type DesktopLaunchIntent,
  type DesktopHostBridge,
  type DesktopHostKind,
  type DesktopNotificationInput,
  type DesktopRuntimeMode,
  type DesktopSessionInfo,
  type DesktopTrayState,
  type DesktopUpdateState,
  type DesktopWindowInfo,
  type DesktopWindowLabel,
  type OpenDesktopWindowInput,
} from "@ku0/code-platform-interfaces";

export type {
  AiWebLabProviderId,
  DesktopAppInfo,
  DesktopAiWebLabArtifact,
  DesktopAiWebLabCatalog,
  DesktopAiWebLabNavigationInput,
  DesktopAiWebLabOpenInput,
  DesktopAiWebLabSessionMode,
  DesktopAiWebLabState,
  DesktopAiWebLabViewMode,
  DesktopDiagnosticsInfo,
  DesktopLaunchIntent,
  DesktopHostBridge,
  DesktopHostKind,
  LocalChromeDebuggerEndpointDescriptor,
  DesktopNotificationInput,
  DesktopRuntimeMode,
  DesktopSessionInfo,
  DesktopTrayState,
  DesktopUpdateState,
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
