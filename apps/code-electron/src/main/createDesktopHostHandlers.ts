import type {
  DesktopAppInfo,
  DesktopLaunchIntent,
  DesktopNotificationInput,
  DesktopUpdateState,
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

type UpdaterController = {
  checkForUpdates(): DesktopUpdateState;
  getState(): DesktopUpdateState;
  restartToApplyUpdate(): boolean;
};

export type CreateDesktopHostHandlersInput = {
  appInfo: DesktopAppInfo;
  appVersion: string | null;
  consumePendingLaunchIntent(): DesktopLaunchIntent | null;
  listRecentSessions(): unknown[];
  notificationController: NotificationController;
  openExternalUrl(url: string): Promise<boolean> | boolean;
  persistTrayEnabled(enabled: boolean): void;
  revealItemInDir(path: string): Promise<boolean> | boolean;
  trayController: TrayController;
  updaterController: UpdaterController;
  windowController: WindowController;
};

export function createDesktopHostHandlers(input: CreateDesktopHostHandlersInput) {
  return {
    checkForUpdates() {
      return input.updaterController.checkForUpdates();
    },
    closeWindow: input.windowController.closeWindow,
    consumePendingLaunchIntent() {
      return input.consumePendingLaunchIntent();
    },
    focusWindow: input.windowController.focusWindow,
    getAppInfo() {
      return input.appInfo;
    },
    getAppVersion() {
      return input.appVersion;
    },
    getCurrentSession(event: { sender: unknown }) {
      return input.windowController.getSessionForWebContents(event.sender);
    },
    getTrayState() {
      return input.trayController.getState();
    },
    getUpdateState() {
      return input.updaterController.getState();
    },
    getWindowLabel(event: { sender: unknown }) {
      return input.windowController.getWindowLabelForWebContents(event.sender);
    },
    listRecentSessions() {
      return input.listRecentSessions();
    },
    listWindows: input.windowController.listWindows,
    openExternalUrl: input.openExternalUrl,
    openWindow: input.windowController.openWindow,
    reopenSession: input.windowController.reopenSession,
    revealItemInDir: input.revealItemInDir,
    restartToApplyUpdate() {
      return input.updaterController.restartToApplyUpdate();
    },
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
