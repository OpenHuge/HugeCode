import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import {
  getErrorMessage,
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "./tauriRuntimeTransport";
import { logRuntimeWarning } from "./tauriRuntimeTurnHelpers";
import {
  THREAD_STORAGE_ACTIVE_THREAD_IDS_KEY,
  THREAD_STORAGE_ATLAS_MEMORY_DIGESTS_KEY,
  normalizeLastActiveWorkspaceId,
  normalizeThreadAtlasMemoryDigestMap,
  normalizeWorkspaceActiveThreadIdsMap,
  normalizeWorkspacePendingDraftMessagesMap,
  normalizeThreadSnapshotsMap,
  THREAD_STORAGE_LAST_ACTIVE_WORKSPACE_KEY,
  THREAD_STORAGE_PENDING_DRAFTS_KEY,
  type ThreadAtlasMemoryDigestMap,
  type ThreadSnapshotsMap,
  type WorkspaceActiveThreadIdsMap,
  type WorkspacePendingDraftMessagesMap,
} from "../features/threads/utils/threadStorage";
import {
  readSafeSessionStorageItem,
  removeSafeSessionStorageItem,
  writeSafeSessionStorageItem,
} from "../utils/safeLocalStorage";

type OptionalThreadSnapshotFallback<Result> = {
  message: string;
  details: Record<string, unknown>;
  value: Result | null;
};

export type PersistedThreadStorageState = {
  snapshots: ThreadSnapshotsMap;
  atlasMemoryDigests?: ThreadAtlasMemoryDigestMap;
  pendingDraftMessagesByWorkspace: WorkspacePendingDraftMessagesMap;
  lastActiveWorkspaceId?: string | null;
  lastActiveThreadIdByWorkspace?: WorkspaceActiveThreadIdsMap;
};

type PersistedThreadStoragePayload = Record<string, Record<string, unknown>>;
type OptionalThreadSnapshotResult<Result> = {
  value: Result | null;
  usedFallback: boolean;
};

const WEB_RUNTIME_THREAD_SNAPSHOT_RETRY_DELAYS_MS = [120, 240, 500, 900] as const;
const SESSION_ACTIVE_WORKSPACE_KEY = "codexmonitor.activeWorkspaceSession";
const SESSION_ACTIVE_THREAD_IDS_KEY = "codexmonitor.activeThreadIdsSession";
const SESSION_THREAD_STORAGE_STATE_KEY = "codexmonitor.threadStorageSession";
const SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY = "codexmonitor.pendingInterruptThreadIdsSession";

let persistedThreadStorageCache: PersistedThreadStorageState | null = null;
let persistedThreadStorageCacheReady = false;
let persistedThreadStorageWriteQueue: Promise<void> = Promise.resolve();

function normalizeOptionalAtlasMemoryDigests(
  value: ThreadAtlasMemoryDigestMap | null | undefined
): ThreadAtlasMemoryDigestMap | undefined {
  if (!value || Object.keys(value).length === 0) {
    return undefined;
  }
  return value;
}

function clonePersistedThreadStorageState(
  state: PersistedThreadStorageState
): PersistedThreadStorageState {
  return {
    snapshots: { ...state.snapshots },
    atlasMemoryDigests: normalizeOptionalAtlasMemoryDigests({
      ...(state.atlasMemoryDigests ?? {}),
    }),
    pendingDraftMessagesByWorkspace: {
      ...state.pendingDraftMessagesByWorkspace,
    },
    lastActiveWorkspaceId: state.lastActiveWorkspaceId ?? null,
    lastActiveThreadIdByWorkspace: {
      ...(state.lastActiveThreadIdByWorkspace ?? {}),
    },
  };
}

function readSessionActiveWorkspaceId(): string | null {
  const raw = readSafeSessionStorageItem(SESSION_ACTIVE_WORKSPACE_KEY);
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function writeSessionActiveWorkspaceId(workspaceId: string | null): void {
  if (typeof workspaceId === "string" && workspaceId.trim().length > 0) {
    writeSafeSessionStorageItem(SESSION_ACTIVE_WORKSPACE_KEY, workspaceId.trim());
    return;
  }
  removeSafeSessionStorageItem(SESSION_ACTIVE_WORKSPACE_KEY);
}

function readSessionActiveThreadIds(): WorkspaceActiveThreadIdsMap {
  const raw = readSafeSessionStorageItem(SESSION_ACTIVE_THREAD_IDS_KEY);
  if (!raw) {
    return {};
  }
  try {
    return normalizeWorkspaceActiveThreadIdsMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function writeSessionActiveThreadIds(
  activeThreadIdsByWorkspace: WorkspaceActiveThreadIdsMap
): void {
  if (Object.keys(activeThreadIdsByWorkspace).length === 0) {
    removeSafeSessionStorageItem(SESSION_ACTIVE_THREAD_IDS_KEY);
    return;
  }
  writeSafeSessionStorageItem(
    SESSION_ACTIVE_THREAD_IDS_KEY,
    JSON.stringify(activeThreadIdsByWorkspace)
  );
}

function normalizePendingInterruptThreadIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string"))]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readSessionPendingInterruptThreadIds(): string[] {
  const raw = readSafeSessionStorageItem(SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY);
  if (!raw) {
    return [];
  }
  try {
    return normalizePendingInterruptThreadIds(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeSessionPendingInterruptThreadIds(threadIds: string[]): void {
  const normalizedThreadIds = normalizePendingInterruptThreadIds(threadIds);
  if (normalizedThreadIds.length === 0) {
    removeSafeSessionStorageItem(SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY);
    return;
  }
  writeSafeSessionStorageItem(
    SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY,
    JSON.stringify(normalizedThreadIds)
  );
}

function readSessionThreadStorageState(): PersistedThreadStorageState | null {
  const raw = readSafeSessionStorageItem(SESSION_THREAD_STORAGE_STATE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const atlasMemoryDigests = normalizeOptionalAtlasMemoryDigests(
      normalizeThreadAtlasMemoryDigestMap(parsed.atlasMemoryDigests)
    );
    return {
      snapshots: normalizeThreadSnapshotsMap(parsed.snapshots),
      ...(atlasMemoryDigests ? { atlasMemoryDigests } : {}),
      pendingDraftMessagesByWorkspace: normalizeWorkspacePendingDraftMessagesMap(
        parsed.pendingDraftMessagesByWorkspace
      ),
      lastActiveWorkspaceId: normalizeLastActiveWorkspaceId(parsed.lastActiveWorkspaceId),
      lastActiveThreadIdByWorkspace: normalizeWorkspaceActiveThreadIdsMap(
        parsed.lastActiveThreadIdByWorkspace
      ),
    };
  } catch {
    return null;
  }
}

function writeSessionThreadStorageState(state: PersistedThreadStorageState): void {
  writeSafeSessionStorageItem(
    SESSION_THREAD_STORAGE_STATE_KEY,
    JSON.stringify({
      snapshots: state.snapshots,
      ...(normalizeOptionalAtlasMemoryDigests(state.atlasMemoryDigests ?? {})
        ? {
            atlasMemoryDigests: state.atlasMemoryDigests ?? {},
          }
        : {}),
      pendingDraftMessagesByWorkspace: state.pendingDraftMessagesByWorkspace,
      lastActiveWorkspaceId: state.lastActiveWorkspaceId ?? null,
      lastActiveThreadIdByWorkspace: state.lastActiveThreadIdByWorkspace ?? {},
    })
  );
}

function mergePersistedThreadStorageState(params: {
  base: PersistedThreadStorageState;
  overlay: PersistedThreadStorageState | null;
}): PersistedThreadStorageState {
  const overlay = params.overlay;
  if (!overlay) {
    return params.base;
  }
  const atlasMemoryDigests = normalizeOptionalAtlasMemoryDigests({
    ...(params.base.atlasMemoryDigests ?? {}),
    ...(overlay.atlasMemoryDigests ?? {}),
  });
  return {
    snapshots: {
      ...params.base.snapshots,
      ...overlay.snapshots,
    },
    ...(atlasMemoryDigests ? { atlasMemoryDigests } : {}),
    pendingDraftMessagesByWorkspace: {
      ...params.base.pendingDraftMessagesByWorkspace,
      ...overlay.pendingDraftMessagesByWorkspace,
    },
    lastActiveWorkspaceId:
      overlay.lastActiveWorkspaceId ?? params.base.lastActiveWorkspaceId ?? null,
    lastActiveThreadIdByWorkspace: {
      ...(params.base.lastActiveThreadIdByWorkspace ?? {}),
      ...(overlay.lastActiveThreadIdByWorkspace ?? {}),
    },
  };
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function invokeOptionalThreadSnapshotMethod<Result>(
  operation: () => Promise<Result>,
  fallback: OptionalThreadSnapshotFallback<Result>
): Promise<OptionalThreadSnapshotResult<Result>> {
  const runtimeMode = detectRuntimeMode();
  for (let attempt = 0; ; attempt += 1) {
    try {
      return {
        value: await operation(),
        usedFallback: false,
      };
    } catch (error) {
      if (isRuntimeMethodUnsupportedError(error)) {
        return {
          value: null,
          usedFallback: true,
        };
      }
      if (runtimeMode === "runtime-gateway-web" && isWebRuntimeConnectionError(error)) {
        const retryDelayMs = WEB_RUNTIME_THREAD_SNAPSHOT_RETRY_DELAYS_MS[attempt];
        if (typeof retryDelayMs === "number") {
          await waitForRetry(retryDelayMs);
          continue;
        }
        logRuntimeWarning(fallback.message, {
          ...fallback.details,
          error: getErrorMessage(error),
        });
        return {
          value: fallback.value,
          usedFallback: true,
        };
      }
      throw error;
    }
  }
}

export async function readPersistedThreadSnapshots(): Promise<ThreadSnapshotsMap> {
  const state = await readPersistedThreadStorageState();
  return state.snapshots;
}

function buildPersistedThreadStorageState(
  rawSnapshots: Record<string, unknown>
): PersistedThreadStorageState {
  const atlasMemoryDigests = normalizeOptionalAtlasMemoryDigests(
    normalizeThreadAtlasMemoryDigestMap(rawSnapshots[THREAD_STORAGE_ATLAS_MEMORY_DIGESTS_KEY])
  );
  return {
    snapshots: normalizeThreadSnapshotsMap(rawSnapshots),
    ...(atlasMemoryDigests ? { atlasMemoryDigests } : {}),
    pendingDraftMessagesByWorkspace: normalizeWorkspacePendingDraftMessagesMap(
      rawSnapshots[THREAD_STORAGE_PENDING_DRAFTS_KEY]
    ),
    lastActiveWorkspaceId: normalizeLastActiveWorkspaceId(
      rawSnapshots[THREAD_STORAGE_LAST_ACTIVE_WORKSPACE_KEY]
    ),
    lastActiveThreadIdByWorkspace: normalizeWorkspaceActiveThreadIdsMap(
      rawSnapshots[THREAD_STORAGE_ACTIVE_THREAD_IDS_KEY]
    ),
  };
}

function buildPersistedThreadStoragePayload(
  state: PersistedThreadStorageState
): PersistedThreadStoragePayload {
  const payload: PersistedThreadStoragePayload = {
    ...(state.snapshots as Record<string, Record<string, unknown>>),
  };
  if (Object.keys(state.atlasMemoryDigests ?? {}).length > 0) {
    payload[THREAD_STORAGE_ATLAS_MEMORY_DIGESTS_KEY] = state.atlasMemoryDigests as Record<
      string,
      unknown
    > as Record<string, Record<string, unknown>>;
  }
  if (Object.keys(state.pendingDraftMessagesByWorkspace).length > 0) {
    payload[THREAD_STORAGE_PENDING_DRAFTS_KEY] = state.pendingDraftMessagesByWorkspace as Record<
      string,
      unknown
    > as Record<string, Record<string, unknown>>;
  }
  if (state.lastActiveWorkspaceId) {
    payload[THREAD_STORAGE_LAST_ACTIVE_WORKSPACE_KEY] = {
      workspaceId: state.lastActiveWorkspaceId,
    };
  }
  if (Object.keys(state.lastActiveThreadIdByWorkspace ?? {}).length > 0) {
    payload[THREAD_STORAGE_ACTIVE_THREAD_IDS_KEY] = Object.fromEntries(
      Object.entries(state.lastActiveThreadIdByWorkspace ?? {}).map(([workspaceId, threadId]) => [
        workspaceId,
        { threadId },
      ])
    );
  }
  return payload;
}

async function loadPersistedThreadStorageState(): Promise<PersistedThreadStorageState> {
  const { value: response, usedFallback } = await invokeOptionalThreadSnapshotMethod(
    () => getRuntimeClient().threadSnapshotsGetV1({}),
    {
      message:
        "Web runtime thread snapshot persistence unavailable; starting from empty native history.",
      details: {},
      value: {
        snapshots: {},
        updatedAt: null,
      },
    }
  );
  let state = buildPersistedThreadStorageState(
    (response?.snapshots ?? {}) as Record<string, unknown>
  );
  state = mergePersistedThreadStorageState({
    base: state,
    overlay: readSessionThreadStorageState(),
  });
  const sessionActiveThreadIds = readSessionActiveThreadIds();
  if (Object.keys(sessionActiveThreadIds).length > 0) {
    state.lastActiveThreadIdByWorkspace = sessionActiveThreadIds;
  }
  const sessionActiveWorkspaceId = readSessionActiveWorkspaceId();
  if (sessionActiveWorkspaceId) {
    state.lastActiveWorkspaceId = sessionActiveWorkspaceId;
  }
  if (!usedFallback) {
    persistedThreadStorageCache = state;
    persistedThreadStorageCacheReady = true;
  }
  return state;
}

async function getPersistedThreadStorageStateCache(): Promise<PersistedThreadStorageState> {
  if (persistedThreadStorageCacheReady && persistedThreadStorageCache) {
    return persistedThreadStorageCache;
  }
  return loadPersistedThreadStorageState();
}

async function persistThreadStorageState(state: PersistedThreadStorageState): Promise<boolean> {
  const payload = buildPersistedThreadStoragePayload(state);
  const { value: response } = await invokeOptionalThreadSnapshotMethod(
    () =>
      getRuntimeClient().threadSnapshotsSetV1({
        snapshots: payload,
      }),
    {
      message:
        "Web runtime thread snapshot persistence unavailable; native history write was skipped.",
      details: {
        snapshotCount: Object.keys(payload).length,
      },
      value: null,
    }
  );
  if (response === null) {
    return false;
  }
  persistedThreadStorageCache = clonePersistedThreadStorageState(state);
  persistedThreadStorageCacheReady = true;
  writeSessionThreadStorageState(state);
  writeSessionActiveWorkspaceId(state.lastActiveWorkspaceId ?? null);
  writeSessionActiveThreadIds(state.lastActiveThreadIdByWorkspace ?? {});
  return true;
}

async function enqueuePersistedThreadStorageWrite(
  update: (currentState: PersistedThreadStorageState) => PersistedThreadStorageState
): Promise<boolean> {
  let result = false;
  const run = async () => {
    const currentState = await getPersistedThreadStorageStateCache();
    result = await persistThreadStorageState(update(currentState));
  };
  const queuedRun = persistedThreadStorageWriteQueue.then(run, run);
  persistedThreadStorageWriteQueue = queuedRun.catch(() => undefined);
  await queuedRun;
  return result;
}

export async function readPersistedThreadStorageState(): Promise<PersistedThreadStorageState> {
  return loadPersistedThreadStorageState();
}

export async function readPersistedThreadAtlasMemoryDigests(): Promise<ThreadAtlasMemoryDigestMap> {
  const state = await getPersistedThreadStorageStateCache();
  return state.atlasMemoryDigests ?? {};
}

export async function writePersistedThreadSnapshots(
  snapshots: ThreadSnapshotsMap
): Promise<boolean> {
  return writePersistedThreadStorageState({
    snapshots,
    atlasMemoryDigests: undefined,
    pendingDraftMessagesByWorkspace: {},
  });
}

export async function writePersistedThreadStorageState(
  state: PersistedThreadStorageState
): Promise<boolean> {
  const currentState = (persistedThreadStorageCacheReady && persistedThreadStorageCache
    ? clonePersistedThreadStorageState(persistedThreadStorageCache)
    : readSessionThreadStorageState()) ?? {
    snapshots: {},
    atlasMemoryDigests: {},
    pendingDraftMessagesByWorkspace: {},
    lastActiveWorkspaceId: readSessionActiveWorkspaceId(),
    lastActiveThreadIdByWorkspace: readSessionActiveThreadIds(),
  };
  const optimisticState: PersistedThreadStorageState = {
    snapshots: state.snapshots,
    ...(normalizeOptionalAtlasMemoryDigests(
      state.atlasMemoryDigests ?? currentState.atlasMemoryDigests ?? {}
    )
      ? {
          atlasMemoryDigests: state.atlasMemoryDigests ?? currentState.atlasMemoryDigests ?? {},
        }
      : {}),
    pendingDraftMessagesByWorkspace: state.pendingDraftMessagesByWorkspace,
    lastActiveWorkspaceId:
      state.lastActiveWorkspaceId ?? currentState.lastActiveWorkspaceId ?? null,
    lastActiveThreadIdByWorkspace:
      state.lastActiveThreadIdByWorkspace ?? currentState.lastActiveThreadIdByWorkspace ?? {},
  };
  persistedThreadStorageCache = clonePersistedThreadStorageState(optimisticState);
  persistedThreadStorageCacheReady = true;
  writeSessionThreadStorageState(optimisticState);
  writeSessionActiveWorkspaceId(optimisticState.lastActiveWorkspaceId ?? null);
  writeSessionActiveThreadIds(optimisticState.lastActiveThreadIdByWorkspace ?? {});
  return enqueuePersistedThreadStorageWrite((currentState) => ({
    snapshots: state.snapshots,
    ...(normalizeOptionalAtlasMemoryDigests(
      state.atlasMemoryDigests ?? currentState.atlasMemoryDigests ?? {}
    )
      ? {
          atlasMemoryDigests: state.atlasMemoryDigests ?? currentState.atlasMemoryDigests ?? {},
        }
      : {}),
    pendingDraftMessagesByWorkspace: state.pendingDraftMessagesByWorkspace,
    lastActiveWorkspaceId:
      state.lastActiveWorkspaceId ?? currentState.lastActiveWorkspaceId ?? null,
    lastActiveThreadIdByWorkspace:
      state.lastActiveThreadIdByWorkspace ?? currentState.lastActiveThreadIdByWorkspace ?? {},
  }));
}

export async function writePersistedThreadAtlasMemoryDigests(
  atlasMemoryDigests: ThreadAtlasMemoryDigestMap
): Promise<boolean> {
  return enqueuePersistedThreadStorageWrite((currentState) => ({
    ...currentState,
    atlasMemoryDigests,
  }));
}

export async function readPersistedActiveWorkspaceId(): Promise<string | null> {
  const sessionWorkspaceId = readSessionActiveWorkspaceId();
  if (sessionWorkspaceId) {
    return sessionWorkspaceId;
  }
  const state = await getPersistedThreadStorageStateCache();
  return state.lastActiveWorkspaceId ?? null;
}

export async function readPersistedActiveThreadIdsByWorkspace(): Promise<WorkspaceActiveThreadIdsMap> {
  const sessionActiveThreadIds = readSessionActiveThreadIds();
  if (Object.keys(sessionActiveThreadIds).length > 0) {
    return sessionActiveThreadIds;
  }
  const state = await getPersistedThreadStorageStateCache();
  return state.lastActiveThreadIdByWorkspace ?? {};
}

export function readPersistedPendingInterruptThreadIds(): string[] {
  return readSessionPendingInterruptThreadIds();
}

export async function writePersistedActiveWorkspaceId(
  workspaceId: string | null
): Promise<boolean> {
  writeSessionActiveWorkspaceId(workspaceId);
  return enqueuePersistedThreadStorageWrite((currentState) => ({
    ...currentState,
    lastActiveWorkspaceId: workspaceId,
  }));
}

export function writePersistedPendingInterruptThreadIds(threadIds: string[]): void {
  writeSessionPendingInterruptThreadIds(threadIds);
}

export function __resetPersistedThreadStorageCacheForTests(): void {
  persistedThreadStorageCache = null;
  persistedThreadStorageCacheReady = false;
  persistedThreadStorageWriteQueue = Promise.resolve();
  removeSafeSessionStorageItem(SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY);
}
