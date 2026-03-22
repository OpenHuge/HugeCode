import {
  normalizeRuntimeEventChannelError,
  type RuntimeEventChannelDiagnostics,
  type RuntimeEventChannelStatus,
  type RuntimeEventChannelTransport,
  readRuntimeEventChannelDiagnostics,
  subscribeRuntimeEventChannelDiagnostics,
  updateRuntimeEventChannelDiagnostics,
} from "./runtimeEventChannelDiagnostics";
import {
  recordRuntimeEventFallbackEntered,
  recordRuntimeEventFallbackRecovered,
  recordRuntimeEventReconnectAttempt,
  recordRuntimeEventReconnectSuccess,
} from "./runtimeEventStabilityMetrics";
import type { AgentEnvelopeMetadata } from "./runtimeMessageEnvelope";

export type RuntimeEventStateTransition = {
  previous: RuntimeEventChannelDiagnostics | null;
  current: RuntimeEventChannelDiagnostics;
};

type RuntimeEventStateTransitionListener = (transition: RuntimeEventStateTransition) => void;

function readDiagnosticsById(id: string): RuntimeEventChannelDiagnostics | null {
  return readRuntimeEventChannelDiagnostics().find((entry) => entry.id === id) ?? null;
}

export function subscribeRuntimeEventStateChannel(
  id: string,
  listener: RuntimeEventStateTransitionListener
): () => void {
  let previous = readDiagnosticsById(id);
  return subscribeRuntimeEventChannelDiagnostics((channels) => {
    const current = channels.find((entry) => entry.id === id) ?? null;
    if (!current) {
      return;
    }
    if (
      previous &&
      previous.status === current.status &&
      previous.retryAttempt === current.retryAttempt &&
      previous.retryDelayMs === current.retryDelayMs &&
      previous.lastError === current.lastError &&
      previous.lastTransitionReason === current.lastTransitionReason
    ) {
      previous = current;
      return;
    }
    listener({ previous, current });
    previous = current;
  });
}

export type RuntimeEventStateMachine = {
  transition: (
    status: RuntimeEventChannelStatus,
    options?: {
      reason?: string | null;
      transport?: RuntimeEventChannelTransport;
      retryAttempt?: number;
      retryDelayMs?: number | null;
      lastError?: string | null;
      consecutiveFailures?: number;
    }
  ) => RuntimeEventChannelDiagnostics;
  setError: (error: unknown, reason?: string | null) => RuntimeEventChannelDiagnostics;
  recordAgentEnvelopeEvent: (metadata: AgentEnvelopeMetadata) => RuntimeEventChannelDiagnostics;
};

export function createRuntimeEventStateMachine(config: {
  id: string;
  label: string;
  defaultTransport: RuntimeEventChannelTransport;
}): RuntimeEventStateMachine {
  const { id, label, defaultTransport } = config;

  const transition: RuntimeEventStateMachine["transition"] = (status, options = {}) => {
    const previous = readDiagnosticsById(id);
    const reason = options.reason?.trim() || null;
    const next = updateRuntimeEventChannelDiagnostics(id, {
      label,
      transport: options.transport ?? previous?.transport ?? defaultTransport,
      status,
      retryAttempt: options.retryAttempt,
      retryDelayMs:
        options.retryDelayMs !== undefined
          ? options.retryDelayMs
          : status === "open"
            ? null
            : undefined,
      lastError:
        options.lastError !== undefined ? options.lastError : status === "open" ? null : undefined,
      consecutiveFailures: options.consecutiveFailures,
      lastTransitionReason: reason,
    });

    if (status === "fallback" && previous?.status !== "fallback") {
      recordRuntimeEventFallbackEntered(reason ?? id);
    }
    if (previous?.status === "fallback" && status !== "fallback") {
      const startedAtMs = previous.fallbackSinceMs ?? null;
      recordRuntimeEventFallbackRecovered(
        typeof startedAtMs === "number" ? Date.now() - startedAtMs : null
      );
    }
    if (status === "reconnecting" && previous?.status !== "reconnecting") {
      recordRuntimeEventReconnectAttempt();
    }
    if (status === "open" && previous?.status !== "open") {
      recordRuntimeEventReconnectSuccess();
    }

    return next;
  };

  const setError: RuntimeEventStateMachine["setError"] = (error, reason = null) =>
    transition("error", {
      reason,
      lastError: normalizeRuntimeEventChannelError(error),
    });

  const recordAgentEnvelopeEvent: RuntimeEventStateMachine["recordAgentEnvelopeEvent"] = (
    metadata
  ) =>
    transition("open", {
      reason: `agent-envelope:${metadata.eventType}`,
    });

  return {
    transition,
    setError,
    recordAgentEnvelopeEvent,
  };
}
