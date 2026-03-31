import type { AppServerEvent } from "../types";
import { listen } from "../application/runtime/ports/desktopHostEvent";
import { isDesktopHostRuntime } from "../application/runtime/ports/desktopHostCore";
import {
  __resetRuntimeTurnContextForTests,
  normalizeAppServerPayload,
  registerRuntimeTurnContextByTurnId,
  registerRuntimeTurnRequestContext,
} from "./eventsRuntimePayloadAdapter";
import {
  createEventIdDeduper,
  parseWebRuntimeWsEventId,
  parseWebRuntimeWsEventIdentifier,
  resolveWebTransportEndpointHints,
  safeParseJson,
  withLastEventIdQuery,
} from "./eventsWebTransportHelpers";
import { logger } from "./logger";
import { createExponentialRetryScheduler } from "./retryScheduler";
import {
  APP_SERVER_BRIDGE_CHANNEL_ID,
  APP_SERVER_WS_CHANNEL_ID,
  createCompositeUnsubscribe,
  createRuntimeReconnectSignalEvent,
  registerRuntimeEventDesktopHostSubscription,
  RUNTIME_HOST_EVENT_NAME,
  subscribeWebRuntimeSseEventsShared,
  WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS,
  WEB_RUNTIME_WS_FALLBACK_PROBE_MS,
  type Listener,
  type RuntimeEventReplayCursor,
  type Unsubscribe,
} from "./runtimeEventBridgeTransportShared";
import {
  normalizeRuntimeEventChannelError,
  updateRuntimeEventChannelDiagnostics,
} from "@ku0/code-runtime-client/runtimeEventChannelDiagnostics";
import {
  recordRuntimeEventDedupeHit,
  recordRuntimeEventFallbackEntered,
  recordRuntimeEventFallbackRecovered,
  recordRuntimeEventReconnectAttempt,
  recordRuntimeEventReconnectSuccess,
} from "@ku0/code-runtime-client/runtimeEventStabilityMetrics";

export type TerminalExitEvent = {
  workspaceId: string;
  terminalId: string;
};

export type { Unsubscribe };

export {
  __resetRuntimeTurnContextForTests,
  registerRuntimeTurnContextByTurnId,
  registerRuntimeTurnRequestContext,
};

type SubscriptionOptions = {
  onError?: (error: unknown) => void;
};

const APP_SERVER_BRIDGE_START_RETRY_BASE_MS = 400;
const APP_SERVER_BRIDGE_START_RETRY_MAX_MS = 10_000;
const EVENT_HUB_LISTEN_RETRY_BASE_MS = 400;
const EVENT_HUB_LISTEN_RETRY_MAX_MS = 10_000;
const RUNTIME_EVENT_STATE_MACHINE_V2_ENV = "VITE_RUNTIME_EVENT_STATE_MACHINE_V2";

function readRuntimeEventEnv(name: string): string | null {
  const viteEnvValue = import.meta.env?.[name];
  if (typeof viteEnvValue === "string" && viteEnvValue.trim().length > 0) {
    return viteEnvValue.trim();
  }
  const processEnv = (
    globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const value = processEnv?.[name];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isRuntimeEventBridgeV2Enabled(): boolean {
  return readRuntimeEventEnv(RUNTIME_EVENT_STATE_MACHINE_V2_ENV) === "1";
}

async function loadStartAppServerBridgeV2() {
  const module = await import("./runtimeEventBridgeV2");
  return module.startAppServerBridgeV2;
}

function isDesktopHostRuntimeRuntime(): boolean {
  try {
    return isDesktopHostRuntime();
  } catch {
    return false;
  }
}

function notifySubscriptionError(
  options: SubscriptionOptions | undefined,
  error: unknown,
  context: string
): void {
  try {
    options?.onError?.(error);
  } catch (callbackError) {
    logger.error(`[events] ${context} onError handler failed`, callbackError);
  }
}

async function registerDesktopHostSubscription(
  eventName: string,
  onPayload: (payload: unknown) => void,
  options?: SubscriptionOptions
): Promise<Unsubscribe | null> {
  return registerRuntimeEventDesktopHostSubscription(eventName, onPayload, (error) => {
    notifySubscriptionError(options, error, `${eventName} listener startup`);
  });
}

function subscribeWebRuntimeSseEvents(
  endpoint: string,
  onEvent: Listener<AppServerEvent>,
  options?: SubscriptionOptions,
  replayCursor?: RuntimeEventReplayCursor
): Unsubscribe | null {
  let reported = false;
  return subscribeWebRuntimeSseEventsShared(
    endpoint,
    onEvent,
    (error) => {
      if (reported) {
        return;
      }
      reported = true;
      notifySubscriptionError(options, error, "web runtime SSE stream");
    },
    replayCursor
  );
}

function subscribeWebRuntimeWsEvents(
  wsEndpoint: string,
  onEvent: Listener<AppServerEvent>,
  options?: SubscriptionOptions,
  fallbackToSse?: (replayCursor: RuntimeEventReplayCursor) => Unsubscribe | null
): Unsubscribe | null {
  if (typeof WebSocket !== "function") {
    return null;
  }

  let disposed = false;
  const replayCursor: RuntimeEventReplayCursor = { lastEventId: null };
  let socket: WebSocket | null = null;
  let hasOpened = false;
  let usingFallback = false;
  let lastEventId: number | null = null;
  let lastReconnectSignalAt = 0;
  let errorReported = false;
  let fallbackUnsubscribe: Unsubscribe | null = null;
  let fallbackProbeTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackEnteredAtMs: number | null = null;
  const dedupe = createEventIdDeduper();

  const trackReplayEventId = (eventId: number | null) => {
    if (eventId !== null && (lastEventId === null || eventId > lastEventId)) {
      lastEventId = eventId;
    }
  };

  updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
    label: "App server stream",
    transport: "ws",
    status: "connecting",
    retryAttempt: 0,
    retryDelayMs: null,
    lastError: null,
  });

  const reconnectScheduler = createExponentialRetryScheduler({
    baseDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
    maxDelayMs: WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
    onRetry: () => {
      connect();
    },
    onSchedule: ({ attempt, delayMs }) => {
      recordRuntimeEventReconnectAttempt();
      updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
        label: "App server stream",
        transport: "ws",
        status: "reconnecting",
        retryAttempt: attempt,
        retryDelayMs: delayMs,
      });
    },
  });

  const clearFallbackProbeTimer = () => {
    if (fallbackProbeTimer !== null) {
      clearTimeout(fallbackProbeTimer);
      fallbackProbeTimer = null;
    }
  };

  const reportError = (error: unknown) => {
    if (errorReported) {
      return;
    }
    errorReported = true;
    updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
      label: "App server stream",
      status: "error",
      lastError: normalizeRuntimeEventChannelError(error),
    });
    notifySubscriptionError(options, error, "web runtime websocket stream");
  };

  const teardownSocket = () => {
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // Ignore close errors on teardown.
    }
    socket = null;
  };

  const activateFallback = () => {
    if (disposed || usingFallback) {
      return;
    }
    usingFallback = true;
    fallbackEnteredAtMs = Date.now();
    recordRuntimeEventFallbackEntered("websocket-fallback");
    reconnectScheduler.clear();
    teardownSocket();
    fallbackUnsubscribe = fallbackToSse?.(replayCursor) ?? null;
    if (!fallbackUnsubscribe) {
      usingFallback = false;
      scheduleReconnect();
      return;
    }
    updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
      label: "App server stream",
      transport: "sse",
      status: "fallback",
      retryDelayMs: WEB_RUNTIME_WS_FALLBACK_PROBE_MS,
    });
    scheduleFallbackProbe();
  };

  const scheduleFallbackProbe = () => {
    if (disposed || !usingFallback || fallbackProbeTimer !== null) {
      return;
    }
    fallbackProbeTimer = setTimeout(() => {
      fallbackProbeTimer = null;
      if (disposed || !usingFallback) {
        return;
      }
      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
        fallbackUnsubscribe = null;
      }
      usingFallback = false;
      if (fallbackEnteredAtMs !== null) {
        recordRuntimeEventFallbackRecovered(Date.now() - fallbackEnteredAtMs);
      }
      fallbackEnteredAtMs = null;
      reconnectScheduler.reset();
      errorReported = false;
      updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
        label: "App server stream",
        transport: "ws",
        status: "connecting",
        retryDelayMs: null,
      });
      connect();
    }, WEB_RUNTIME_WS_FALLBACK_PROBE_MS);
  };

  const scheduleReconnect = () => {
    if (disposed || usingFallback || reconnectScheduler.hasPendingRetry()) {
      return;
    }
    reconnectScheduler.schedule();
  };

  const handleFailure = (error?: unknown) => {
    if (error !== undefined) {
      reportError(error);
    }
    teardownSocket();
    if (disposed || usingFallback) {
      return;
    }
    if (!hasOpened && fallbackToSse) {
      activateFallback();
      return;
    }
    scheduleReconnect();
  };

  const emitReconnectSignal = () => {
    const now = Date.now();
    if (
      hasOpened &&
      (lastReconnectSignalAt === 0 ||
        now - lastReconnectSignalAt >= WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS)
    ) {
      lastReconnectSignalAt = now;
      onEvent(createRuntimeReconnectSignalEvent(now));
      return;
    }
    hasOpened = true;
  };

  const connect = () => {
    if (disposed || usingFallback) {
      return;
    }
    updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
      label: "App server stream",
      transport: "ws",
      status: "connecting",
      retryDelayMs: null,
    });

    trackReplayEventId(replayCursor.lastEventId);
    const endpointWithReplay = withLastEventIdQuery(wsEndpoint, lastEventId);
    try {
      socket = new WebSocket(endpointWithReplay);
    } catch (error) {
      reportError(error);
      if (!hasOpened && fallbackToSse) {
        activateFallback();
        return;
      }
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      recordRuntimeEventReconnectSuccess();
      emitReconnectSignal();
      reconnectScheduler.reset();
      errorReported = false;
      updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
        label: "App server stream",
        transport: "ws",
        status: "open",
        retryAttempt: 0,
        retryDelayMs: null,
        lastError: null,
      });
    };
    socket.onmessage = (messageEvent) => {
      const parsedPayload =
        typeof messageEvent.data === "string"
          ? safeParseJson(messageEvent.data)
          : (messageEvent.data as unknown);
      if (!parsedPayload) {
        return;
      }
      const eventId = parseWebRuntimeWsEventId(parsedPayload);
      if (eventId !== null) {
        lastEventId = eventId;
        replayCursor.lastEventId = eventId;
      }
      const eventIdentifier = parseWebRuntimeWsEventIdentifier(parsedPayload);
      if (dedupe.isDuplicate(eventIdentifier)) {
        recordRuntimeEventDedupeHit();
        return;
      }
      const normalized = normalizeAppServerPayload(parsedPayload);
      if (normalized) {
        onEvent(normalized);
      }
    };
    socket.onerror = (error) => {
      handleFailure(error);
    };
    socket.onclose = () => {
      handleFailure();
    };
  };

  connect();

  return () => {
    disposed = true;
    reconnectScheduler.clear();
    clearFallbackProbeTimer();
    teardownSocket();
    if (fallbackUnsubscribe) {
      fallbackUnsubscribe();
      fallbackUnsubscribe = null;
    }
    fallbackEnteredAtMs = null;
    updateRuntimeEventChannelDiagnostics(APP_SERVER_WS_CHANNEL_ID, {
      label: "App server stream",
      status: "stopped",
      retryDelayMs: null,
    });
  };
}

async function subscribeWebRuntimeEvents(
  onEvent: Listener<AppServerEvent>,
  options?: SubscriptionOptions
): Promise<Unsubscribe | null> {
  const hints = await resolveWebTransportEndpointHints();
  const fallbackToSse = (replayCursor?: RuntimeEventReplayCursor) =>
    hints.eventsEndpoint
      ? subscribeWebRuntimeSseEvents(hints.eventsEndpoint, onEvent, options, replayCursor)
      : null;

  if (hints.wsEndpoint) {
    const wsUnsubscribe = subscribeWebRuntimeWsEvents(
      hints.wsEndpoint,
      onEvent,
      options,
      fallbackToSse
    );
    if (wsUnsubscribe) {
      return wsUnsubscribe;
    }
  }

  return fallbackToSse({ lastEventId: null });
}

async function startAppServerBridge(
  onEvent: Listener<AppServerEvent>,
  options?: SubscriptionOptions
): Promise<Unsubscribe> {
  const unsubscribers: Unsubscribe[] = [];

  if (isDesktopHostRuntimeRuntime()) {
    const runtimeUnsubscribe = await registerDesktopHostSubscription(
      RUNTIME_HOST_EVENT_NAME,
      (payload) => {
        const normalized = normalizeAppServerPayload(payload);
        if (normalized) {
          onEvent(normalized);
        }
      },
      options
    );
    if (runtimeUnsubscribe) {
      unsubscribers.push(runtimeUnsubscribe);
      return createCompositeUnsubscribe(unsubscribers);
    }
  }

  const webUnsubscribe = await subscribeWebRuntimeEvents(onEvent, options);
  if (webUnsubscribe) {
    unsubscribers.push(webUnsubscribe);
  }
  return createCompositeUnsubscribe(unsubscribers);
}

function createAppServerEventHub() {
  const listeners = new Set<Listener<AppServerEvent>>();
  let unlisten: Unsubscribe | null = null;
  let listenPromise: Promise<Unsubscribe> | null = null;
  let startupOptions: SubscriptionOptions | undefined;

  const restartScheduler = createExponentialRetryScheduler({
    baseDelayMs: APP_SERVER_BRIDGE_START_RETRY_BASE_MS,
    maxDelayMs: APP_SERVER_BRIDGE_START_RETRY_MAX_MS,
    onRetry: () => {
      start(startupOptions);
    },
    onSchedule: ({ attempt, delayMs }) => {
      recordRuntimeEventReconnectAttempt();
      updateRuntimeEventChannelDiagnostics(APP_SERVER_BRIDGE_CHANNEL_ID, {
        label: "App server bridge",
        transport: isDesktopHostRuntimeRuntime() ? "desktop-compat" : "bridge",
        status: "reconnecting",
        retryAttempt: attempt,
        retryDelayMs: delayMs,
      });
    },
  });

  const emit = (payload: AppServerEvent) => {
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        logger.error("[events] runtime event listener failed", error);
      }
    }
  };

  const scheduleRestart = () => {
    if (listenPromise || unlisten || listeners.size === 0 || restartScheduler.hasPendingRetry()) {
      return;
    }
    restartScheduler.schedule();
  };

  const start = (options?: SubscriptionOptions) => {
    if (options) {
      startupOptions = options;
    }
    if (unlisten || listenPromise || listeners.size === 0) {
      return;
    }
    updateRuntimeEventChannelDiagnostics(APP_SERVER_BRIDGE_CHANNEL_ID, {
      label: "App server bridge",
      transport: isDesktopHostRuntimeRuntime() ? "desktop-compat" : "bridge",
      status: "connecting",
      retryDelayMs: null,
    });
    listenPromise = (async () => {
      if (!isRuntimeEventBridgeV2Enabled()) {
        return startAppServerBridge(emit, startupOptions);
      }
      const startAppServerBridgeV2 = await loadStartAppServerBridgeV2();
      return startAppServerBridgeV2(emit, startupOptions);
    })();
    listenPromise
      .then((handler) => {
        listenPromise = null;
        restartScheduler.reset();
        if (listeners.size === 0) {
          handler();
          updateRuntimeEventChannelDiagnostics(APP_SERVER_BRIDGE_CHANNEL_ID, {
            label: "App server bridge",
            status: "stopped",
            retryAttempt: 0,
            retryDelayMs: null,
          });
          startupOptions = undefined;
          return;
        }
        unlisten = handler;
        recordRuntimeEventReconnectSuccess();
        updateRuntimeEventChannelDiagnostics(APP_SERVER_BRIDGE_CHANNEL_ID, {
          label: "App server bridge",
          transport: isDesktopHostRuntimeRuntime() ? "desktop-compat" : "bridge",
          status: "open",
          retryAttempt: 0,
          retryDelayMs: null,
          lastError: null,
        });
      })
      .catch((error) => {
        listenPromise = null;
        if (listeners.size === 0) {
          startupOptions = undefined;
          return;
        }
        updateRuntimeEventChannelDiagnostics(APP_SERVER_BRIDGE_CHANNEL_ID, {
          label: "App server bridge",
          status: "error",
          lastError: normalizeRuntimeEventChannelError(error),
        });
        notifySubscriptionError(startupOptions, error, "app-server bridge startup");
        scheduleRestart();
      });
  };

  const stop = () => {
    restartScheduler.reset();
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore double-unsubscribe calls when tearing down.
      }
      unlisten = null;
    }
    updateRuntimeEventChannelDiagnostics(APP_SERVER_BRIDGE_CHANNEL_ID, {
      label: "App server bridge",
      status: "stopped",
      retryAttempt: 0,
      retryDelayMs: null,
    });
    startupOptions = undefined;
  };

  const subscribe = (
    onEvent: Listener<AppServerEvent>,
    options?: SubscriptionOptions
  ): Unsubscribe => {
    listeners.add(onEvent);
    start(options);
    return () => {
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        stop();
      }
    };
  };

  const reset = () => {
    listeners.clear();
    restartScheduler.reset();
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore test reset cleanup failures.
      }
      unlisten = null;
    }
    listenPromise = null;
    startupOptions = undefined;
  };

  return { reset, subscribe };
}

function createEventHub<T>(eventName: string) {
  const listeners = new Set<Listener<T>>();
  let unlisten: Unsubscribe | null = null;
  let listenPromise: Promise<Unsubscribe> | null = null;
  let startupOptions: SubscriptionOptions | undefined;
  const restartScheduler = createExponentialRetryScheduler({
    baseDelayMs: EVENT_HUB_LISTEN_RETRY_BASE_MS,
    maxDelayMs: EVENT_HUB_LISTEN_RETRY_MAX_MS,
    onRetry: () => {
      start(startupOptions);
    },
  });

  const scheduleRestart = () => {
    if (listenPromise || unlisten || listeners.size === 0 || restartScheduler.hasPendingRetry()) {
      return;
    }
    restartScheduler.schedule();
  };

  const start = (options?: SubscriptionOptions) => {
    if (options) {
      startupOptions = options;
    }
    if (unlisten || listenPromise || listeners.size === 0) {
      return;
    }
    if (!isDesktopHostRuntimeRuntime()) {
      return;
    }
    listenPromise = listen<T>(eventName, (event: { payload: T }) => {
      for (const listener of listeners) {
        try {
          listener(event.payload);
        } catch (error) {
          logger.error(`[events] ${eventName} listener failed`, error);
        }
      }
    });
    listenPromise
      .then((handler) => {
        listenPromise = null;
        restartScheduler.reset();
        if (listeners.size === 0) {
          handler();
          startupOptions = undefined;
          return;
        }
        unlisten = handler;
      })
      .catch((error) => {
        listenPromise = null;
        if (listeners.size === 0) {
          startupOptions = undefined;
          return;
        }
        notifySubscriptionError(startupOptions, error, `${eventName} listener startup`);
        scheduleRestart();
      });
  };

  const stop = () => {
    restartScheduler.reset();
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore double-unlisten when tearing down.
      }
      unlisten = null;
    }
    startupOptions = undefined;
  };

  const subscribe = (onEvent: Listener<T>, options?: SubscriptionOptions): Unsubscribe => {
    listeners.add(onEvent);
    start(options);
    return () => {
      listeners.delete(onEvent);
      if (listeners.size === 0) {
        stop();
      }
    };
  };

  const reset = () => {
    listeners.clear();
    restartScheduler.reset();
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore test reset cleanup failures.
      }
      unlisten = null;
    }
    listenPromise = null;
    startupOptions = undefined;
  };

  return { reset, subscribe };
}

const appServerHub = createAppServerEventHub();
const terminalExitHub = createEventHub<TerminalExitEvent>("terminal-exit");
const updaterCheckHub = createEventHub<void>("updater-check");
const menuNewAgentHub = createEventHub<void>("menu-new-agent");
const menuNewWorktreeAgentHub = createEventHub<void>("menu-new-worktree-agent");
const menuNewCloneAgentHub = createEventHub<void>("menu-new-clone-agent");
const menuAddWorkspaceHub = createEventHub<void>("menu-add-workspace");
const menuOpenSettingsHub = createEventHub<void>("menu-open-settings");
const menuToggleProjectsSidebarHub = createEventHub<void>("menu-toggle-projects-sidebar");
const menuToggleGitSidebarHub = createEventHub<void>("menu-toggle-git-sidebar");
const menuToggleDebugPanelHub = createEventHub<void>("menu-toggle-debug-panel");
const menuToggleTerminalHub = createEventHub<void>("menu-toggle-terminal");
const menuNextAgentHub = createEventHub<void>("menu-next-agent");
const menuPrevAgentHub = createEventHub<void>("menu-prev-agent");
const menuNextWorkspaceHub = createEventHub<void>("menu-next-workspace");
const menuPrevWorkspaceHub = createEventHub<void>("menu-prev-workspace");
const menuCycleModelHub = createEventHub<void>("menu-composer-cycle-model");
const menuCycleAccessHub = createEventHub<void>("menu-composer-cycle-access");
const menuCycleReasoningHub = createEventHub<void>("menu-composer-cycle-reasoning");
const menuCycleCollaborationHub = createEventHub<void>("menu-composer-cycle-collaboration");
const menuComposerCycleModelHub = createEventHub<void>("menu-composer-cycle-model");
const menuComposerCycleAccessHub = createEventHub<void>("menu-composer-cycle-access");
const menuComposerCycleReasoningHub = createEventHub<void>("menu-composer-cycle-reasoning");
const menuComposerCycleCollaborationHub = createEventHub<void>("menu-composer-cycle-collaboration");

export function subscribeAppServerEvents(
  onEvent: (event: AppServerEvent) => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return appServerHub.subscribe(onEvent, options);
}

export function subscribeTerminalExit(
  onEvent: (event: TerminalExitEvent) => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return terminalExitHub.subscribe(onEvent, options);
}

export function subscribeUpdaterCheck(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return updaterCheckHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewAgent(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuNewAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewWorktreeAgent(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuNewWorktreeAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewCloneAgent(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuNewCloneAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuAddWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuAddWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuOpenSettings(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuOpenSettingsHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleProjectsSidebar(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuToggleProjectsSidebarHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleGitSidebar(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuToggleGitSidebarHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleDebugPanel(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuToggleDebugPanelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleTerminal(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuToggleTerminalHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNextAgent(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuNextAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuPrevAgent(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuPrevAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNextWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuNextWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuPrevWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuPrevWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleModel(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuCycleModelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleAccessMode(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuCycleAccessHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleReasoning(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuCycleReasoningHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleCollaborationMode(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuCycleCollaborationHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleModel(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuComposerCycleModelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleAccess(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuComposerCycleAccessHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleReasoning(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuComposerCycleReasoningHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleCollaboration(
  onEvent: () => void,
  options?: SubscriptionOptions
): Unsubscribe {
  return menuComposerCycleCollaborationHub.subscribe(() => {
    onEvent();
  }, options);
}

export function __resetEventSubscriptionsForTests(): void {
  appServerHub.reset();
  terminalExitHub.reset();
  updaterCheckHub.reset();
  menuNewAgentHub.reset();
  menuNewWorktreeAgentHub.reset();
  menuNewCloneAgentHub.reset();
  menuAddWorkspaceHub.reset();
  menuOpenSettingsHub.reset();
  menuToggleProjectsSidebarHub.reset();
  menuToggleGitSidebarHub.reset();
  menuToggleDebugPanelHub.reset();
  menuToggleTerminalHub.reset();
  menuNextAgentHub.reset();
  menuPrevAgentHub.reset();
  menuNextWorkspaceHub.reset();
  menuPrevWorkspaceHub.reset();
  menuCycleModelHub.reset();
  menuCycleAccessHub.reset();
  menuCycleReasoningHub.reset();
  menuCycleCollaborationHub.reset();
  menuComposerCycleModelHub.reset();
  menuComposerCycleAccessHub.reset();
  menuComposerCycleReasoningHub.reset();
  menuComposerCycleCollaborationHub.reset();
}
