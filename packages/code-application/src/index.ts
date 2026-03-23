export {
  detectDesktopRuntimeHost,
  openDesktopExternalUrl,
  resolveDesktopAppVersion,
  resolveDesktopSessionInfo,
  resolveDesktopWindowLabel,
  revealDesktopItemInDir,
  showDesktopNotification,
} from "./desktopHostFacade";
export {
  createDesktopWorkspaceClientHostBindings,
  createWorkspaceClientBindings,
} from "./workspaceClientBindings";

export type {
  CreateDesktopWorkspaceClientHostBindingsInput,
  CreateWorkspaceClientBindingsInput,
} from "./workspaceClientBindings";
export type {
  DesktopExternalUrlFallbacks,
  DesktopItemRevealFallbacks,
  DesktopNotificationFallbacks,
  DesktopRuntimeDetectionInput,
  DesktopVersionFallbacks,
  DesktopWindowLabelFallbacks,
} from "./desktopHostFacade";
