export function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getSafeSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readSafeLocalStorageItem(key: string): string | null {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSafeLocalStorageItem(key: string, value: string): boolean {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readSafeSessionStorageItem(key: string): string | null {
  const storage = getSafeSessionStorage();
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSafeSessionStorageItem(key: string, value: string): boolean {
  const storage = getSafeSessionStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSafeLocalStorageItem(key: string): boolean {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function removeSafeSessionStorageItem(key: string): boolean {
  const storage = getSafeSessionStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
