import { toSafeExternalUrl } from "@ku0/shared";

export type TauriOpenerModule = {
  openUrl: (url: string) => Promise<unknown> | unknown;
  revealItemInDir: (path: string) => Promise<unknown> | unknown;
};

type TauriOpenerLoader = () => Promise<TauriOpenerModule>;

async function defaultTauriOpenerLoader(): Promise<TauriOpenerModule> {
  const opener = await import("@tauri-apps/plugin-opener");
  return {
    openUrl: opener.openUrl,
    revealItemInDir: opener.revealItemInDir,
  };
}

let cachedTauriOpenerPromise: Promise<TauriOpenerModule> | null = null;
let tauriOpenerLoader: TauriOpenerLoader = defaultTauriOpenerLoader;

async function loadTauriOpener() {
  if (cachedTauriOpenerPromise) {
    return cachedTauriOpenerPromise;
  }
  cachedTauriOpenerPromise = tauriOpenerLoader();
  return cachedTauriOpenerPromise;
}

export async function revealTauriItemInDir(path: string) {
  try {
    const opener = await loadTauriOpener();
    await opener.revealItemInDir(path);
    return true;
  } catch {
    return false;
  }
}

export async function openTauriUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    return false;
  }

  try {
    const opener = await loadTauriOpener();
    await opener.openUrl(safeUrl);
    return true;
  } catch {
    return false;
  }
}

export async function openUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    throw new Error("Blocked unsafe external URL.");
  }

  const opened = await openTauriUrl(safeUrl);
  if (!opened) {
    throw new Error("Tauri opener is unavailable.");
  }
  return true;
}

export function __setTauriOpenerLoaderForTests(loader: TauriOpenerLoader) {
  tauriOpenerLoader = loader;
  cachedTauriOpenerPromise = null;
}

export function __resetTauriOpenerForTests() {
  tauriOpenerLoader = defaultTauriOpenerLoader;
  cachedTauriOpenerPromise = null;
}
