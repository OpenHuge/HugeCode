import type {
  KernelProjectionBootstrapRequest,
  KernelProjectionBootstrapResponse,
  KernelProjectionDelta,
  KernelProjectionScope,
  KernelProjectionSubscriptionRequest,
} from "@ku0/code-runtime-host-contract";
import { safeParseJson, resolveWebTransportEndpointHints } from "./eventsWebTransportHelpers";
import { getRuntimeClient } from "./runtimeClient";
import { subscribeScopedRuntimeUpdatedEvents } from "./runtimeUpdatedEvents";

type UnknownRecord = Record<string, unknown>;

const DEFAULT_KERNEL_PROJECTION_SCOPES: KernelProjectionScope[] = [
  "mission_control",
  "jobs",
  "sessions",
  "capabilities",
  "extensions",
  "continuity",
  "diagnostics",
];

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeKernelProjectionScopes(
  scopes?: readonly KernelProjectionScope[] | null
): KernelProjectionScope[] {
  if (!scopes || scopes.length === 0) {
    return [...DEFAULT_KERNEL_PROJECTION_SCOPES];
  }
  return [...new Set(scopes)];
}

function buildKernelProjectionResyncDelta(
  scopes: readonly KernelProjectionScope[],
  reason: string
): KernelProjectionDelta {
  return {
    revision: 0,
    scopes: [...scopes],
    ops: scopes.map((scope) => ({
      type: "resync_required",
      scope,
      reason,
    })),
  };
}

function parseKernelProjectionDelta(payload: unknown): KernelProjectionDelta | null {
  const record = isRecord(payload) ? payload : null;
  if (!record) {
    return null;
  }
  const deltaCandidate =
    record.type === "kernel.projection.delta" && isRecord(record.delta)
      ? record.delta
      : record.type === "kernel.projection.delta"
        ? record
        : null;
  if (!deltaCandidate) {
    return null;
  }
  const revision =
    typeof deltaCandidate.revision === "number" && Number.isFinite(deltaCandidate.revision)
      ? deltaCandidate.revision
      : 0;
  const scopes = Array.isArray(deltaCandidate.scopes)
    ? deltaCandidate.scopes.filter(
        (scope): scope is KernelProjectionScope => typeof scope === "string" && scope.length > 0
      )
    : [];
  const ops = Array.isArray(deltaCandidate.ops)
    ? deltaCandidate.ops.filter((op): op is KernelProjectionDelta["ops"][number] => isRecord(op))
    : [];
  if (ops.length === 0) {
    return null;
  }
  return {
    revision,
    scopes,
    ops: ops.map((op) => ({
      type:
        op.type === "replace" ||
        op.type === "upsert" ||
        op.type === "remove" ||
        op.type === "patch" ||
        op.type === "resync_required"
          ? op.type
          : "resync_required",
      scope: typeof op.scope === "string" ? (op.scope as KernelProjectionScope) : "mission_control",
      key: typeof op.key === "string" ? op.key : null,
      value: op.value,
      patch: isRecord(op.patch) ? op.patch : null,
      revision: typeof op.revision === "number" ? op.revision : null,
      reason: typeof op.reason === "string" ? op.reason : null,
    })),
  };
}

export async function bootstrapRuntimeKernelProjection(
  request?: KernelProjectionBootstrapRequest
): Promise<KernelProjectionBootstrapResponse> {
  return getRuntimeClient().kernelProjectionBootstrapV3({
    scopes: normalizeKernelProjectionScopes(request?.scopes),
  });
}

export function subscribeRuntimeKernelProjection(
  request: KernelProjectionSubscriptionRequest,
  listener: (delta: KernelProjectionDelta) => void
): () => void {
  const scopes = normalizeKernelProjectionScopes(request.scopes);
  let disposed = false;
  let socket: WebSocket | null = null;
  let fallbackUnsubscribe: (() => void) | null = null;
  let fallbackActivated = false;

  const teardownSocket = () => {
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      socket.close();
    } catch {
      // Ignore close failures during teardown.
    }
    socket = null;
  };

  const activateFallback = (reason: string) => {
    if (disposed || fallbackActivated) {
      return;
    }
    fallbackActivated = true;
    teardownSocket();
    listener(buildKernelProjectionResyncDelta(scopes, reason));
    fallbackUnsubscribe = subscribeScopedRuntimeUpdatedEvents(
      {
        scopes: ["bootstrap", "workspaces", "agents", "providers", "oauth", "server"],
      },
      () => {
        listener(buildKernelProjectionResyncDelta(scopes, reason));
      }
    );
  };

  void (async () => {
    try {
      const hints = await resolveWebTransportEndpointHints();
      if (disposed) {
        return;
      }
      if (!hints.wsEndpoint || typeof WebSocket !== "function") {
        activateFallback("projection_ws_unavailable");
        return;
      }

      socket = new WebSocket(hints.wsEndpoint);
      socket.onopen = () => {
        if (!socket || disposed) {
          return;
        }
        socket.send(
          JSON.stringify({
            type: "kernel.projection.subscribe",
            id: `kernel-projection-${Date.now()}`,
            params: {
              scopes,
              lastRevision: request.lastRevision ?? null,
              subscriberConfig: request.subscriberConfig ?? null,
            },
          })
        );
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
          return;
        }
        const payload = safeParseJson(event.data);
        const delta = parseKernelProjectionDelta(payload);
        if (delta) {
          listener(delta);
        }
      };
      socket.onerror = () => {
        activateFallback("projection_ws_error");
      };
      socket.onclose = () => {
        activateFallback("projection_ws_closed");
      };
    } catch {
      activateFallback("projection_ws_error");
    }
  })();

  return () => {
    disposed = true;
    teardownSocket();
    fallbackUnsubscribe?.();
    fallbackUnsubscribe = null;
  };
}
