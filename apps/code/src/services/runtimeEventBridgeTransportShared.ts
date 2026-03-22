import { listen } from "@tauri-apps/api/event";
import type { AppServerEvent } from "../types";
import {
  createEventIdDeduper,
  parseWebRuntimeReplayEventId,
  parseWebRuntimeSseEventId,
  safeParseJson,
  withLastEventIdQuery,
} from "./eventsWebTransportHelpers";
import { normalizeAppServerPayload } from "./eventsRuntimePayloadAdapter";
import { recordRuntimeEventDedupeHit } from "./runtimeEventStabilityMetrics";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../utils/runtimeWorkspaceIds";

export type Unsubscribe = () => void;

export type Listener<T> = (payload: T) => void;

export type RuntimeEventReplayCursor = {
  lastEventId: number | null;
};

export const RUNTIME_HOST_EVENT_NAME = "fastcode://runtime/event";
export const WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS = 400;
export const WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS = 10_000;
export const WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS = 5_000;
export const WEB_RUNTIME_WS_FALLBACK_PROBE_MS = 10_000;
export const APP_SERVER_BRIDGE_CHANNEL_ID = "app-server-bridge";
export const APP_SERVER_WS_CHANNEL_ID = "app-server-events";
export const RUNTIME_RESYNC_SCOPE = [
  "bootstrap",
  "workspaces",
  "threads",
  "agents",
  "models",
  "oauth",
  "prompts",
] as const;

export function createCompositeUnsubscribe(unsubscribers: Unsubscribe[]): Unsubscribe {
  return () => {
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Ignore double-unsubscribe calls when tearing down.
      }
    }
  };
}

export async function registerRuntimeEventTauriSubscription(
  eventName: string,
  onPayload: (payload: unknown) => void,
  onError: (error: unknown) => void
): Promise<Unsubscribe | null> {
  try {
    return await listen<unknown>(eventName, (event) => {
      onPayload(event.payload);
    });
  } catch (error) {
    onError(error);
    return null;
  }
}

export function subscribeWebRuntimeSseEventsShared(
  endpoint: string,
  onEvent: Listener<AppServerEvent>,
  onError: (error: unknown) => void,
  replayCursor?: RuntimeEventReplayCursor
): Unsubscribe | null {
  if (typeof EventSource !== "function") {
    return null;
  }

  try {
    const source = new EventSource(
      replayCursor?.lastEventId
        ? withLastEventIdQuery(endpoint, replayCursor.lastEventId)
        : endpoint
    );
    const dedupe = createEventIdDeduper();
    let errorReported = false;

    source.onmessage = (messageEvent) => {
      const parsed = safeParseJson(messageEvent.data);
      if (!parsed) {
        return;
      }
      const eventId = parseWebRuntimeSseEventId(messageEvent, parsed);
      const replayEventId = parseWebRuntimeReplayEventId(eventId);
      if (replayEventId !== null && replayCursor) {
        replayCursor.lastEventId = replayEventId;
      }
      if (dedupe.isDuplicate(eventId)) {
        recordRuntimeEventDedupeHit();
        return;
      }
      const normalized = normalizeAppServerPayload(parsed);
      if (normalized) {
        onEvent(normalized);
      }
    };

    source.onerror = (error) => {
      if (errorReported) {
        return;
      }
      errorReported = true;
      onError(error);
    };

    return () => {
      source.close();
    };
  } catch (error) {
    onError(error);
    return null;
  }
}

export function createRuntimeReconnectSignalEvent(now = Date.now()): AppServerEvent {
  return {
    workspace_id: DEFAULT_RUNTIME_WORKSPACE_ID,
    message: {
      method: "native_state_fabric_updated",
      params: {
        revision: `stream-reconnect-${now}`,
        scope: RUNTIME_RESYNC_SCOPE,
        reason: "stream_reconnected",
      },
    },
  };
}
