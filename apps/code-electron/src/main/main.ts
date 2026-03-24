import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { app, autoUpdater, BrowserWindow, ipcMain, shell } from "electron";
import { createDesktopMainComposition } from "./createDesktopMainComposition.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

createDesktopMainComposition({
  app,
  arch: process.arch,
  autoUpdater,
  browserWindow: BrowserWindow,
  ipcMain,
  platform: process.platform,
  processArgv: process.argv,
  rendererDevServerUrl: process.env.HUGECODE_ELECTRON_DEV_SERVER_URL?.trim() ?? "",
  releaseChannel:
    (process.env.HUGECODE_ELECTRON_RELEASE_CHANNEL?.trim() as
      | "beta"
      | "dev"
      | "stable"
      | undefined) ?? "beta",
  repositoryUrl: "https://github.com/OpenHuge/HugeCode",
  shell,
  sourceDirectory: __dirname,
  staticUpdateBaseUrl: process.env.HUGECODE_ELECTRON_UPDATE_BASE_URL?.trim() ?? "",
}).start();
