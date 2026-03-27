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

export async function revealDesktopCompatibilityItemInDir(path: string) {
  const opener = await loadCompatibilityOpener();
  if (opener?.revealItemInDir) {
    return (await opener.revealItemInDir(path)) !== false;
  }

  return false;
}

export async function openDesktopCompatibilityPath(path: string) {
  const opener = await loadCompatibilityOpener();
  if (opener?.openPath) {
    return (await opener.openPath(path)) !== false;
  }

  return false;
}

export const openTauriUrl = openDesktopCompatibilityUrl;
export const revealTauriItemInDir = revealDesktopCompatibilityItemInDir;
export const openTauriPath = openDesktopCompatibilityPath;

export function __setTauriOpenerLoaderForTests(loader: DesktopCompatibilityOpenerLoader) {
  compatibilityOpenerLoader = loader;
  cachedCompatibilityOpenerPromise = null;
}

export function __resetTauriOpenerForTests() {
  compatibilityOpenerLoader = defaultDesktopCompatibilityOpenerLoader;
  cachedCompatibilityOpenerPromise = null;
}
