import {
  type CodeRuntimeHostEventEnvelope,
  parseCodeRuntimeHostEventEnvelope,
} from "@ku0/code-runtime-host-contract";
import {
  appendRuntimeAuthTokenQuery,
  resolveTransportEndpointFromPath,
  resolveWebRuntimeAuthToken,
  toWebSocketEndpoint,
  WEB_RUNTIME_AUTH_TOKEN_HEADER,
} from "./runtimeClientWebGateway";
import {
  getErrorMessage,
  isMissingTauriCommandError,
  isMissingTauriInvokeError,
  isMissingTextFileError,
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
} from "@ku0/code-runtime-client/runtimeErrorClassifier";
import {
  CODE_RUNTIME_RPC_CAPABILITIES_METHOD,
  deriveWebEventsEndpoint,
  deriveWebWsEndpoint,
  resolveWebTransportEndpointHints,
  type WebTransportEndpointHints,
  withLastEventIdQuery,
} from "./runtimeWebTransportHints";

const RUNTIME_TURN_EVENT_NAME = "fastcode://runtime/event";
const WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS = 400;
const WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS = 10_000;
const WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS = 5_000;
const WEB_RUNTIME_WS_FALLBACK_PROBE_MS = 10_000;
const RUNTIME_TURN_SSE_CHANNEL_ID = "runtime-turn-sse";
const RUNTIME_TURN_WS_CHANNEL_ID = "runtime-turn-ws";
const LOCAL_USAGE_CACHE_TTL_MS = 3_000;
const RUNTIME_RESYNC_SCOPE = [
  "bootstrap",
  "workspaces",
  "threads",
  "agents",
  "models",
  "oauth",
  "prompts",
] as const;

type LooseResultEnvelope = Record<string, unknown>;
type WebRuntimeTurnTransportHints = WebTransportEndpointHints;
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function resolveWebRuntimeTurnTransportHints(): Promise<WebRuntimeTurnTransportHints> {
  return resolveWebTransportEndpointHints({ cacheTtlMs: 0 });
}

function parseRuntimeTurnEventPayload(payload: unknown): CodeRuntimeHostEventEnvelope | null {
  const direct = parseCodeRuntimeHostEventEnvelope(payload);
  if (direct.ok) {
    return direct.value;
  }
  if (!isRecord(payload)) {
    return null;
  }
  const nestedEvent = parseCodeRuntimeHostEventEnvelope(payload.event);
  if (nestedEvent.ok) {
    return nestedEvent.value;
  }
  return null;
}

function parseRuntimeTurnEventMessage(data: unknown): CodeRuntimeHostEventEnvelope | null {
  if (typeof data === "string") {
    const normalized = data.trim();
    if (!normalized) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalized) as unknown;
      return parseRuntimeTurnEventPayload(parsed);
    } catch {
      return null;
    }
  }
  return parseRuntimeTurnEventPayload(data);
}

function readPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function parseRuntimeTurnWsEventId(data: unknown): number | null {
  let payload: unknown = data;
  if (typeof data === "string") {
    const normalized = data.trim();
    if (!normalized) {
      return null;
    }
    try {
      payload = JSON.parse(normalized);
    } catch {
      return null;
    }
  }

  if (!isRecord(payload)) {
    return null;
  }
  if (payload.type !== "runtime.event") {
    return null;
  }
  return readPositiveInteger(payload.eventId ?? payload.event_id);
}

export type { LooseResultEnvelope };
export {
  CODE_RUNTIME_RPC_CAPABILITIES_METHOD,
  LOCAL_USAGE_CACHE_TTL_MS,
  RUNTIME_RESYNC_SCOPE,
  RUNTIME_TURN_EVENT_NAME,
  RUNTIME_TURN_SSE_CHANNEL_ID,
  RUNTIME_TURN_WS_CHANNEL_ID,
  WEB_RUNTIME_AUTH_TOKEN_HEADER,
  WEB_RUNTIME_EVENTS_RECONNECT_BASE_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_MAX_MS,
  WEB_RUNTIME_EVENTS_RECONNECT_SIGNAL_THROTTLE_MS,
  WEB_RUNTIME_WS_FALLBACK_PROBE_MS,
  appendRuntimeAuthTokenQuery,
  deriveWebEventsEndpoint,
  deriveWebWsEndpoint,
  getErrorMessage,
  isMissingTauriCommandError,
  isMissingTauriInvokeError,
  isMissingTextFileError,
  isRuntimeMethodUnsupportedError,
  isWebRuntimeConnectionError,
  parseRuntimeTurnEventMessage,
  parseRuntimeTurnEventPayload,
  parseRuntimeTurnWsEventId,
  resolveTransportEndpointFromPath,
  resolveWebRuntimeAuthToken,
  resolveWebRuntimeTurnTransportHints,
  toWebSocketEndpoint,
  withLastEventIdQuery,
};
