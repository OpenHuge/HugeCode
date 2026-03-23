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

export async function openTauriUrl(url: string) {
  const opener = await loadTauriOpener();
  if (opener?.openUrl) {
    await opener.openUrl(url);
    return true;
  }

  return false;
}

export async function revealTauriItemInDir(path: string) {
  const opener = await loadTauriOpener();
  if (opener?.revealItemInDir) {
    await opener.revealItemInDir(path);
    return true;
  }

  return false;
}

export function __setTauriOpenerLoaderForTests(loader: TauriOpenerLoader) {
  tauriOpenerLoader = loader;
  cachedTauriOpenerPromise = null;
}

export function __resetTauriOpenerForTests() {
  tauriOpenerLoader = defaultTauriOpenerLoader;
  cachedTauriOpenerPromise = null;
}
