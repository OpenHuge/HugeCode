import { BrowserWindow, Notification } from "electron";
import type { DesktopNotificationInput } from "../shared/ipc.js";

type BrowserWindowLike = {
  focus(): void;
  isDestroyed(): boolean;
  show(): void;
};

type BrowserWindowFacade = {
  fromWebContents(webContents: unknown): BrowserWindowLike | null;
};

type NotificationInstance = {
  on(event: "click", listener: () => void): void;
  show(): void;
};

type NotificationFacade = {
  create(input: { body: string; title: string }): NotificationInstance;
  isSupported(): boolean;
};

export type CreateDesktopNotificationControllerInput = {
  browserWindow?: BrowserWindowFacade;
  notification?: NotificationFacade;
};

export type DesktopNotificationController = {
  showDesktopNotification(
    input: DesktopNotificationInput,
    options?: {
      onClick?: () => void;
    }
  ): boolean;
  showNotification(event: { sender: unknown }, input: DesktopNotificationInput): boolean;
};

export function createDesktopNotificationController(
  input: CreateDesktopNotificationControllerInput = {}
): DesktopNotificationController {
  const browserWindow = input.browserWindow ?? {
    fromWebContents(webContents) {
      return BrowserWindow.fromWebContents(webContents as Electron.WebContents);
    },
  };
  const notification = input.notification ?? {
    create(notificationInput) {
      return new Notification(notificationInput);
    },
    isSupported() {
      return Notification.isSupported();
    },
  };

  return {
    showDesktopNotification(notificationInput, options = {}) {
      if (!notification.isSupported()) {
        return false;
      }

      const desktopNotification = notification.create({
        title: notificationInput.title,
        body: notificationInput.body ?? "",
      });
      if (options.onClick) {
        desktopNotification.on("click", options.onClick);
      }
      desktopNotification.show();
      return true;
    },
    showNotification(event, notificationInput) {
      if (!notification.isSupported()) {
        return false;
      }

      const sourceWindow = browserWindow.fromWebContents(event.sender);
      return this.showDesktopNotification(notificationInput, {
        onClick: () => {
          if (sourceWindow && !sourceWindow.isDestroyed()) {
            sourceWindow.show();
            sourceWindow.focus();
          }
        },
      });
    },
  };
}
