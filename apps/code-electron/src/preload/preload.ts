import { contextBridge, ipcRenderer } from "electron";
import type { DesktopHostBridgeApi } from "../shared/ipc.js";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";

const desktopHostBridge: DesktopHostBridgeApi = {
  kind: "electron",
  app: {
    getVersion: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAppVersion),
  },
  session: {
    getCurrentSession: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getCurrentSession),
    listRecentSessions: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.listRecentSessions),
    reopenSession: (sessionId: string) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.reopenSession, sessionId),
  },
  window: {
    getLabel: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getWindowLabel),
  },
  windowing: {
    closeWindow: (windowId: number) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.closeWindow, windowId),
    focusWindow: (windowId: number) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.focusWindow, windowId),
    listWindows: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.listWindows),
    openWindow: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openWindow, input),
  },
  tray: {
    getState: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getTrayState),
    setEnabled: (enabled: boolean) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setTrayEnabled, enabled),
  },
  notifications: {
    show: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.showNotification, input),
  },
  shell: {
    openExternalUrl: (url: string) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openExternalUrl, url),
    revealItemInDir: (path: string) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.revealItemInDir, path),
  },
};

contextBridge.exposeInMainWorld("hugeCodeDesktopHost", desktopHostBridge);
