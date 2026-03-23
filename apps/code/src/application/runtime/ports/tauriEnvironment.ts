import { toSafeExternalUrl } from "@ku0/shared";
import type { DesktopNotificationInput, DesktopSessionInfo } from "./desktopHostBridge";
import { getDesktopHostBridge } from "./desktopHostBridge";

type TauriCoreModule = {
  isTauri: () => boolean;
};

type TauriAppModule = {
  getVersion: () => Promise<string>;
};

type TauriOpenerModule = {
  openUrl: (url: string) => Promise<void>;
};

type TauriWindowModule = {
  getCurrentWindow: () => {
    label?: string | null;
  };
};

type TauriRuntimeModules = {
  app?: TauriAppModule;
  core?: TauriCoreModule;
  opener?: TauriOpenerModule;
  window?: TauriWindowModule;
};

type TauriModuleLoader = () => Promise<TauriRuntimeModules>;
export type DesktopRuntimeHost = "browser" | "electron" | "tauri";

async function defaultTauriModuleLoader(): Promise<TauriRuntimeModules> {
  const [app, core, opener, window] = await Promise.all([
    import("@tauri-apps/api/app"),
    import("@tauri-apps/api/core"),
    import("@tauri-apps/plugin-opener"),
    import("@tauri-apps/api/window"),
  ]);

  return {
    app,
    core,
    opener,
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
  if (getDesktopHostBridge()) {
    return false;
  }

  try {
    const modules = await loadTauriModules();
    return modules.core?.isTauri?.() === true;
  } catch {
    return false;
  }
}

export async function detectDesktopRuntimeHost(): Promise<DesktopRuntimeHost> {
  if (getDesktopHostBridge()) {
    return "electron";
  }

  return (await detectTauriRuntime()) ? "tauri" : "browser";
}

export async function resolveWindowLabel(defaultLabel = "main") {
  const desktopHostBridge = getDesktopHostBridge();
  try {
    const label = await desktopHostBridge?.window?.getLabel?.();
    if (typeof label === "string" && label.length > 0) {
      return label;
    }
  } catch {
    // Fall through to the Tauri loader and then to the default value.
  }

  try {
    const modules = await loadTauriModules();
    const label = modules.window?.getCurrentWindow?.().label;
    return typeof label === "string" && label.length > 0 ? label : defaultLabel;
  } catch {
    return defaultLabel;
  }
}

export async function resolveAppVersion() {
  const desktopHostBridge = getDesktopHostBridge();
  try {
    const version = await desktopHostBridge?.app?.getVersion?.();
    if (typeof version === "string" && version.length > 0) {
      return version;
    }
  } catch {
    // Fall through to the Tauri loader and then to the null fallback.
  }

  try {
    const modules = await loadTauriModules();
    const version = await modules.app?.getVersion?.();
    return typeof version === "string" && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

export async function resolveCurrentDesktopSession(): Promise<DesktopSessionInfo | null> {
  const desktopHostBridge = getDesktopHostBridge();
  try {
    const session = await desktopHostBridge?.session?.getCurrentSession?.();
    if (session && typeof session.id === "string" && session.id.length > 0) {
      return session;
    }
  } catch {
    // Electron desktop session lookup is optional.
  }

  return null;
}

export async function openExternalUrlWithFallback(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  const desktopHostBridge = getDesktopHostBridge();
  try {
    const openResult = await desktopHostBridge?.shell?.openExternalUrl?.(safeUrl);
    if (desktopHostBridge?.shell?.openExternalUrl) {
      return openResult !== false;
    }
  } catch {
    // Fall through to the Tauri loader and browser fallback.
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

export async function showDesktopNotification(input: DesktopNotificationInput) {
  const desktopHostBridge = getDesktopHostBridge();
  try {
    const showResult = await desktopHostBridge?.notifications?.show?.(input);
    if (desktopHostBridge?.notifications?.show) {
      return showResult !== false;
    }
  } catch {
    // Notification support is optional in browser and Tauri fallbacks.
  }

  return false;
}

export function __setTauriModuleLoaderForTests(loader: TauriModuleLoader) {
  tauriModuleLoader = loader;
  cachedTauriModulesPromise = null;
}

export function __resetTauriRuntimeEnvironmentForTests() {
  tauriModuleLoader = defaultTauriModuleLoader;
  cachedTauriModulesPromise = null;
}
