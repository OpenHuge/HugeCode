import {
  resolveWebTransportEndpointHints as resolveSharedWebTransportEndpointHints,
  type WebTransportEndpointHints,
  withLastEventIdQuery,
} from "./runtimeWebTransportHints";

const WEB_RUNTIME_EVENT_ID_DEDUPE_WINDOW = 2_048;
const WEB_RUNTIME_TRANSPORT_HINTS_CACHE_TTL_MS = 5 * 60 * 1000;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRecordField(record: UnknownRecord, field: string): UnknownRecord | null {
  const value = record[field];
  return isRecord(value) ? value : null;
}

function readFieldString(record: UnknownRecord, fields: string[]): string | null {
  for (const field of fields) {
    const value = readNonEmptyString(record[field]);
    if (value) {
      return value;
    }
  }
  return null;
}

export async function resolveWebTransportEndpointHints(): Promise<WebTransportEndpointHints> {
  return resolveSharedWebTransportEndpointHints({
    cacheTtlMs: WEB_RUNTIME_TRANSPORT_HINTS_CACHE_TTL_MS,
  });
}

export function safeParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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

export function createEventIdDeduper(maxEntries = WEB_RUNTIME_EVENT_ID_DEDUPE_WINDOW) {
  const seenIds = new Set<string>();
  const queue: string[] = [];

  return {
    isDuplicate(rawEventId: string | null): boolean {
      if (!rawEventId) {
        return false;
      }
      const eventId = rawEventId.trim();
      if (!eventId) {
        return false;
      }
      if (seenIds.has(eventId)) {
        return true;
      }
      seenIds.add(eventId);
      queue.push(eventId);
      if (queue.length > maxEntries) {
        const oldest = queue.shift();
        if (oldest) {
          seenIds.delete(oldest);
        }
      }
      return false;
    },
  };
}

export function parseWebRuntimeSseEventId(
  messageEvent: MessageEvent<string>,
  payload: unknown
): string | null {
  const eventWithId = messageEvent as MessageEvent<string> & { lastEventId?: unknown };
  const explicitId = readNonEmptyString(eventWithId.lastEventId);
  if (explicitId) {
    return explicitId;
  }
  if (!isRecord(payload)) {
    return null;
  }
  return (
    readFieldString(payload, ["eventId", "event_id"]) ??
    readFieldString(readRecordField(payload, "event") ?? {}, ["eventId", "event_id"])
  );
}

export function parseWebRuntimeReplayEventId(eventId: string | null): number | null {
  return readPositiveInteger(eventId);
}

export function parseWebRuntimeWsEventId(payload: unknown): number | null {
  if (!isRecord(payload)) {
    return null;
  }
  if (payload.type !== "runtime.event") {
    return null;
  }
  return readPositiveInteger(payload.eventId ?? payload.event_id);
}

export function parseWebRuntimeWsEventIdentifier(payload: unknown): string | null {
  if (!isRecord(payload) || payload.type !== "runtime.event") {
    return null;
  }
  const numericId = readPositiveInteger(payload.eventId ?? payload.event_id);
  if (numericId !== null) {
    return String(numericId);
  }
  return readFieldString(payload, ["id"]);
}

export type { WebTransportEndpointHints };
export { withLastEventIdQuery };
