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
};

export function registerDesktopHostIpc(input: RegisterDesktopHostIpcInput) {
  const { channels, handlers, ipcMain } = input;

  ipcMain.handle(channels.getAppVersion, async () => {
    return handlers.getAppVersion();
  });

  ipcMain.handle(channels.getCurrentSession, async (event) => {
    return handlers.getCurrentSession(event);
  });

  ipcMain.handle(channels.listRecentSessions, async () => {
    return handlers.listRecentSessions();
  });

  ipcMain.handle(channels.reopenSession, async (_event, sessionId) => {
    return handlers.reopenSession(sessionId as string);
  });

  ipcMain.handle(channels.getWindowLabel, async (event) => {
    return handlers.getWindowLabel(event);
  });

  ipcMain.handle(channels.listWindows, async () => {
    return handlers.listWindows();
  });

  ipcMain.handle(channels.openWindow, async (_event, openWindowInput) => {
    return handlers.openWindow(openWindowInput as OpenDesktopWindowInput | undefined);
  });

  ipcMain.handle(channels.focusWindow, async (_event, windowId) => {
    return handlers.focusWindow(windowId as number);
  });

  ipcMain.handle(channels.closeWindow, async (_event, windowId) => {
    return handlers.closeWindow(windowId as number);
  });

  ipcMain.handle(channels.getTrayState, async () => {
    return handlers.getTrayState();
  });

  ipcMain.handle(channels.setTrayEnabled, async (_event, enabled) => {
    return handlers.setTrayEnabled(enabled === true);
  });

  ipcMain.handle(channels.showNotification, async (event, notificationInput) => {
    return handlers.showNotification(event, notificationInput as DesktopNotificationInput);
  });

  ipcMain.handle(channels.openExternalUrl, async (_event, url) => {
    return handlers.openExternalUrl(url as string);
  });

  ipcMain.handle(channels.revealItemInDir, async (_event, path) => {
    return handlers.revealItemInDir(path as string);
  });
}
