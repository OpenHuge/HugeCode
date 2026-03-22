import type { AppServerEvent } from "../../../types";
import { logger } from "../logger";
import type { Unsubscribe } from "../ports/events";
import {
  parseRuntimeUpdatedEvent,
  runtimeUpdatedEventMatchesWorkspace,
  toOptionalWorkspaceId,
  type RuntimeUpdatedEvent,
} from "../../../utils/runtimeUpdatedEvent";

type AppServerEventSubscriber = (listener: (event: AppServerEvent) => void) => Unsubscribe;

export type RuntimeUpdatedEventSubscriptionOptions = {
  workspaceId?: string | null | (() => string | null);
  scopes?: readonly string[];
};

export type RuntimeUpdatedStoreSnapshot = {
  revision: number;
  lastEvent: RuntimeUpdatedEvent | null;
};

function resolveSubscriptionWorkspaceId(
  workspaceId: RuntimeUpdatedEventSubscriptionOptions["workspaceId"]
): string | null {
  const resolved = typeof workspaceId === "function" ? workspaceId() : workspaceId;
  return toOptionalWorkspaceId(resolved);
}

function normalizeScopes(
  scopes: RuntimeUpdatedEventSubscriptionOptions["scopes"]
): ReadonlySet<string> {
  return new Set((scopes ?? []).map((scope) => scope.trim()).filter((scope) => scope.length > 0));
}

function notifyRuntimeUpdatedListener(
  listener: (event: RuntimeUpdatedEvent) => void,
  event: RuntimeUpdatedEvent
): void {
  try {
    listener(event);
  } catch (error) {
    logger.error("[RuntimeUpdatedStore] listener failed", error);
  }
}

function notifySnapshotListener(listener: () => void): void {
  try {
    listener();
  } catch (error) {
    logger.error("[RuntimeUpdatedStore] snapshot listener failed", error);
  }
}

export function createRuntimeUpdatedStore(subscribeToAppServerEvents: AppServerEventSubscriber) {
  const runtimeUpdatedListeners = new Set<(event: RuntimeUpdatedEvent) => void>();
  const snapshotListeners = new Set<() => void>();
  let runtimeUpdatedUnsubscribe: Unsubscribe | null = null;
  let snapshot: RuntimeUpdatedStoreSnapshot = {
    revision: 0,
    lastEvent: null,
  };

  function publish(event: RuntimeUpdatedEvent): void {
    snapshot = {
      revision: snapshot.revision + 1,
      lastEvent: event,
    };
    for (const listener of runtimeUpdatedListeners) {
      notifyRuntimeUpdatedListener(listener, event);
    }
    for (const listener of snapshotListeners) {
      notifySnapshotListener(listener);
    }
  }

  function ensureRuntimeUpdatedStream(): void {
    if (runtimeUpdatedUnsubscribe || runtimeUpdatedListeners.size + snapshotListeners.size === 0) {
      return;
    }
    runtimeUpdatedUnsubscribe = subscribeToAppServerEvents((event) => {
      const parsed = parseRuntimeUpdatedEvent(event);
      if (!parsed) {
        return;
      }
      publish(parsed);
    });
  }

  function maybeStopRuntimeUpdatedStream(): void {
    if (runtimeUpdatedListeners.size + snapshotListeners.size > 0 || !runtimeUpdatedUnsubscribe) {
      return;
    }
    runtimeUpdatedUnsubscribe();
    runtimeUpdatedUnsubscribe = null;
  }

  function subscribeRuntimeUpdatedEvents(
    listener: (event: RuntimeUpdatedEvent) => void
  ): Unsubscribe {
    runtimeUpdatedListeners.add(listener);
    ensureRuntimeUpdatedStream();
    return () => {
      runtimeUpdatedListeners.delete(listener);
      maybeStopRuntimeUpdatedStream();
    };
  }

  function subscribeScopedRuntimeUpdatedEvents(
    options: RuntimeUpdatedEventSubscriptionOptions,
    listener: (event: RuntimeUpdatedEvent) => void
  ): Unsubscribe {
    const scopes = normalizeScopes(options.scopes);
    return subscribeRuntimeUpdatedEvents((event) => {
      const workspaceId = resolveSubscriptionWorkspaceId(options.workspaceId);
      if (workspaceId && !runtimeUpdatedEventMatchesWorkspace(event, workspaceId)) {
        return;
      }
      if (scopes.size > 0 && !event.scope.some((scope) => scopes.has(scope))) {
        return;
      }
      listener(event);
    });
  }

  function subscribeSnapshot(listener: () => void): Unsubscribe {
    snapshotListeners.add(listener);
    ensureRuntimeUpdatedStream();
    return () => {
      snapshotListeners.delete(listener);
      maybeStopRuntimeUpdatedStream();
    };
  }

  function getSnapshot(): RuntimeUpdatedStoreSnapshot {
    return snapshot;
  }

  return {
    getSnapshot,
    subscribeSnapshot,
    subscribeRuntimeUpdatedEvents,
    subscribeScopedRuntimeUpdatedEvents,
  };
}

export { parseRuntimeUpdatedEvent, runtimeUpdatedEventMatchesWorkspace, type RuntimeUpdatedEvent };
