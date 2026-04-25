const { contextBridge, ipcRenderer } = require("electron");

const DESKTOP_HOST_IPC_CHANNELS = {
  getAppInfo: "hugecode:desktop-host:get-app-info",
  getAppVersion: "hugecode:desktop-host:get-app-version",
  getAiWebLabCatalog: "hugecode:desktop-host:get-ai-web-lab-catalog",
  getAiWebLabState: "hugecode:desktop-host:get-ai-web-lab-state",
  openAiWebLabSession: "hugecode:desktop-host:open-ai-web-lab-session",
  openAiWebLabEntrypoint: "hugecode:desktop-host:open-ai-web-lab-entrypoint",
  focusAiWebLabSession: "hugecode:desktop-host:focus-ai-web-lab-session",
  closeAiWebLabSession: "hugecode:desktop-host:close-ai-web-lab-session",
  setAiWebLabViewMode: "hugecode:desktop-host:set-ai-web-lab-view-mode",
  setAiWebLabSessionMode: "hugecode:desktop-host:set-ai-web-lab-session-mode",
  navigateAiWebLab: "hugecode:desktop-host:navigate-ai-web-lab",
  extractAiWebLabArtifact: "hugecode:desktop-host:extract-ai-web-lab-artifact",
  listLocalChromeDebuggerEndpoints: "hugecode:desktop-host:list-local-chrome-debugger-endpoints",
  assessBrowserSurface: "hugecode:desktop-host:assess-browser-surface",
  getLastBrowserAssessmentResult: "hugecode:desktop-host:get-last-browser-assessment-result",
  extractBrowserContent: "hugecode:desktop-host:extract-browser-content",
  getLastBrowserExtractionResult: "hugecode:desktop-host:get-last-browser-extraction-result",
  consumePendingLaunchIntent: "hugecode:desktop-host:consume-pending-launch-intent",
  pushLaunchIntent: "hugecode:desktop-host:push-launch-intent",
  pushUpdateState: "hugecode:desktop-host:push-update-state",
  getCurrentSession: "hugecode:desktop-host:get-current-session",
  listRecentSessions: "hugecode:desktop-host:list-recent-sessions",
  reopenSession: "hugecode:desktop-host:reopen-session",
  getWindowLabel: "hugecode:desktop-host:get-window-label",
  listWindows: "hugecode:desktop-host:list-windows",
  openWindow: "hugecode:desktop-host:open-window",
  focusWindow: "hugecode:desktop-host:focus-window",
  closeWindow: "hugecode:desktop-host:close-window",
  getTrayState: "hugecode:desktop-host:get-tray-state",
  setTrayEnabled: "hugecode:desktop-host:set-tray-enabled",
  showNotification: "hugecode:desktop-host:show-notification",
  openDialog: "hugecode:desktop-host:open-dialog",
  getDiagnosticsInfo: "hugecode:desktop-host:get-diagnostics-info",
  copySupportSnapshot: "hugecode:desktop-host:copy-support-snapshot",
  getUpdateState: "hugecode:desktop-host:get-update-state",
  checkForUpdates: "hugecode:desktop-host:check-for-updates",
  restartToApplyUpdate: "hugecode:desktop-host:restart-to-apply-update",
  openExternalUrl: "hugecode:desktop-host:open-external-url",
  openPathIn: "hugecode:desktop-host:open-path-in",
  openPath: "hugecode:desktop-host:open-path",
  revealItemInDir: "hugecode:desktop-host:reveal-item-in-dir",
};

const desktopHostBridge = {
  kind: "electron",
  core: {
    invoke: (command, payload) => ipcRenderer.invoke(command, payload),
  },
  event: {
    listen: async (eventName, listener) => {
      const wrappedListener = (_event, payload) => {
        listener({ payload });
      };
      ipcRenderer.on(eventName, wrappedListener);
      return () => {
        ipcRenderer.off(eventName, wrappedListener);
      };
    },
  },
  app: {
    getInfo: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAppInfo),
    getVersion: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAppVersion),
  },
  aiWebLab: {
    getCatalog: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAiWebLabCatalog),
    getState: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getAiWebLabState),
    openSession: (input) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openAiWebLabSession, input),
    openEntrypoint: (providerId, entrypointId) =>
      ipcRenderer.invoke(
        DESKTOP_HOST_IPC_CHANNELS.openAiWebLabEntrypoint,
        providerId,
        entrypointId
      ),
    focusSession: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.focusAiWebLabSession),
    closeSession: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.closeAiWebLabSession),
    setViewMode: (mode) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setAiWebLabViewMode, mode),
    setSessionMode: (mode) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setAiWebLabSessionMode, mode),
    navigate: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.navigateAiWebLab, input),
    extractArtifact: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.extractAiWebLabArtifact),
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
      const wrappedListener = (_event, intent) => {
        listener(intent);
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
    reopenSession: (sessionId) =>
      ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.reopenSession, sessionId),
  },
  window: {
    getLabel: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getWindowLabel),
  },
  windowing: {
    closeWindow: (windowId) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.closeWindow, windowId),
    focusWindow: (windowId) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.focusWindow, windowId),
    listWindows: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.listWindows),
    openWindow: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openWindow, input),
  },
  tray: {
    getState: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.getTrayState),
    setEnabled: (enabled) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.setTrayEnabled, enabled),
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
      const wrappedListener = (_event, state) => {
        listener(state);
      };
      ipcRenderer.on(DESKTOP_HOST_IPC_CHANNELS.pushUpdateState, wrappedListener);
      return () => {
        ipcRenderer.off(DESKTOP_HOST_IPC_CHANNELS.pushUpdateState, wrappedListener);
      };
    },
    restartToApplyUpdate: () => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.restartToApplyUpdate),
  },
  shell: {
    openExternalUrl: (url) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openExternalUrl, url),
    openPathIn: (input) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openPathIn, input),
    openPath: (path) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.openPath, path),
    revealItemInDir: (path) => ipcRenderer.invoke(DESKTOP_HOST_IPC_CHANNELS.revealItemInDir, path),
  },
};

contextBridge.exposeInMainWorld("hugeCodeDesktopHost", desktopHostBridge);
