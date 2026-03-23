import type { IpcMainInvokeEvent } from "electron";
import type { DesktopNotificationInput, OpenDesktopWindowInput } from "../shared/ipc.js";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";

type IpcInvokeEventLike = IpcMainInvokeEvent;

type IpcMainLike = {
  handle(
    channel: string,
    listener: (event: IpcInvokeEventLike, ...args: unknown[]) => unknown
  ): void;
};

type DesktopWindowDescriptor = {
  focused: boolean;
  hidden?: boolean;
  sessionId: string;
  windowId: number;
  windowLabel: string;
  workspaceLabel: string | null;
};

type DesktopTrayState = {
  enabled: boolean;
  supported: boolean;
};

type DesktopHostIpcHandlers = {
  closeWindow(windowId: number): Promise<boolean> | boolean;
  focusWindow(windowId: number): Promise<boolean> | boolean;
  getAppVersion(): Promise<string | null> | string | null;
  getCurrentSession(event: IpcInvokeEventLike): Promise<unknown> | unknown;
  getTrayState(): Promise<DesktopTrayState> | DesktopTrayState;
  getWindowLabel(event: IpcInvokeEventLike): Promise<string> | string;
  listRecentSessions(): Promise<unknown[]> | unknown[];
  listWindows(): Promise<DesktopWindowDescriptor[]> | DesktopWindowDescriptor[];
  openExternalUrl(url: string): Promise<boolean> | boolean;
  openWindow(input?: OpenDesktopWindowInput): Promise<unknown> | unknown;
  reopenSession(sessionId: string): Promise<boolean> | boolean;
  revealItemInDir(path: string): Promise<boolean> | boolean;
  setTrayEnabled(enabled: boolean): Promise<DesktopTrayState> | DesktopTrayState;
  showNotification(
    event: IpcInvokeEventLike,
    input: DesktopNotificationInput
  ): Promise<boolean> | boolean;
};

export type RegisterDesktopHostIpcInput = {
  channels: typeof DESKTOP_HOST_IPC_CHANNELS;
  handlers: DesktopHostIpcHandlers;
  ipcMain: IpcMainLike;
  isTrustedSender(event: IpcInvokeEventLike): boolean;
};

export function registerDesktopHostIpc(input: RegisterDesktopHostIpcInput) {
  const { channels, handlers, ipcMain, isTrustedSender } = input;

  function handleTrusted(
    channel: string,
    listener: (event: IpcInvokeEventLike, ...args: unknown[]) => unknown
  ) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isTrustedSender(event)) {
        throw new Error("Blocked untrusted desktop IPC sender.");
      }

      return listener(event, ...args);
    });
  }

  handleTrusted(channels.getAppVersion, async () => {
    return handlers.getAppVersion();
  });

  handleTrusted(channels.getCurrentSession, async (event) => {
    return handlers.getCurrentSession(event);
  });

  handleTrusted(channels.listRecentSessions, async () => {
    return handlers.listRecentSessions();
  });

  handleTrusted(channels.reopenSession, async (_event, sessionId) => {
    return handlers.reopenSession(sessionId as string);
  });

  handleTrusted(channels.getWindowLabel, async (event) => {
    return handlers.getWindowLabel(event);
  });

  handleTrusted(channels.listWindows, async () => {
    return handlers.listWindows();
  });

  handleTrusted(channels.openWindow, async (_event, openWindowInput) => {
    return handlers.openWindow(openWindowInput as OpenDesktopWindowInput | undefined);
  });

  handleTrusted(channels.focusWindow, async (_event, windowId) => {
    return handlers.focusWindow(windowId as number);
  });

  handleTrusted(channels.closeWindow, async (_event, windowId) => {
    return handlers.closeWindow(windowId as number);
  });

  handleTrusted(channels.getTrayState, async () => {
    return handlers.getTrayState();
  });

  handleTrusted(channels.setTrayEnabled, async (_event, enabled) => {
    return handlers.setTrayEnabled(enabled === true);
  });

  handleTrusted(channels.showNotification, async (event, notificationInput) => {
    return handlers.showNotification(event, notificationInput as DesktopNotificationInput);
  });

  handleTrusted(channels.openExternalUrl, async (_event, url) => {
    return handlers.openExternalUrl(url as string);
  });

  handleTrusted(channels.revealItemInDir, async (_event, path) => {
    return handlers.revealItemInDir(path as string);
  });
}
