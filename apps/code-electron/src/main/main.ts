import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import {
  ensureBrowserWorkspaceSession,
  ensureBrowserDebugSession,
  getBrowserWorkspaceSession,
  getBrowserDebugSession,
  listBrowserWorkspaceSessions,
  resolveBrowserDebugPort,
  setBrowserWorkspaceAgentAttached,
  setBrowserWorkspaceDevtoolsOpen,
  setBrowserWorkspaceHost,
  setBrowserWorkspacePreviewServerStatus,
  setBrowserWorkspaceProfileMode,
} from "./browserDebugSession.js";
import { createDesktopMainComposition } from "./createDesktopMainComposition.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererDevServerUrl = process.env.HUGECODE_ELECTRON_DEV_SERVER_URL?.trim() ?? "";
const enableAppSandbox = process.env.HUGECODE_ELECTRON_ENABLE_SANDBOX === "1";

app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");
app.commandLine.appendSwitch("remote-debugging-port", String(resolveBrowserDebugPort()));

createDesktopMainComposition({
  app,
  browserDebugController: {
    ensureBrowserDebugSession,
    getBrowserDebugSession,
  },
  browserWorkspaceController: {
    ensureBrowserWorkspaceSession,
    getBrowserWorkspaceSession,
    listBrowserWorkspaceSessions,
    setBrowserWorkspaceAgentAttached,
    setBrowserWorkspaceDevtoolsOpen,
    setBrowserWorkspaceHost,
    setBrowserWorkspacePreviewServerStatus,
    setBrowserWorkspaceProfileMode,
  },
  browserWindow: BrowserWindow,
  enableAppSandbox,
  ipcMain,
  platform: process.platform,
  preloadPath: join(__dirname, "../preload/preload.mjs"),
  rendererDevServerUrl,
  shell,
  sourceDirectory: __dirname,
}).start();
