import { contextBridge, ipcRenderer } from "electron";

const BROWSER_LOGIN_STATE_PREFLIGHT_CHANNEL = "hugecode:browser-static-data:check-login-state";
const BROWSER_LOGIN_STATE_EXPORT_CHANNEL = "hugecode:browser-static-data:export-login-state";
const BROWSER_LOGIN_STATE_IMPORT_CHANNEL = "hugecode:browser-static-data:import-login-state";
const BROWSER_SITE_DATA_EXPORT_TO_CHROME_CHANNEL = "hugecode:browser-static-data:export-to-chrome";
const RUNTIME_RPC_INVOKE_CHANNEL = "hugecode:runtime:invoke";
const BROWSER_CHROME_GET_SNAPSHOT_CHANNEL = "hugecode:browser-chrome:get-snapshot";
const BROWSER_CHROME_CREATE_TAB_CHANNEL = "hugecode:browser-chrome:create-tab";
const BROWSER_CHROME_CLOSE_TAB_CHANNEL = "hugecode:browser-chrome:close-tab";
const BROWSER_CHROME_CLOSE_WINDOW_CHANNEL = "hugecode:browser-chrome:close-window";
const BROWSER_CHROME_ACTIVATE_TAB_CHANNEL = "hugecode:browser-chrome:activate-tab";
const BROWSER_CHROME_NAVIGATE_CHANNEL = "hugecode:browser-chrome:navigate";
const BROWSER_CHROME_GO_BACK_CHANNEL = "hugecode:browser-chrome:go-back";
const BROWSER_CHROME_GO_FORWARD_CHANNEL = "hugecode:browser-chrome:go-forward";
const BROWSER_CHROME_RELOAD_CHANNEL = "hugecode:browser-chrome:reload";
const BROWSER_CHROME_STOP_CHANNEL = "hugecode:browser-chrome:stop";
const BROWSER_CHROME_SNAPSHOT_CHANNEL = "hugecode:browser-chrome:snapshot";
const OPENHUGE_DELIVERY_INVOKE_CHANNEL = "hugecode:openhuge-delivery:invoke";
const OPENHUGE_CONSUMER_DEBUG_CHANNEL = "hugecode:openhuge-consumer-debug:write";
const EMBEDDED_BROWSER_SHOW_CHANNEL = "hugecode:embedded-browser:show";
const EMBEDDED_BROWSER_SET_BOUNDS_CHANNEL = "hugecode:embedded-browser:set-bounds";
const EMBEDDED_BROWSER_HIDE_CHANNEL = "hugecode:embedded-browser:hide";
const EMBEDDED_BROWSER_AUTH_REQUIRED_CHANNEL = "hugecode:embedded-browser:auth-required";
const OPERATOR_UNLOCK_OVERLAY_SHOW_CHANNEL = "hugecode:operator-unlock-overlay:show";
const OPERATOR_UNLOCK_OVERLAY_CLOSE_CHANNEL = "hugecode:operator-unlock-overlay:close";
const OPERATOR_UNLOCK_OVERLAY_ATTEMPT_CHANNEL = "hugecode:operator-unlock-overlay:attempt";
const OPERATOR_UNLOCK_OVERLAY_SUBMIT_CHANNEL = "hugecode:operator-unlock-overlay:submit";
const OPERATOR_UNLOCK_OVERLAY_RESOLVE_CHANNEL = "hugecode:operator-unlock-overlay:resolve";

contextBridge.exposeInMainWorld("hugeCodeDesktop", {
  kind: "electron",
  platform: process.platform,
});

contextBridge.exposeInMainWorld("hugeCodeDesktopHost", {
  browserChrome: {
    activateTab: (input: { tabId: string }) =>
      ipcRenderer.invoke(BROWSER_CHROME_ACTIVATE_TAB_CHANNEL, input),
    closeTab: (input: { tabId: string }) =>
      ipcRenderer.invoke(BROWSER_CHROME_CLOSE_TAB_CHANNEL, input),
    closeWindow: () => ipcRenderer.invoke(BROWSER_CHROME_CLOSE_WINDOW_CHANNEL),
    createTab: (input?: { activate?: boolean; url?: string | null }) =>
      ipcRenderer.invoke(BROWSER_CHROME_CREATE_TAB_CHANNEL, input ?? {}),
    getSnapshot: () => ipcRenderer.invoke(BROWSER_CHROME_GET_SNAPSHOT_CHANNEL),
    goBack: (input?: { tabId?: string | null }) =>
      ipcRenderer.invoke(BROWSER_CHROME_GO_BACK_CHANNEL, input ?? {}),
    goForward: (input?: { tabId?: string | null }) =>
      ipcRenderer.invoke(BROWSER_CHROME_GO_FORWARD_CHANNEL, input ?? {}),
    navigate: (input: { tabId?: string | null; url: string }) =>
      ipcRenderer.invoke(BROWSER_CHROME_NAVIGATE_CHANNEL, input),
    reload: (input?: { tabId?: string | null }) =>
      ipcRenderer.invoke(BROWSER_CHROME_RELOAD_CHANNEL, input ?? {}),
    stop: (input?: { tabId?: string | null }) =>
      ipcRenderer.invoke(BROWSER_CHROME_STOP_CHANNEL, input ?? {}),
    subscribe: (listener: (snapshot: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => listener(snapshot);
      ipcRenderer.on(BROWSER_CHROME_SNAPSHOT_CHANNEL, handler);
      return () => ipcRenderer.removeListener(BROWSER_CHROME_SNAPSHOT_CHANNEL, handler);
    },
  },
  browserStaticData: {
    checkLoginState: (input?: unknown) =>
      ipcRenderer.invoke(BROWSER_LOGIN_STATE_PREFLIGHT_CHANNEL, input),
    exportLoginState: (input?: unknown) =>
      ipcRenderer.invoke(BROWSER_LOGIN_STATE_EXPORT_CHANNEL, input),
    exportToChrome: (input: unknown) =>
      ipcRenderer.invoke(BROWSER_SITE_DATA_EXPORT_TO_CHROME_CHANNEL, input),
    importLoginState: (bundle: unknown, input?: unknown) =>
      ipcRenderer.invoke(BROWSER_LOGIN_STATE_IMPORT_CHANNEL, bundle, input),
  },
  core: {
    invoke: (method: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke(RUNTIME_RPC_INVOKE_CHANNEL, method, payload ?? {}),
  },
  embeddedBrowser: {
    hide: () => ipcRenderer.invoke(EMBEDDED_BROWSER_HIDE_CHANNEL),
    setBounds: (input: unknown) => ipcRenderer.invoke(EMBEDDED_BROWSER_SET_BOUNDS_CHANNEL, input),
    show: (input: unknown) => ipcRenderer.invoke(EMBEDDED_BROWSER_SHOW_CHANNEL, input),
    subscribeAuthRequired: (listener: (payload: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
      ipcRenderer.on(EMBEDDED_BROWSER_AUTH_REQUIRED_CHANNEL, handler);
      return () => ipcRenderer.removeListener(EMBEDDED_BROWSER_AUTH_REQUIRED_CHANNEL, handler);
    },
  },
  operatorUnlockOverlay: {
    close: () => ipcRenderer.invoke(OPERATOR_UNLOCK_OVERLAY_CLOSE_CHANNEL),
    resolveSubmit: (input: unknown) =>
      ipcRenderer.invoke(OPERATOR_UNLOCK_OVERLAY_RESOLVE_CHANNEL, input),
    show: () => ipcRenderer.invoke(OPERATOR_UNLOCK_OVERLAY_SHOW_CHANNEL),
    submitPassword: (input: unknown) =>
      ipcRenderer.invoke(OPERATOR_UNLOCK_OVERLAY_ATTEMPT_CHANNEL, input),
    subscribeSubmit: (listener: (payload: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => listener(payload);
      ipcRenderer.on(OPERATOR_UNLOCK_OVERLAY_SUBMIT_CHANNEL, handler);
      return () => ipcRenderer.removeListener(OPERATOR_UNLOCK_OVERLAY_SUBMIT_CHANNEL, handler);
    },
  },
  openHugeDelivery: {
    invoke: (operation: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke(OPENHUGE_DELIVERY_INVOKE_CHANNEL, operation, payload ?? {}),
  },
  openHugeConsumerDebug: {
    write: (event: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke(OPENHUGE_CONSUMER_DEBUG_CHANNEL, { event, payload: payload ?? {} }),
  },
});
