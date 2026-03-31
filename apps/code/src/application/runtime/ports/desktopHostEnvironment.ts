import { getDesktopHostBridge } from "./desktopHostBridge";

type DesktopCompatibilityEnvironment = {
  isDesktopHostRuntime?: () => boolean | Promise<boolean>;
  getAppVersion?: () => Promise<string | null>;
  getWindowLabel?: () => Promise<string | null>;
  app?: {
    getVersion?: () => Promise<string | null> | string | null;
  };
  core?: {
    isDesktopHostRuntime?: () => boolean | Promise<boolean>;
  };
  window?: {
    getCurrentWindow?: () => {
      label?: string | null;
    } | null;
  };
};

type DesktopCompatibilityEnvironmentLoader = () => Promise<DesktopCompatibilityEnvironment>;

async function defaultDesktopCompatibilityEnvironmentLoader(): Promise<DesktopCompatibilityEnvironment> {
  return {
    isDesktopHostRuntime: async () => {
      const bridge = getDesktopHostBridge();
      return bridge?.kind === "electron";
    },
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

export async function detectDesktopHostRuntime() {
  try {
    const environment = await loadCompatibilityEnvironment();
    const detected = await (
      environment.isDesktopHostRuntime ??
      environment.core?.isDesktopHostRuntime ??
      (() => false)
    )();
    return detected === true;
  } catch {
    return false;
  }
}

export async function readDesktopWindowLabel() {
  try {
    const environment = await loadCompatibilityEnvironment();
    const label =
      (await environment.getWindowLabel?.()) ??
      environment.window?.getCurrentWindow?.()?.label ??
      null;
    return typeof label === "string" && label.length > 0 ? label : null;
  } catch {
    return null;
  }
}

export async function readDesktopAppVersion() {
  try {
    const environment = await loadCompatibilityEnvironment();
    const version =
      (await environment.getAppVersion?.()) ?? (await environment.app?.getVersion?.()) ?? null;
    return typeof version === "string" && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

export const readDesktopCompatibilityWindowLabel = readDesktopWindowLabel;
export const readDesktopCompatibilityAppVersion = readDesktopAppVersion;

export function __setDesktopHostEnvironmentLoaderForTests(
  loader: DesktopCompatibilityEnvironmentLoader
) {
  compatibilityEnvironmentLoader = loader;
  cachedCompatibilityEnvironmentPromise = null;
}

export function __resetDesktopHostEnvironmentForTests() {
  compatibilityEnvironmentLoader = defaultDesktopCompatibilityEnvironmentLoader;
  cachedCompatibilityEnvironmentPromise = null;
}
