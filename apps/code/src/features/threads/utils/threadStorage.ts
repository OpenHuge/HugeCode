import type {
  AccessMode,
  ComposerExecutionMode,
  ComposerModelSelectionMode,
  ConversationItem,
  ModelProviderFamilyId,
} from "../../../types";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import type { HugeCodeTaskMode } from "@ku0/code-runtime-host-contract";
import {
  readSafeLocalStorageItem,
  writeSafeLocalStorageItem,
} from "../../../utils/safeLocalStorage";
import type { AtlasDetailLevel, AtlasLongTermMemoryDigest } from "../../atlas/utils/atlasContext";

export const STORAGE_KEY_THREAD_ACTIVITY = "codexmonitor.threadLastUserActivity";
export const STORAGE_KEY_PINNED_THREADS = "codexmonitor.pinnedThreads";
export const STORAGE_KEY_CUSTOM_NAMES = "codexmonitor.threadCustomNames";
// Legacy local snapshot storage. Keep only for temporary migration recovery until
// runtime-backed thread snapshot persistence is fully retired from active flows.
export const STORAGE_KEY_THREAD_SNAPSHOTS = "codexmonitor.threadSnapshots";
export const THREAD_STORAGE_PENDING_DRAFTS_KEY = "__pending_workspace_drafts_v1";
export const THREAD_STORAGE_LAST_ACTIVE_WORKSPACE_KEY = "__last_active_workspace_v1";
export const THREAD_STORAGE_ACTIVE_THREAD_IDS_KEY = "__active_thread_ids_v1";
export const THREAD_STORAGE_ATLAS_MEMORY_DIGESTS_KEY = "__atlas_memory_digests_v1";
export const STORAGE_KEY_THREAD_CODEX_PARAMS = "codexmonitor.threadCodexParams";
export const STORAGE_KEY_THREAD_ATLAS_PARAMS = "codexmonitor.threadAtlasParams";
export const STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS = "codexmonitor.threadAtlasMemoryDigests";
export const STORAGE_KEY_DETACHED_REVIEW_LINKS = "codexmonitor.detachedReviewLinks";
export const MAX_PINS_SOFT_LIMIT = 5;

export type ThreadActivityMap = Record<string, Record<string, number>>;
export type PinnedThreadsMap = Record<string, number>;
export type CustomNamesMap = Record<string, string>;
export type DetachedReviewLinksMap = Record<string, Record<string, string>>;
export type PersistedThreadSnapshot = {
  workspaceId: string;
  threadId: string;
  name: string;
  updatedAt: number;
  items: ConversationItem[];
  lastDurationMs?: number | null;
};
export type ThreadSnapshotsMap = Record<string, PersistedThreadSnapshot>;
export type WorkspacePendingDraftMessagesMap = Record<string, ConversationItem[]>;
export type WorkspaceActiveThreadIdsMap = Record<string, string>;

// Per-thread Codex parameter overrides. Keyed by `${workspaceId}:${threadId}`.
// These are UI-level preferences (not server state) and are best-effort persisted.
export type ThreadCodexParams = {
  modelId: string | null;
  effort: string | null;
  selectionMode?: ComposerModelSelectionMode | null;
  providerFamilyId?: ModelProviderFamilyId | null;
  fastMode?: boolean | null;
  accessMode: AccessMode | null;
  collaborationModeId: string | null;
  executionMode: ComposerExecutionMode | null;
  missionMode?: HugeCodeTaskMode | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
  updatedAt: number;
};

export type ThreadCodexParamsMap = Record<string, ThreadCodexParams>;

export type ThreadAtlasParams = {
  driverOrder: string[];
  enabled: boolean;
  detailLevel: AtlasDetailLevel;
  updatedAt: number;
};

export type ThreadAtlasParamsMap = Record<string, ThreadAtlasParams>;
export type ThreadAtlasMemoryDigest = AtlasLongTermMemoryDigest;
export type ThreadAtlasMemoryDigestMap = Record<string, ThreadAtlasMemoryDigest>;

export function makeThreadCodexParamsKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function makeThreadAtlasParamsKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function loadThreadCodexParams(): ThreadCodexParamsMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_THREAD_CODEX_PARAMS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ThreadCodexParamsMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveThreadCodexParams(next: ThreadCodexParamsMap): void {
  writeSafeLocalStorageItem(STORAGE_KEY_THREAD_CODEX_PARAMS, JSON.stringify(next));
}

export function loadThreadAtlasParams(): ThreadAtlasParamsMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_THREAD_ATLAS_PARAMS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ThreadAtlasParamsMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveThreadAtlasParams(next: ThreadAtlasParamsMap): void {
  writeSafeLocalStorageItem(STORAGE_KEY_THREAD_ATLAS_PARAMS, JSON.stringify(next));
}

export function loadThreadAtlasMemoryDigests(): ThreadAtlasMemoryDigestMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS);
    if (!raw) {
      return {};
    }
    return normalizeThreadAtlasMemoryDigestMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export function saveThreadAtlasMemoryDigests(next: ThreadAtlasMemoryDigestMap): void {
  writeSafeLocalStorageItem(STORAGE_KEY_THREAD_ATLAS_MEMORY_DIGESTS, JSON.stringify(next));
}

export function loadThreadActivity(): ThreadActivityMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_THREAD_ACTIVITY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ThreadActivityMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveThreadActivity(activity: ThreadActivityMap) {
  writeSafeLocalStorageItem(STORAGE_KEY_THREAD_ACTIVITY, JSON.stringify(activity));
}

export function makeThreadSnapshotKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function normalizeThreadSnapshotsMap(value: unknown): ThreadSnapshotsMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: ThreadSnapshotsMap = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const snapshot = entry as Partial<PersistedThreadSnapshot>;
    const workspaceId = typeof snapshot.workspaceId === "string" ? snapshot.workspaceId.trim() : "";
    const threadId = typeof snapshot.threadId === "string" ? snapshot.threadId.trim() : "";
    const name = typeof snapshot.name === "string" ? snapshot.name : "";
    const updatedAt =
      typeof snapshot.updatedAt === "number" && Number.isFinite(snapshot.updatedAt)
        ? snapshot.updatedAt
        : 0;
    const items = Array.isArray(snapshot.items) ? (snapshot.items as ConversationItem[]) : [];
    const lastDurationMs =
      typeof snapshot.lastDurationMs === "number" && Number.isFinite(snapshot.lastDurationMs)
        ? snapshot.lastDurationMs
        : null;
    if (!workspaceId || !threadId) {
      continue;
    }
    next[key] = {
      workspaceId,
      threadId,
      name,
      updatedAt,
      items,
      lastDurationMs,
    };
  }
  return next;
}

export function normalizeWorkspacePendingDraftMessagesMap(
  value: unknown
): WorkspacePendingDraftMessagesMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: WorkspacePendingDraftMessagesMap = {};
  for (const [workspaceId, items] of Object.entries(value as Record<string, unknown>)) {
    const normalizedWorkspaceId = typeof workspaceId === "string" ? workspaceId.trim() : "";
    if (!normalizedWorkspaceId || !Array.isArray(items) || items.length === 0) {
      continue;
    }
    next[normalizedWorkspaceId] = items as ConversationItem[];
  }
  return next;
}

export function normalizeLastActiveWorkspaceId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const workspaceId = (value as Record<string, unknown>).workspaceId;
  return typeof workspaceId === "string" && workspaceId.trim().length > 0
    ? workspaceId.trim()
    : null;
}

export function normalizeWorkspaceActiveThreadIdsMap(value: unknown): WorkspaceActiveThreadIdsMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: WorkspaceActiveThreadIdsMap = {};
  for (const [workspaceId, threadValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedWorkspaceId = typeof workspaceId === "string" ? workspaceId.trim() : "";
    const normalizedThreadId =
      typeof threadValue === "string"
        ? threadValue.trim()
        : typeof threadValue === "object" &&
            threadValue &&
            typeof (threadValue as Record<string, unknown>).threadId === "string"
          ? ((threadValue as Record<string, unknown>).threadId as string).trim()
          : "";
    if (!normalizedWorkspaceId || !normalizedThreadId) {
      continue;
    }
    next[normalizedWorkspaceId] = normalizedThreadId;
  }
  return next;
}

export function normalizeThreadAtlasMemoryDigestMap(value: unknown): ThreadAtlasMemoryDigestMap {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: ThreadAtlasMemoryDigestMap = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const digest = entry as Partial<ThreadAtlasMemoryDigest>;
    const summary = typeof digest.summary === "string" ? digest.summary.trim() : "";
    const updatedAt =
      typeof digest.updatedAt === "number" && Number.isFinite(digest.updatedAt)
        ? digest.updatedAt
        : 0;
    if (!summary || updatedAt <= 0) {
      continue;
    }
    next[key] = {
      summary,
      updatedAt,
    };
  }
  return next;
}

export function loadThreadSnapshots(): ThreadSnapshotsMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_THREAD_SNAPSHOTS);
    if (!raw) {
      return {};
    }
    return normalizeThreadSnapshotsMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export function saveThreadSnapshots(next: ThreadSnapshotsMap): void {
  writeSafeLocalStorageItem(STORAGE_KEY_THREAD_SNAPSHOTS, JSON.stringify(next));
}

export function clearThreadSnapshots(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY_THREAD_SNAPSHOTS);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function makeCustomNameKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function loadCustomNames(): CustomNamesMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_CUSTOM_NAMES);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as CustomNamesMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveCustomName(workspaceId: string, threadId: string, name: string): void {
  const current = loadCustomNames();
  const key = makeCustomNameKey(workspaceId, threadId);
  current[key] = name;
  writeSafeLocalStorageItem(STORAGE_KEY_CUSTOM_NAMES, JSON.stringify(current));
}

export function makePinKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

export function loadPinnedThreads(): PinnedThreadsMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_PINNED_THREADS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as PinnedThreadsMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function savePinnedThreads(pinned: PinnedThreadsMap) {
  writeSafeLocalStorageItem(STORAGE_KEY_PINNED_THREADS, JSON.stringify(pinned));
}

export function loadDetachedReviewLinks(): DetachedReviewLinksMap {
  try {
    const raw = readSafeLocalStorageItem(STORAGE_KEY_DETACHED_REVIEW_LINKS);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as DetachedReviewLinksMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveDetachedReviewLinks(links: DetachedReviewLinksMap) {
  writeSafeLocalStorageItem(STORAGE_KEY_DETACHED_REVIEW_LINKS, JSON.stringify(links));
}
