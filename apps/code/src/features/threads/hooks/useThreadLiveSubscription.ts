import { useEffect, useRef, useState } from "react";
import { subscribeAppServerEvents } from "../../../application/runtime/ports/events";
import { updateRuntimeEventChannelDiagnostics } from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";
import { subscribeRuntimeEventStateChannel } from "../../../application/runtime/ports/runtimeEventStateMachine";
import {
  subscribeThreadLive,
  unsubscribeThreadLive,
} from "../../../application/runtime/ports/tauriThreads";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import {
  getAppServerParams,
  isNativeStateFabricUpdatedEvent,
} from "../../../utils/appServerEvents";

export type ThreadLiveConnectionState = "live" | "syncing" | "fallback" | "offline";

type UseThreadLiveSubscriptionOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  activeTurnId?: string | null;
  isThreadProcessing?: boolean;
  refreshThread: (
    workspaceId: string,
    threadId: string,
    options?: {
      replaceLocal?: boolean;
    }
  ) => Promise<unknown> | unknown;
  listThreadsForWorkspace: (
    workspace: WorkspaceInfo,
    options?: { preserveState?: boolean }
  ) => Promise<void> | void;
  onDebug?: (entry: DebugEntry) => void;
};

const THREAD_LIVE_CHANNEL_ID = "thread-live-subscription";
const THREAD_LIVE_CHANNEL_LABEL = "Thread live subscription";
const REFRESH_DEBOUNCE_MS = 120;

type ThreadFabricChangeKind =
  | "threadLiveDetached"
  | "threadLiveHeartbeatObserved"
  | "threadLiveStatePatched";

type ThreadLiveSubscribeResult = {
  subscriptionId?: unknown;
};

function readThreadFabricChangeKind(value: unknown): ThreadFabricChangeKind | null {
  if (
    value === "threadLiveDetached" ||
    value === "threadLiveHeartbeatObserved" ||
    value === "threadLiveStatePatched"
  ) {
    return value;
  }
  return null;
}

function readSubscriptionId(result: ThreadLiveSubscribeResult): string | null {
  if (typeof result.subscriptionId !== "string") {
    return null;
  }
  const normalized = result.subscriptionId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function useThreadLiveSubscription({
  activeWorkspace,
  activeThreadId,
  activeTurnId = null,
  isThreadProcessing = false,
  refreshThread,
  listThreadsForWorkspace,
  onDebug,
}: UseThreadLiveSubscriptionOptions): ThreadLiveConnectionState {
  const [connectionState, setConnectionState] = useState<ThreadLiveConnectionState>("offline");
  const activeWorkspaceRef = useRef(activeWorkspace);
  const activeThreadIdRef = useRef(activeThreadId);
  const activeTurnIdRef = useRef(activeTurnId);
  const isThreadProcessingRef = useRef(isThreadProcessing);
  const refreshThreadRef = useRef(refreshThread);
  const listThreadsForWorkspaceRef = useRef(listThreadsForWorkspace);
  const onDebugRef = useRef(onDebug);

  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
  }, [activeWorkspace]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    activeTurnIdRef.current = activeTurnId;
  }, [activeTurnId]);

  useEffect(() => {
    isThreadProcessingRef.current = isThreadProcessing;
  }, [isThreadProcessing]);

  useEffect(() => {
    refreshThreadRef.current = refreshThread;
  }, [refreshThread]);

  useEffect(() => {
    listThreadsForWorkspaceRef.current = listThreadsForWorkspace;
  }, [listThreadsForWorkspace]);

  useEffect(() => {
    onDebugRef.current = onDebug;
  }, [onDebug]);

  useEffect(() => {
    const workspace = activeWorkspace;
    const threadId = activeThreadId;

    if (!workspace?.connected || !threadId) {
      setConnectionState("offline");
      updateRuntimeEventChannelDiagnostics(THREAD_LIVE_CHANNEL_ID, {
        label: THREAD_LIVE_CHANNEL_LABEL,
        transport: "bridge",
        status: "stopped",
        retryAttempt: 0,
        retryDelayMs: null,
        lastError: null,
      });
      return;
    }

    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let streamOpen = false;
    let subscriptionId: string | null = null;

    const setLive = () => {
      if (disposed) {
        return;
      }
      setConnectionState("live");
      updateRuntimeEventChannelDiagnostics(THREAD_LIVE_CHANNEL_ID, {
        label: THREAD_LIVE_CHANNEL_LABEL,
        transport: "bridge",
        status: "open",
        retryAttempt: 0,
        retryDelayMs: null,
        lastError: null,
      });
    };

    const setFallback = (reason: string) => {
      if (disposed) {
        return;
      }
      setConnectionState("fallback");
      updateRuntimeEventChannelDiagnostics(THREAD_LIVE_CHANNEL_ID, {
        label: THREAD_LIVE_CHANNEL_LABEL,
        transport: "bridge",
        status: "fallback",
        retryAttempt: 0,
        retryDelayMs: null,
        lastError: reason,
      });
    };

    const setSyncing = () => {
      if (disposed) {
        return;
      }
      setConnectionState("syncing");
      updateRuntimeEventChannelDiagnostics(THREAD_LIVE_CHANNEL_ID, {
        label: THREAD_LIVE_CHANNEL_LABEL,
        transport: "bridge",
        status: streamOpen ? "open" : "connecting",
        retryAttempt: 0,
        retryDelayMs: null,
        lastError: null,
      });
    };

    const scheduleRefresh = (reason: "live-update" | "detached") => {
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        const latestWorkspace = activeWorkspaceRef.current;
        const latestThreadId = activeThreadIdRef.current;
        if (!latestWorkspace?.connected || !latestThreadId) {
          return;
        }
        onDebugRef.current?.({
          id: `${Date.now()}-thread-live-refresh`,
          timestamp: Date.now(),
          source: "server",
          label: "thread live refresh",
          payload: {
            workspaceId: latestWorkspace.id,
            threadId: latestThreadId,
            reason,
            activeTurnId: activeTurnIdRef.current,
            isProcessing: isThreadProcessingRef.current,
          },
        });
        void Promise.resolve(
          listThreadsForWorkspaceRef.current(latestWorkspace, { preserveState: true })
        ).catch(() => undefined);
        const refreshOptions = reason === "live-update" ? { replaceLocal: false } : undefined;
        void Promise.resolve(
          refreshThreadRef.current(latestWorkspace.id, latestThreadId, refreshOptions)
        ).catch(() => undefined);
      }, REFRESH_DEBOUNCE_MS);
    };

    updateRuntimeEventChannelDiagnostics(THREAD_LIVE_CHANNEL_ID, {
      label: THREAD_LIVE_CHANNEL_LABEL,
      transport: "bridge",
      status: "connecting",
      retryAttempt: 0,
      retryDelayMs: null,
      lastError: null,
    });
    setConnectionState("syncing");

    void subscribeThreadLive(workspace.id, threadId, {
      telemetrySource: "thread_live_subscription",
    })
      .then((result) => {
        if (disposed) {
          return;
        }
        subscriptionId = readSubscriptionId(result);
        if (!subscriptionId) {
          setFallback("subscribe-failed");
          return;
        }
        if (streamOpen) {
          setLive();
          return;
        }
        setSyncing();
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setFallback("subscribe-failed");
      });

    const unlistenEvents = subscribeAppServerEvents((event) => {
      if (!isNativeStateFabricUpdatedEvent(event)) {
        return;
      }
      const latestWorkspace = activeWorkspaceRef.current;
      const latestThreadId = activeThreadIdRef.current;
      if (!latestWorkspace?.connected || !latestThreadId) {
        return;
      }
      const params = getAppServerParams(event);
      if ((params.scopeKind ?? params.scope_kind) !== "thread") {
        return;
      }
      const workspaceId = String(
        params.workspaceId ?? params.workspace_id ?? event.workspace_id ?? ""
      );
      const threadIdValue = String(params.threadId ?? params.thread_id ?? "");
      if (workspaceId.trim() !== latestWorkspace.id || threadIdValue.trim() !== latestThreadId) {
        return;
      }
      const changeKind = readThreadFabricChangeKind(params.changeKind ?? params.change_kind);
      if (!changeKind) {
        return;
      }
      if (changeKind === "threadLiveDetached") {
        setFallback(changeKind);
        scheduleRefresh("detached");
        return;
      }
      setLive();
      if (changeKind === "threadLiveStatePatched") {
        scheduleRefresh("live-update");
      }
    });

    const unlistenState = subscribeRuntimeEventStateChannel("app-server-events", ({ current }) => {
      streamOpen = current.status === "open";
      if (current.status === "open") {
        if (subscriptionId) {
          setLive();
          return;
        }
        setSyncing();
        return;
      }
      if (
        current.status === "fallback" ||
        current.status === "reconnecting" ||
        current.status === "error"
      ) {
        setFallback(`stream-${current.status}`);
      }
    });

    return () => {
      disposed = true;
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }
      unlistenEvents();
      unlistenState();
      if (subscriptionId) {
        void Promise.resolve(
          unsubscribeThreadLive(subscriptionId, {
            telemetrySource: "thread_live_subscription",
          })
        ).catch(() => undefined);
      }
      updateRuntimeEventChannelDiagnostics(THREAD_LIVE_CHANNEL_ID, {
        label: THREAD_LIVE_CHANNEL_LABEL,
        transport: "bridge",
        status: "stopped",
        retryAttempt: 0,
        retryDelayMs: null,
        lastError: null,
      });
    };
  }, [activeThreadId, activeWorkspace]);

  return connectionState;
}
