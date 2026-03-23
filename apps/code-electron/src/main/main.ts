import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { createDesktopMainComposition } from "./createDesktopMainComposition.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

createDesktopMainComposition({
  app,
  browserWindow: BrowserWindow,
  ipcMain,
  platform: process.platform,
  rendererDevServerUrl: process.env.HUGECODE_ELECTRON_DEV_SERVER_URL?.trim() ?? "",
  shell,
  sourceDirectory: __dirname,
}).start();
