import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type TauriCoreModule = {
  isTauri: () => boolean;
};

type TauriAppModule = {
  getVersion: () => Promise<string>;
};

type TauriWindowModule = {
  getCurrentWindow: () => {
    label?: string | null;
  };
};

type TauriRuntimeModules = {
  app?: TauriAppModule;
  core?: TauriCoreModule;
  window?: TauriWindowModule;
};

type TauriModuleLoader = () => Promise<TauriRuntimeModules>;

async function defaultTauriModuleLoader(): Promise<TauriRuntimeModules> {
  return {
    app: { getVersion },
    core: { isTauri },
    window: { getCurrentWindow },
  };
}

let cachedTauriModulesPromise: Promise<TauriRuntimeModules> | null = null;
let tauriModuleLoader: TauriModuleLoader = defaultTauriModuleLoader;

async function loadTauriModules() {
  if (cachedTauriModulesPromise) {
    return cachedTauriModulesPromise;
  }

  cachedTauriModulesPromise = tauriModuleLoader().catch(() => ({}));
  return cachedTauriModulesPromise;
}

export async function detectTauriRuntime() {
  try {
    const modules = await loadTauriModules();
    return modules.core?.isTauri?.() === true;
  } catch {
    return false;
  }
}

export async function readTauriWindowLabel() {
  try {
    const modules = await loadTauriModules();
    const label = modules.window?.getCurrentWindow?.().label;
    return typeof label === "string" && label.length > 0 ? label : null;
  } catch {
    return null;
  }
}

export async function readTauriAppVersion() {
  try {
    const modules = await loadTauriModules();
    const version = await modules.app?.getVersion?.();
    return typeof version === "string" && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}
export function __setTauriModuleLoaderForTests(loader: TauriModuleLoader) {
  tauriModuleLoader = loader;
  cachedTauriModulesPromise = null;
}

export function __resetTauriRuntimeEnvironmentForTests() {
  tauriModuleLoader = defaultTauriModuleLoader;
  cachedTauriModulesPromise = null;
}
