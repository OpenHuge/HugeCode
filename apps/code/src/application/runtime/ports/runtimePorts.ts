import { createRuntimeInfrastructure, type RuntimeInfrastructure } from "./runtimeInfrastructure";
import * as desktopAppSettings from "./desktopAppSettings";
import * as desktopApps from "./desktopApps";
import * as desktopHostCore from "./desktopHostCore";
import * as desktopHostDialogs from "./desktopHostDialogs";
import * as desktopDpi from "./desktopDpi";
import * as desktopFiles from "./desktopFiles";
import * as desktopMenu from "./desktopMenu";
import * as desktopNotifications from "./desktopNotifications";
import * as desktopProcess from "./desktopProcess";
import * as desktopStateFabric from "./desktopStateFabric";
import * as desktopUpdater from "./desktopUpdater";
import * as desktopWebview from "./desktopWebview";
import * as desktopHostWindow from "./desktopHostWindow";

export type DesktopRuntimePorts = {
  appSettings: typeof desktopAppSettings;
  apps: typeof desktopApps;
  core: typeof desktopHostCore;
  dialogs: typeof desktopHostDialogs;
  dpi: typeof desktopDpi;
  files: typeof desktopFiles;
  menu: typeof desktopMenu;
  notifications: typeof desktopNotifications;
  process: typeof desktopProcess;
  stateFabric: typeof desktopStateFabric;
  updater: typeof desktopUpdater;
  webview: typeof desktopWebview;
  window: typeof desktopHostWindow;
};

export type RuntimePorts = {
  infrastructure: RuntimeInfrastructure;
  desktop: DesktopRuntimePorts;
};

export function createRuntimePorts(): RuntimePorts {
  return {
    infrastructure: createRuntimeInfrastructure(),
    desktop: {
      appSettings: desktopAppSettings,
      apps: desktopApps,
      core: desktopHostCore,
      dialogs: desktopHostDialogs,
      dpi: desktopDpi,
      files: desktopFiles,
      menu: desktopMenu,
      notifications: desktopNotifications,
      process: desktopProcess,
      stateFabric: desktopStateFabric,
      updater: desktopUpdater,
      webview: desktopWebview,
      window: desktopHostWindow,
    },
  };
}

export const runtimePorts = createRuntimePorts();
