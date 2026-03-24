import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { app, autoUpdater, BrowserWindow, ipcMain, protocol, session, shell } from "electron";
import { createDesktopMainComposition } from "./createDesktopMainComposition.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

createDesktopMainComposition({
  app,
  autoUpdater,
  arch: process.arch,
  browserWindow: {
    create(options) {
      return new BrowserWindow(options);
    },
    fromWebContents(webContents) {
      return BrowserWindow.fromWebContents(webContents as Electron.WebContents);
    },
    getAllWindows() {
      return BrowserWindow.getAllWindows();
    },
  },
  ipcMain,
  platform: process.platform,
  protocol,
  processArgv: process.argv,
  rendererDevServerUrl: process.env.HUGECODE_ELECTRON_DEV_SERVER_URL?.trim() ?? "",
  releaseChannel:
    (process.env.HUGECODE_ELECTRON_RELEASE_CHANNEL?.trim() as
      | "beta"
      | "dev"
      | "stable"
      | undefined) ?? "beta",
  repositoryUrl: "https://github.com/OpenHuge/HugeCode",
  session,
  shell,
  sourceDirectory: __dirname,
  staticUpdateBaseUrl: process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL?.trim() ?? "",
}).start();
