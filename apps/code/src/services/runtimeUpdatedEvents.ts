import type { AppServerEvent } from "../types";
import { subscribeAppServerEvents, type Unsubscribe } from "./events";
import { logger } from "./logger";
import {
  parseRuntimeUpdatedEvent,
  runtimeUpdatedEventMatchesWorkspace,
  toOptionalWorkspaceId,
  type RuntimeUpdatedEvent,
} from "../utils/runtimeUpdatedEvent";

export type RuntimeUpdatedEventSubscriptionOptions = {
  workspaceId?: string | null | (() => string | null);
  scopes?: readonly string[];
};

type AppServerEventSubscriber = (listener: (event: AppServerEvent) => void) => Unsubscribe;

function resolveSubscriptionWorkspaceId(
  workspaceId: RuntimeUpdatedEventSubscriptionOptions["workspaceId"]
): string | null {
  const resolved = typeof workspaceId === "function" ? workspaceId() : workspaceId;
  return toOptionalWorkspaceId(resolved);
}

export function createRuntimeUpdatedSubscriptions(
  subscribeToAppServerEvents: AppServerEventSubscriber
) {
  const runtimeUpdatedListeners = new Set<(event: RuntimeUpdatedEvent) => void>();
  let runtimeUpdatedUnsubscribe: Unsubscribe | null = null;

  function ensureRuntimeUpdatedStream(): void {
    if (runtimeUpdatedUnsubscribe || runtimeUpdatedListeners.size === 0) {
      return;
    }
    runtimeUpdatedUnsubscribe = subscribeToAppServerEvents((event) => {
      const parsed = parseRuntimeUpdatedEvent(event);
      if (!parsed) {
        return;
      }
      for (const listener of runtimeUpdatedListeners) {
        try {
          listener(parsed);
        } catch (error) {
          logger.error("[runtimeUpdatedEvents] listener failed", error);
        }
      }
    });
  }

  function maybeStopRuntimeUpdatedStream(): void {
    if (runtimeUpdatedListeners.size > 0 || !runtimeUpdatedUnsubscribe) {
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
    const scopes = new Set(
      (options.scopes ?? []).map((scope) => scope.trim()).filter((scope) => scope.length > 0)
    );
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

  return {
    subscribeRuntimeUpdatedEvents,
    subscribeScopedRuntimeUpdatedEvents,
  };
}

const runtimeUpdatedSubscriptions = createRuntimeUpdatedSubscriptions(subscribeAppServerEvents);

export const subscribeRuntimeUpdatedEvents =
  runtimeUpdatedSubscriptions.subscribeRuntimeUpdatedEvents;

export const subscribeScopedRuntimeUpdatedEvents =
  runtimeUpdatedSubscriptions.subscribeScopedRuntimeUpdatedEvents;

export { parseRuntimeUpdatedEvent, runtimeUpdatedEventMatchesWorkspace, type RuntimeUpdatedEvent };
