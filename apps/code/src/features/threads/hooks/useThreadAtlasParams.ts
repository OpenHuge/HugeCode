import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ATLAS_DETAIL_LEVEL,
  normalizeAtlasDetailLevel,
  normalizeAtlasDriverOrder,
} from "../../atlas/utils/atlasContext";
import {
  loadThreadAtlasMemoryDigests,
  loadThreadAtlasParams,
  makeThreadAtlasParamsKey,
  STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS,
  STORAGE_KEY_THREAD_ATLAS_PARAMS,
  saveThreadAtlasMemoryDigests,
  saveThreadAtlasParams,
  type ThreadAtlasMemoryDigest,
  type ThreadAtlasMemoryDigestMap,
  type ThreadAtlasParams,
  type ThreadAtlasParamsMap,
} from "../utils/threadStorage";

export type ThreadAtlasParamsPatch = Partial<
  Pick<ThreadAtlasParams, "driverOrder" | "enabled" | "detailLevel">
>;

type UseThreadAtlasParamsResult = {
  version: number;
  getThreadAtlasParams: (workspaceId: string, threadId: string) => ThreadAtlasParams | null;
  getThreadAtlasMemoryDigest: (
    workspaceId: string,
    threadId: string
  ) => ThreadAtlasMemoryDigest | null;
  patchThreadAtlasParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadAtlasParamsPatch
  ) => void;
  upsertThreadAtlasMemoryDigest: (
    workspaceId: string,
    threadId: string,
    digest: ThreadAtlasMemoryDigest
  ) => void;
  deleteThreadAtlasParams: (workspaceId: string, threadId: string) => void;
};

const DEFAULT_ENTRY: ThreadAtlasParams = {
  driverOrder: normalizeAtlasDriverOrder(undefined),
  enabled: true,
  detailLevel: DEFAULT_ATLAS_DETAIL_LEVEL,
  updatedAt: 0,
};

function sanitizeEntry(value: unknown): ThreadAtlasParams | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const rawOrder = Array.isArray(entry.driverOrder)
    ? entry.driverOrder.filter((candidate): candidate is string => typeof candidate === "string")
    : undefined;
  return {
    driverOrder: normalizeAtlasDriverOrder(rawOrder),
    enabled: entry.enabled !== false,
    detailLevel: normalizeAtlasDetailLevel(entry.detailLevel as string | null | undefined),
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
  };
}

function sanitizeMemoryDigest(value: unknown): ThreadAtlasMemoryDigest | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const digest = value as Record<string, unknown>;
  const summary = typeof digest.summary === "string" ? digest.summary.trim() : "";
  if (!summary) {
    return null;
  }
  const updatedAt = typeof digest.updatedAt === "number" ? digest.updatedAt : 0;
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return null;
  }
  return {
    summary,
    updatedAt,
  };
}

export function useThreadAtlasParams(): UseThreadAtlasParamsResult {
  const paramsRef = useRef<ThreadAtlasParamsMap>(loadThreadAtlasParams());
  const memoryDigestsRef = useRef<ThreadAtlasMemoryDigestMap>(loadThreadAtlasMemoryDigests());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_THREAD_ATLAS_PARAMS) {
        paramsRef.current = loadThreadAtlasParams();
        setVersion((value) => value + 1);
        return;
      }
      if (event.key === STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS) {
        memoryDigestsRef.current = loadThreadAtlasMemoryDigests();
        setVersion((value) => value + 1);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const getThreadAtlasParams = useCallback((workspaceId: string, threadId: string) => {
    const key = makeThreadAtlasParamsKey(workspaceId, threadId);
    return sanitizeEntry(paramsRef.current[key]) ?? null;
  }, []);

  const getThreadAtlasMemoryDigest = useCallback((workspaceId: string, threadId: string) => {
    const key = makeThreadAtlasParamsKey(workspaceId, threadId);
    return sanitizeMemoryDigest(memoryDigestsRef.current[key]);
  }, []);

  const patchThreadAtlasParams = useCallback(
    (workspaceId: string, threadId: string, patch: ThreadAtlasParamsPatch) => {
      const key = makeThreadAtlasParamsKey(workspaceId, threadId);
      const current = sanitizeEntry(paramsRef.current[key]) ?? DEFAULT_ENTRY;
      const nextEntry: ThreadAtlasParams = {
        ...current,
        ...patch,
        driverOrder: normalizeAtlasDriverOrder(patch.driverOrder ?? current.driverOrder),
        detailLevel: normalizeAtlasDetailLevel(patch.detailLevel ?? current.detailLevel),
        updatedAt: Date.now(),
      };
      const next: ThreadAtlasParamsMap = {
        ...paramsRef.current,
        [key]: nextEntry,
      };
      paramsRef.current = next;
      saveThreadAtlasParams(next);
      setVersion((value) => value + 1);
    },
    []
  );

  const upsertThreadAtlasMemoryDigest = useCallback(
    (workspaceId: string, threadId: string, digest: ThreadAtlasMemoryDigest) => {
      const summary = digest.summary.trim();
      if (!summary) {
        return;
      }
      const updatedAt =
        Number.isFinite(digest.updatedAt) && digest.updatedAt > 0 ? digest.updatedAt : Date.now();
      const key = makeThreadAtlasParamsKey(workspaceId, threadId);
      const next: ThreadAtlasMemoryDigestMap = {
        ...memoryDigestsRef.current,
        [key]: {
          summary,
          updatedAt,
        },
      };
      memoryDigestsRef.current = next;
      saveThreadAtlasMemoryDigests(next);
      setVersion((value) => value + 1);
    },
    []
  );

  const deleteThreadAtlasParams = useCallback((workspaceId: string, threadId: string) => {
    const key = makeThreadAtlasParamsKey(workspaceId, threadId);
    if (!(key in paramsRef.current)) {
      return;
    }
    const { [key]: _removed, ...rest } = paramsRef.current;
    paramsRef.current = rest;
    saveThreadAtlasParams(rest);
    setVersion((value) => value + 1);
  }, []);

  return useMemo(
    () => ({
      version,
      getThreadAtlasParams,
      getThreadAtlasMemoryDigest,
      patchThreadAtlasParams,
      upsertThreadAtlasMemoryDigest,
      deleteThreadAtlasParams,
    }),
    [
      deleteThreadAtlasParams,
      getThreadAtlasMemoryDigest,
      getThreadAtlasParams,
      patchThreadAtlasParams,
      upsertThreadAtlasMemoryDigest,
      version,
    ]
  );
}
