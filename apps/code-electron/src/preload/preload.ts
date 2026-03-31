import { contextBridge, ipcRenderer } from "electron";
import type { DesktopHostBridgeApi } from "@ku0/code-platform-interfaces";
import { DESKTOP_HOST_IPC_CHANNELS } from "@ku0/code-platform-interfaces";

const desktopHostBridge: DesktopHostBridgeApi = {
  kind: "electron",
  app: {
    getInfo: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAppInfo),
    getVersion: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAppVersion),
  },
  browserDebug: {
    listLocalChromeDebuggerEndpoints: () =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.listLocalChromeDebuggerEndpoints),
  },
  browserAssessment: {
    assess: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.assessBrowserSurface, input),
    getLastResult: () =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getLastBrowserAssessmentResult),
  },
  browserExtraction: {
    extract: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.extractBrowserContent, input),
    getLastResult: () =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getLastBrowserExtractionResult),
  },
  launch: {
    consumePendingIntent: () =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.consumePendingLaunchIntent),
    onIntent: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, intent: unknown) => {
        listener(intent as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(DESKTOP_HOST_IPC_CHANNELS.pushLaunchIntent, wrappedListener);
      return () => {
        ipcRenderer.off(DESKTOP_HOST_IPC_CHANNELS.pushLaunchIntent, wrappedListener);
      };
    },
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
  dialogs: {
    open: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openDialog, input),
  },
  diagnostics: {
    copySupportSnapshot: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.copySupportSnapshot),
    getInfo: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getDiagnosticsInfo),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.checkForUpdates),
    getState: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getUpdateState),
    onState: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
        listener(state as Parameters<typeof listener>[0]);
      };
      ipcRenderer.on(DESKTOP_HOST_IPC_CHANNELS.pushUpdateState, wrappedListener);
      return () => {
        ipcRenderer.off(DESKTOP_HOST_IPC_CHANNELS.pushUpdateState, wrappedListener);
      };
    },
    restartToApplyUpdate: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.restartToApplyUpdate),
  },
  shell: {
    openExternalUrl: (url: string) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openExternalUrl, url),
    openPathIn: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openPathIn, input),
    openPath: (path: string) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openPath, path),
    revealItemInDir: (path: string) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.revealItemInDir, path),
  },
};

contextBridge.exposeInMainWorld("hugeCodeDesktopHost", desktopHostBridge);
