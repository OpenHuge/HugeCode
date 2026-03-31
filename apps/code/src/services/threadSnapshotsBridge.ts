import { detectRuntimeMode, getRuntimeClient } from "./runtimeClient";
import {
  getErrorMessage,
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "./runtimeTransport";
import { logRuntimeWarning } from "./runtimeTurnHelpers";
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
const SESSION_THREAD_STORAGE_RECOVERY_HINT_KEY = "codexmonitor.threadStorageRecoverySession";
const SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY = "codexmonitor.pendingInterruptThreadIdsSession";
const SESSION_THREAD_STORAGE_RECOVERY_WINDOW_MS = 30_000;

type ThreadStorageSessionRecoveryHint = {
  updatedAt: number;
};

let persistedThreadStorageCache: PersistedThreadStorageState | null = null;
let persistedThreadStorageCacheReady = false;
let persistedThreadStorageWriteQueue: Promise<void> = Promise.resolve();
const reportedThreadStorageFallbackKinds = new Set<string>();

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

function clearSessionThreadStorageState(): void {
  removeSafeSessionStorageItem(SESSION_THREAD_STORAGE_STATE_KEY);
}

function readSessionThreadStorageRecoveryHint(): ThreadStorageSessionRecoveryHint | null {
  const raw = readSafeSessionStorageItem(SESSION_THREAD_STORAGE_RECOVERY_HINT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const updatedAt = parsed.updatedAt;
    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) {
      return null;
    }
    return { updatedAt };
  } catch {
    return null;
  }
}

function writeSessionThreadStorageRecoveryHint(timestamp = Date.now()): void {
  writeSafeSessionStorageItem(
    SESSION_THREAD_STORAGE_RECOVERY_HINT_KEY,
    JSON.stringify({ updatedAt: timestamp })
  );
}

function clearSessionThreadStorageRecoveryHint(): void {
  removeSafeSessionStorageItem(SESSION_THREAD_STORAGE_RECOVERY_HINT_KEY);
}

function readSessionThreadStorageRecoveryWindowState(referenceNow = Date.now()): {
  recoveryWindowAgeMs: number | null;
  recoveryWindowState: "active" | "expired" | "missing";
} {
  const hint = readSessionThreadStorageRecoveryHint();
  if (!hint) {
    return {
      recoveryWindowState: "missing",
      recoveryWindowAgeMs: null,
    };
  }
  const recoveryWindowAgeMs = Math.max(0, referenceNow - hint.updatedAt);
  if (recoveryWindowAgeMs <= SESSION_THREAD_STORAGE_RECOVERY_WINDOW_MS) {
    return {
      recoveryWindowState: "active",
      recoveryWindowAgeMs,
    };
  }
  clearSessionThreadStorageRecoveryHint();
  return {
    recoveryWindowState: "expired",
    recoveryWindowAgeMs,
  };
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

function mergeClientOwnedSessionThreadStorageState(params: {
  base: PersistedThreadStorageState;
  overlay: PersistedThreadStorageState | null;
}): PersistedThreadStorageState {
  const overlay = params.overlay;
  if (!overlay) {
    return params.base;
  }
  return {
    ...params.base,
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

function hasPersistedThreadSnapshotsFallbackState(
  state: PersistedThreadStorageState | null | undefined
): boolean {
  // Session atlas digests are client-owned memory cache and already have a
  // separate local persistence path. They should not reactivate thread snapshot
  // fallback authority when runtime thread snapshots are empty.
  return Boolean(state && Object.keys(state.snapshots).length > 0);
}

function reportThreadStorageFallback(
  kind:
    | "session_snapshot_overlay_used"
    | "session_snapshot_overlay_ignored"
    | "session_snapshot_overlay_suppressed"
    | "session_snapshot_runtime_unavailable",
  details: Record<string, unknown>
): void {
  if (reportedThreadStorageFallbackKinds.has(kind)) {
    return;
  }
  reportedThreadStorageFallbackKinds.add(kind);
  const message =
    kind === "session_snapshot_overlay_ignored"
      ? "Ignoring session thread snapshot fallback because runtime-published thread state is available."
      : kind === "session_snapshot_overlay_suppressed"
        ? "Ignoring session thread snapshot fallback because runtime-published thread state is empty outside the temporary recovery window."
        : kind === "session_snapshot_runtime_unavailable"
          ? "Using session thread snapshot fallback because runtime-published thread state is unavailable."
          : "Using session thread snapshot fallback until runtime-published thread state is available.";
  logRuntimeWarning(message, details);
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
  const sessionState = readSessionThreadStorageState();
  const runtimePublishedThreadStateAvailable = hasPersistedThreadSnapshotsFallbackState(state);
  const sessionFallbackStateAvailable = hasPersistedThreadSnapshotsFallbackState(sessionState);
  const recoveryWindow = readSessionThreadStorageRecoveryWindowState();
  if (usedFallback) {
    state = mergePersistedThreadStorageState({
      base: state,
      overlay: sessionState,
    });
    if (sessionFallbackStateAvailable) {
      reportThreadStorageFallback("session_snapshot_runtime_unavailable", {
        snapshotCount: Object.keys(sessionState?.snapshots ?? {}).length,
        atlasMemoryDigestCount: Object.keys(sessionState?.atlasMemoryDigests ?? {}).length,
        recoveryWindowState: recoveryWindow.recoveryWindowState,
        recoveryWindowAgeMs: recoveryWindow.recoveryWindowAgeMs,
        recoveryWindowMs: SESSION_THREAD_STORAGE_RECOVERY_WINDOW_MS,
      });
    }
  } else if (runtimePublishedThreadStateAvailable) {
    state = mergeClientOwnedSessionThreadStorageState({
      base: state,
      overlay: sessionState,
    });
    clearSessionThreadStorageRecoveryHint();
    if (sessionFallbackStateAvailable) {
      reportThreadStorageFallback("session_snapshot_overlay_ignored", {
        runtimeSnapshotCount: Object.keys(state.snapshots).length,
        sessionSnapshotCount: Object.keys(sessionState?.snapshots ?? {}).length,
        recoveryWindowState: recoveryWindow.recoveryWindowState,
      });
    }
  } else if (sessionFallbackStateAvailable && recoveryWindow.recoveryWindowState === "active") {
    state = mergePersistedThreadStorageState({
      base: state,
      overlay: sessionState,
    });
    reportThreadStorageFallback("session_snapshot_overlay_used", {
      snapshotCount: Object.keys(sessionState?.snapshots ?? {}).length,
      atlasMemoryDigestCount: Object.keys(sessionState?.atlasMemoryDigests ?? {}).length,
      recoveryWindowState: recoveryWindow.recoveryWindowState,
      recoveryWindowAgeMs: recoveryWindow.recoveryWindowAgeMs,
      recoveryWindowMs: SESSION_THREAD_STORAGE_RECOVERY_WINDOW_MS,
    });
  } else {
    state = mergeClientOwnedSessionThreadStorageState({
      base: state,
      overlay: sessionState,
    });
    if (sessionFallbackStateAvailable) {
      clearSessionThreadStorageRecoveryHint();
      reportThreadStorageFallback("session_snapshot_overlay_suppressed", {
        runtimeSnapshotCount: Object.keys(state.snapshots).length,
        runtimeAtlasMemoryDigestCount: Object.keys(state.atlasMemoryDigests ?? {}).length,
        sessionSnapshotCount: Object.keys(sessionState?.snapshots ?? {}).length,
        sessionAtlasMemoryDigestCount: Object.keys(sessionState?.atlasMemoryDigests ?? {}).length,
        recoveryWindowState: recoveryWindow.recoveryWindowState,
        recoveryWindowAgeMs: recoveryWindow.recoveryWindowAgeMs,
        recoveryWindowMs: SESSION_THREAD_STORAGE_RECOVERY_WINDOW_MS,
      });
    }
  }
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
  clearSessionThreadStorageState();
  clearSessionThreadStorageRecoveryHint();
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
  writeSessionThreadStorageRecoveryHint();
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
  reportedThreadStorageFallbackKinds.clear();
  removeSafeSessionStorageItem(SESSION_PENDING_INTERRUPT_THREAD_IDS_KEY);
}
