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
  const [app, core, window] = await Promise.all([
    import("@tauri-apps/api/app"),
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/window"),
  ]);

  return {
    app,
    core,
    window,
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

export async function openExternalUrlWithFallback(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  try {
    const modules = await loadTauriModules();
    if (modules.opener?.openUrl) {
      await modules.opener.openUrl(safeUrl);
      return true;
    }
  } catch {
    // Fall through to browser fallback.
  }

  if (typeof window === "undefined" || typeof window.open !== "function") {
    return false;
  }

  return window.open(safeUrl, "_blank", "noopener,noreferrer") !== null;
}

export async function readTauriWindowLabel() {
  const label = await resolveWindowLabel("");
  return label.length > 0 ? label : null;
}

export async function readTauriAppVersion() {
  return resolveAppVersion();
}

export function __setTauriModuleLoaderForTests(loader: TauriModuleLoader) {
  tauriModuleLoader = loader;
  cachedTauriModulesPromise = null;
}

export function __resetTauriRuntimeEnvironmentForTests() {
  tauriModuleLoader = defaultTauriModuleLoader;
  cachedTauriModulesPromise = null;
}
