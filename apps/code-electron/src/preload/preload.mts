import { createRequire } from "node:module";
import { DESKTOP_HOST_IPC_CHANNELS } from "../shared/ipc.js";
import type { DesktopHostBridgeApi } from "../shared/ipc.js";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron");

const desktopHostBridge: DesktopHostBridgeApi = {
  kind: "electron",
  app: {
    getVersion: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAppVersion),
  },
  browserWorkspace: {
    getSession: (query) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getBrowserWorkspaceSession, query),
    ensureSession: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.ensureBrowserWorkspaceSession, input),
    listSessions: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.listBrowserWorkspaceSessions),
    setHost: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setBrowserWorkspaceHost, input),
    setProfileMode: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setBrowserWorkspaceProfileMode, input),
    setAgentAttached: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setBrowserWorkspaceAgentAttached, input),
    setPreviewServerStatus: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setBrowserWorkspacePreviewServerStatus, input),
    setDevtoolsOpen: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setBrowserWorkspaceDevtoolsOpen, input),
    setPaneState: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setBrowserWorkspacePaneState, input),
    navigate: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.navigateBrowserWorkspaceSession, input),
    reportVerification: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.reportBrowserWorkspaceVerification, input),
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
  browserDebug: {
    getSession: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getBrowserDebugSession),
    ensureSession: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.ensureBrowserDebugSession, input),
  },
};

contextBridge.exposeInMainWorld("hugeCodeDesktopHost", desktopHostBridge);
