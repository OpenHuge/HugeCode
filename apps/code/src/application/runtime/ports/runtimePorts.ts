import { createRuntimeInfrastructure, type RuntimeInfrastructure } from "./runtimeInfrastructure";
import * as tauriAppSettings from "./tauriAppSettings";
import * as tauriApps from "./tauriApps";
import * as tauriCore from "./tauriCore";
import * as tauriDialogs from "./tauriDialogs";
import * as tauriDpi from "./tauriDpi";
import * as tauriFiles from "./tauriFiles";
import * as tauriMenu from "./tauriMenu";
import * as tauriNotifications from "./tauriNotifications";
import * as tauriOpener from "./tauriOpener";
import * as tauriProcess from "./tauriProcess";
import * as tauriStateFabric from "./tauriStateFabric";
import * as tauriUpdater from "./tauriUpdater";
import * as tauriWebview from "./tauriWebview";
import * as tauriWindow from "./tauriWindow";

export type DesktopRuntimePorts = {
  appSettings: typeof tauriAppSettings;
  apps: typeof tauriApps;
  core: typeof tauriCore;
  dialogs: typeof tauriDialogs;
  dpi: typeof tauriDpi;
  files: typeof tauriFiles;
  menu: typeof tauriMenu;
  notifications: typeof tauriNotifications;
  opener: typeof tauriOpener;
  process: typeof tauriProcess;
  stateFabric: typeof tauriStateFabric;
  updater: typeof tauriUpdater;
  webview: typeof tauriWebview;
  window: typeof tauriWindow;
};

export type RuntimePorts = {
  infrastructure: RuntimeInfrastructure;
  desktop: DesktopRuntimePorts;
};

export function createRuntimePorts(): RuntimePorts {
  return {
    infrastructure: createRuntimeInfrastructure(),
    desktop: {
      appSettings: tauriAppSettings,
      apps: tauriApps,
      core: tauriCore,
      dialogs: tauriDialogs,
      dpi: tauriDpi,
      files: tauriFiles,
      menu: tauriMenu,
      notifications: tauriNotifications,
      opener: tauriOpener,
      process: tauriProcess,
      stateFabric: tauriStateFabric,
      updater: tauriUpdater,
      webview: tauriWebview,
      window: tauriWindow,
    },
  };
}

export const runtimePorts = createRuntimePorts();
