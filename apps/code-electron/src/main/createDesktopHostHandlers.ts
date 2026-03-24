import type {
  DesktopBrowserDebugSessionInfo,
  DesktopBrowserDebugSessionInput,
  DesktopBrowserWorkspaceNavigateInput,
  DesktopBrowserWorkspaceReportVerificationInput,
  DesktopBrowserWorkspaceSessionInfo,
  DesktopBrowserWorkspaceSessionInput,
  DesktopBrowserWorkspaceSessionQuery,
  DesktopBrowserWorkspaceSetAgentAttachedInput,
  DesktopBrowserWorkspaceSetDevtoolsOpenInput,
  DesktopBrowserWorkspaceSetHostInput,
  DesktopBrowserWorkspaceSetPaneStateInput,
  DesktopBrowserWorkspaceSetPreviewServerStatusInput,
  DesktopBrowserWorkspaceSetProfileModeInput,
  DesktopNotificationInput,
} from "../shared/ipc.js";
import type { DesktopWindowDescriptor } from "./desktopShellState.js";

type WindowController = {
  closeWindow(windowId: number): boolean;
  focusWindow(windowId: number): boolean;
  getSessionForWebContents(webContents: unknown): unknown;
  getWindowLabelForWebContents(webContents: unknown): string;
  listWindows(): DesktopWindowDescriptor[];
  openWindow(): unknown;
  reopenSession(sessionId: string): boolean;
};

type TrayController = {
  getState(): { enabled: boolean; supported: boolean };
  update(): void;
};

type NotificationController = {
  showNotification(event: { sender: unknown }, input: DesktopNotificationInput): boolean;
};

type BrowserDebugController = {
  ensureBrowserDebugSession(
    input?: DesktopBrowserDebugSessionInput
  ): Promise<DesktopBrowserDebugSessionInfo | null> | DesktopBrowserDebugSessionInfo | null;
  getBrowserDebugSession():
    | Promise<DesktopBrowserDebugSessionInfo | null>
    | DesktopBrowserDebugSessionInfo
    | null;
};

type BrowserWorkspaceController = {
  ensureBrowserWorkspaceSession(
    input?: DesktopBrowserWorkspaceSessionInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  getBrowserWorkspaceSession(
    query?: DesktopBrowserWorkspaceSessionQuery
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  listBrowserWorkspaceSessions():
    | Promise<DesktopBrowserWorkspaceSessionInfo[]>
    | DesktopBrowserWorkspaceSessionInfo[];
  setBrowserWorkspaceAgentAttached(
    input: DesktopBrowserWorkspaceSetAgentAttachedInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspaceDevtoolsOpen(
    input: DesktopBrowserWorkspaceSetDevtoolsOpenInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  navigateBrowserWorkspaceSession(
    input: DesktopBrowserWorkspaceNavigateInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspacePaneState(
    event: { sender: unknown },
    input: DesktopBrowserWorkspaceSetPaneStateInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspaceHost(
    input: DesktopBrowserWorkspaceSetHostInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspacePreviewServerStatus(
    input: DesktopBrowserWorkspaceSetPreviewServerStatusInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  setBrowserWorkspaceProfileMode(
    input: DesktopBrowserWorkspaceSetProfileModeInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
  reportBrowserWorkspaceVerification(
    input: DesktopBrowserWorkspaceReportVerificationInput
  ): Promise<DesktopBrowserWorkspaceSessionInfo | null> | DesktopBrowserWorkspaceSessionInfo | null;
};

export type CreateDesktopHostHandlersInput = {
  appVersion: string | null;
  browserDebugController: BrowserDebugController;
  browserWorkspaceController: BrowserWorkspaceController;
  listRecentSessions(): unknown[];
  notificationController: NotificationController;
  openExternalUrl(url: string): Promise<boolean> | boolean;
  persistTrayEnabled(enabled: boolean): void;
  revealItemInDir(path: string): Promise<boolean> | boolean;
  trayController: TrayController;
  windowController: WindowController;
};

export function createDesktopHostHandlers(input: CreateDesktopHostHandlersInput) {
  return {
    closeWindow: input.windowController.closeWindow,
    ensureBrowserDebugSession: input.browserDebugController.ensureBrowserDebugSession,
    ensureBrowserWorkspaceSession: input.browserWorkspaceController.ensureBrowserWorkspaceSession,
    focusWindow: input.windowController.focusWindow,
    getAppVersion() {
      return input.appVersion;
    },
    getBrowserDebugSession: input.browserDebugController.getBrowserDebugSession,
    getBrowserWorkspaceSession: input.browserWorkspaceController.getBrowserWorkspaceSession,
    getCurrentSession(event: { sender: unknown }) {
      return input.windowController.getSessionForWebContents(event.sender);
    },
    getTrayState() {
      return input.trayController.getState();
    },
    getWindowLabel(event: { sender: unknown }) {
      return input.windowController.getWindowLabelForWebContents(event.sender);
    },
    listRecentSessions() {
      return input.listRecentSessions();
    },
    listBrowserWorkspaceSessions: input.browserWorkspaceController.listBrowserWorkspaceSessions,
    listWindows: input.windowController.listWindows,
    openExternalUrl: input.openExternalUrl,
    openWindow: input.windowController.openWindow,
    reopenSession: input.windowController.reopenSession,
    revealItemInDir: input.revealItemInDir,
    setBrowserWorkspaceAgentAttached:
      input.browserWorkspaceController.setBrowserWorkspaceAgentAttached,
    setBrowserWorkspaceDevtoolsOpen:
      input.browserWorkspaceController.setBrowserWorkspaceDevtoolsOpen,
    navigateBrowserWorkspaceSession:
      input.browserWorkspaceController.navigateBrowserWorkspaceSession,
    setBrowserWorkspacePaneState(
      event: { sender: unknown },
      paneInput: DesktopBrowserWorkspaceSetPaneStateInput
    ) {
      return input.browserWorkspaceController.setBrowserWorkspacePaneState(event, paneInput);
    },
    setBrowserWorkspaceHost: input.browserWorkspaceController.setBrowserWorkspaceHost,
    setBrowserWorkspacePreviewServerStatus:
      input.browserWorkspaceController.setBrowserWorkspacePreviewServerStatus,
    setBrowserWorkspaceProfileMode: input.browserWorkspaceController.setBrowserWorkspaceProfileMode,
    reportBrowserWorkspaceVerification:
      input.browserWorkspaceController.reportBrowserWorkspaceVerification,
    setTrayEnabled(enabled: boolean) {
      input.persistTrayEnabled(enabled);
      input.trayController.update();
      return input.trayController.getState();
    },
    showNotification(event: { sender: unknown }, notificationInput: DesktopNotificationInput) {
      return input.notificationController.showNotification(event, notificationInput);
    },
  };
}
