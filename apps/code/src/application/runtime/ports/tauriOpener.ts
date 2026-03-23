import { toSafeExternalUrl } from "@ku0/shared";
import { getDesktopHostBridge } from "./desktopHostBridge";

type TauriOpenerModule = {
  openUrl: (url: string) => Promise<void>;
  revealItemInDir: (path: string) => Promise<void>;
};

type TauriOpenerLoader = () => Promise<TauriOpenerModule>;

async function defaultTauriOpenerLoader(): Promise<TauriOpenerModule> {
  return import("@tauri-apps/plugin-opener");
}

let cachedTauriOpenerPromise: Promise<TauriOpenerModule | null> | null = null;
let tauriOpenerLoader: TauriOpenerLoader = defaultTauriOpenerLoader;

async function loadTauriOpener() {
  if (cachedTauriOpenerPromise) {
    return cachedTauriOpenerPromise;
  }

  cachedTauriOpenerPromise = tauriOpenerLoader().catch(() => null);
  return cachedTauriOpenerPromise;
}

export async function openUrl(url: string) {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    throw new Error("Blocked unsafe external URL.");
  }

  const desktopHostBridge = getDesktopHostBridge();
  try {
    const openResult = await desktopHostBridge?.shell?.openExternalUrl?.(safeUrl);
    if (desktopHostBridge?.shell?.openExternalUrl && openResult !== false) {
      return;
    }
  } catch {
    // Fall through to the Tauri loader and browser fallback.
  }

  const opener = await loadTauriOpener();
  if (opener?.openUrl) {
    await opener.openUrl(safeUrl);
    return;
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    const popup = window.open(safeUrl, "_blank", "noopener,noreferrer");
    if (popup !== null) {
      return;
    }
  }

  throw new Error("Desktop external-url opener unavailable.");
}

export async function revealItemInDir(path: string) {
  const desktopHostBridge = getDesktopHostBridge();
  try {
    const revealResult = await desktopHostBridge?.shell?.revealItemInDir?.(path);
    if (desktopHostBridge?.shell?.revealItemInDir && revealResult !== false) {
      return;
    }
  } catch {
    // Fall through to the Tauri loader.
  }

  const opener = await loadTauriOpener();
  if (opener?.revealItemInDir) {
    await opener.revealItemInDir(path);
    return;
  }

  throw new Error("Desktop reveal-in-directory bridge unavailable.");
}

export function __setTauriOpenerLoaderForTests(loader: TauriOpenerLoader) {
  tauriOpenerLoader = loader;
  cachedTauriOpenerPromise = null;
}

export function __resetTauriOpenerForTests() {
  tauriOpenerLoader = defaultTauriOpenerLoader;
  cachedTauriOpenerPromise = null;
}
