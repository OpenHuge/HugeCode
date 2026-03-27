import { getDesktopHostBridge } from "./desktopHostBridge";

type DesktopCompatibilityEnvironment = {
  getAppVersion?: () => Promise<string | null>;
  getWindowLabel?: () => Promise<string | null>;
};

type DesktopCompatibilityEnvironmentLoader = () => Promise<DesktopCompatibilityEnvironment>;

async function defaultDesktopCompatibilityEnvironmentLoader(): Promise<DesktopCompatibilityEnvironment> {
  return {
    getAppVersion: async () => {
      const version = await getDesktopHostBridge()?.app?.getVersion?.();
      return typeof version === "string" && version.length > 0 ? version : null;
    },
    getWindowLabel: async () => {
      const label = await getDesktopHostBridge()?.window?.getLabel?.();
      return typeof label === "string" && label.length > 0 ? label : null;
    },
  };
}

let cachedCompatibilityEnvironmentPromise: Promise<DesktopCompatibilityEnvironment> | null = null;
let compatibilityEnvironmentLoader: DesktopCompatibilityEnvironmentLoader =
  defaultDesktopCompatibilityEnvironmentLoader;

async function loadCompatibilityEnvironment() {
  if (cachedCompatibilityEnvironmentPromise) {
    return cachedCompatibilityEnvironmentPromise;
  }

  cachedCompatibilityEnvironmentPromise = compatibilityEnvironmentLoader().catch(() => ({}));
  return cachedCompatibilityEnvironmentPromise;
}

export async function detectTauriRuntime() {
  return false;
}

export async function readDesktopCompatibilityWindowLabel() {
  try {
    return (await loadCompatibilityEnvironment()).getWindowLabel?.();
  } catch {
    return null;
  }
}

export async function readDesktopCompatibilityAppVersion() {
  try {
    return (await loadCompatibilityEnvironment()).getAppVersion?.();
  } catch {
    return null;
  }
}

export const readTauriWindowLabel = readDesktopCompatibilityWindowLabel;
export const readTauriAppVersion = readDesktopCompatibilityAppVersion;

export function __setTauriModuleLoaderForTests(loader: DesktopCompatibilityEnvironmentLoader) {
  compatibilityEnvironmentLoader = loader;
  cachedCompatibilityEnvironmentPromise = null;
}

export function __resetTauriRuntimeEnvironmentForTests() {
  compatibilityEnvironmentLoader = defaultDesktopCompatibilityEnvironmentLoader;
  cachedCompatibilityEnvironmentPromise = null;
}
