import {
  readSafeLocalStorageItem,
  removeSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";

export type RuntimeParallelDispatchPersistence = {
  loadSnapshot: (workspaceId: string) => Uint8Array | null;
  saveSnapshot: (workspaceId: string, snapshot: Uint8Array) => void;
  clearSnapshot: (workspaceId: string) => void;
};

type PersistedRuntimeParallelDispatchSnapshot = {
  version: 1;
  snapshotBase64: string;
};

const PARALLEL_DISPATCH_STORAGE_PREFIX = "workspace-runtime-parallel-dispatch";

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return globalThis.btoa(binary);
}

function decodeBase64ToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/\s+/g, "");
    const decoded = globalThis.atob(normalized);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function createBrowserRuntimeParallelDispatchPersistence(): RuntimeParallelDispatchPersistence {
  const readStorageKey = (workspaceId: string) =>
    `${PARALLEL_DISPATCH_STORAGE_PREFIX}:${workspaceId}`;

  return {
    loadSnapshot(workspaceId) {
      const raw = readSafeLocalStorageItem(readStorageKey(workspaceId));
      if (!raw) {
        return null;
      }
      try {
        const parsed = JSON.parse(raw) as PersistedRuntimeParallelDispatchSnapshot;
        if (parsed.version !== 1 || typeof parsed.snapshotBase64 !== "string") {
          return null;
        }
        return decodeBase64ToBytes(parsed.snapshotBase64);
      } catch {
        return null;
      }
    },

    saveSnapshot(workspaceId, snapshot) {
      void writeSafeLocalStorageItem(
        readStorageKey(workspaceId),
        JSON.stringify({
          version: 1,
          snapshotBase64: encodeBytesToBase64(snapshot),
        } satisfies PersistedRuntimeParallelDispatchSnapshot)
      );
    },

    clearSnapshot(workspaceId) {
      void removeSafeLocalStorageItem(readStorageKey(workspaceId));
    },
  };
}
