import { getDesktopHostBridge } from "./desktopHostBridge";

type DesktopCompatibilityOpener = {
  openPath?: (path: string) => Promise<boolean | void>;
  openUrl?: (url: string) => Promise<boolean | void>;
  revealItemInDir?: (path: string) => Promise<boolean | void>;
};

type DesktopCompatibilityOpenerLoader = () => Promise<DesktopCompatibilityOpener>;

async function defaultDesktopCompatibilityOpenerLoader(): Promise<DesktopCompatibilityOpener> {
  return {
    openPath: async (path) => getDesktopHostBridge()?.shell?.openPath?.(path),
    openUrl: async (url) => getDesktopHostBridge()?.shell?.openExternalUrl?.(url),
    revealItemInDir: async (path) => getDesktopHostBridge()?.shell?.revealItemInDir?.(path),
  };
}

let cachedCompatibilityOpenerPromise: Promise<DesktopCompatibilityOpener | null> | null = null;
let compatibilityOpenerLoader: DesktopCompatibilityOpenerLoader =
  defaultDesktopCompatibilityOpenerLoader;

async function loadCompatibilityOpener() {
  if (cachedCompatibilityOpenerPromise) {
    return cachedCompatibilityOpenerPromise;
  }

  cachedCompatibilityOpenerPromise = compatibilityOpenerLoader().catch(() => null);
  return cachedCompatibilityOpenerPromise;
}

export async function openDesktopCompatibilityUrl(url: string) {
  const opener = await loadCompatibilityOpener();
  if (opener?.openUrl) {
    return (await opener.openUrl(url)) !== false;
  }

  return false;
}

export const openUrl = openDesktopCompatibilityUrl;
export const openExternal = openDesktopCompatibilityUrl;

export async function revealDesktopCompatibilityItemInDir(path: string) {
  const opener = await loadCompatibilityOpener();
  if (opener?.revealItemInDir) {
    return (await opener.revealItemInDir(path)) !== false;
  }

  return false;
}

export const revealItemInDir = revealDesktopCompatibilityItemInDir;

export async function openDesktopCompatibilityPath(path: string) {
  const opener = await loadCompatibilityOpener();
  if (opener?.openPath) {
    return (await opener.openPath(path)) !== false;
  }

  return false;
}

export const openPath = openDesktopCompatibilityPath;

export function __setDesktopCompatibilityOpenerLoaderForTests(
  loader: DesktopCompatibilityOpenerLoader
) {
  compatibilityOpenerLoader = loader;
  cachedCompatibilityOpenerPromise = null;
}

export function __resetDesktopCompatibilityOpenerForTests() {
  compatibilityOpenerLoader = defaultDesktopCompatibilityOpenerLoader;
  cachedCompatibilityOpenerPromise = null;
}

export const openTauriUrl = openDesktopCompatibilityUrl;
export const revealTauriItemInDir = revealDesktopCompatibilityItemInDir;
export const openTauriPath = openDesktopCompatibilityPath;
export const __setTauriOpenerLoaderForTests = __setDesktopCompatibilityOpenerLoaderForTests;
export const __resetTauriOpenerForTests = __resetDesktopCompatibilityOpenerForTests;
