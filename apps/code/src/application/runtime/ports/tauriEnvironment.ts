import { getDesktopHostBridge } from "./desktopHostBridge";

type DesktopCompatibilityEnvironment = {
  getAppVersion?: () => Promise<string | null>;
  getWindowLabel?: () => Promise<string | null>;
  isRuntime?: () => Promise<boolean> | boolean;
  app?: {
    getVersion?: () => Promise<string | null> | string | null;
  };
  core?: {
    isTauri?: () => boolean;
  };
  window?: {
    getCurrentWindow?: () =>
      | Promise<{ label?: string | null } | null>
      | { label?: string | null }
      | null;
  };
};

type DesktopCompatibilityEnvironmentLoader = () => Promise<DesktopCompatibilityEnvironment>;

async function defaultDesktopCompatibilityEnvironmentLoader(): Promise<DesktopCompatibilityEnvironment> {
  return {
    isRuntime: () => getDesktopHostBridge() !== null,
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

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readCompatibilityAppVersion(
  environment: DesktopCompatibilityEnvironment
): Promise<string | null> {
  if (environment.getAppVersion) {
    return environment.getAppVersion();
  }
  if (environment.app?.getVersion) {
    return readOptionalText(await environment.app.getVersion());
  }
  return null;
}

async function readCompatibilityWindowLabel(
  environment: DesktopCompatibilityEnvironment
): Promise<string | null> {
  if (environment.getWindowLabel) {
    return environment.getWindowLabel();
  }
  if (environment.window?.getCurrentWindow) {
    const currentWindow = await environment.window.getCurrentWindow();
    return readOptionalText(currentWindow?.label);
  }
  return null;
}

export async function detectTauriRuntime() {
  try {
    const environment = await loadCompatibilityEnvironment();
    if (environment.isRuntime) {
      return Boolean(await environment.isRuntime());
    }
    if (environment.core?.isTauri) {
      return Boolean(environment.core.isTauri());
    }
    return false;
  } catch {
    return false;
  }
}

export async function readDesktopCompatibilityWindowLabel() {
  try {
    return await readCompatibilityWindowLabel(await loadCompatibilityEnvironment());
  } catch {
    return null;
  }
}

export async function readDesktopCompatibilityAppVersion() {
  try {
    return await readCompatibilityAppVersion(await loadCompatibilityEnvironment());
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
