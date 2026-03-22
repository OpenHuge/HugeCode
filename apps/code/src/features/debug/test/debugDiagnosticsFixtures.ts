import type { RuntimeEventChannelDiagnostics } from "../../../application/runtime/ports/runtimeEventChannelDiagnostics";
import type { DebugEntry } from "../../../types";
import type { FormattedDebugEntry } from "../components/DebugEntriesList";
import type {
  AgentTaskDurabilityDiagnostics,
  DistributedDiagnostics,
} from "../utils/debugEntryDiagnostics";

export function createDistributedDiagnostics(
  overrides: Partial<DistributedDiagnostics> = {}
): DistributedDiagnostics {
  return {
    backendsTotal: 4,
    backendsHealthy: 3,
    backendsDraining: 1,
    placementFailuresTotal: 2,
    queueDepth: 9,
    snapshotAgeMs: 12,
    stateFabricFanoutQueueDepth: 1,
    threadLiveUpdateFanoutQueueDepth: 2,
    stateFabricFanoutCoalescedTotal: 3,
    threadLiveUpdateFanoutCoalescedTotal: 5,
    accessMode: "on-request",
    routedProvider: "openai",
    executionMode: "runtime",
    reason: "policy_rejected_local_access",
    ...overrides,
  };
}

export function createAgentTaskDurabilityDiagnostics(
  overrides: Partial<AgentTaskDurabilityDiagnostics> = {}
): AgentTaskDurabilityDiagnostics {
  return {
    reason: "agent_task_durability_degraded",
    revision: "durability-rev-1",
    occurrencesInWindow: 2,
    firstSeenAt: 1_771_331_656_000,
    lastSeenAt: 1_771_331_696_000,
    mode: "active",
    degraded: true,
    checkpointWriteTotal: 42,
    checkpointWriteFailedTotal: 6,
    agentTaskCheckpointRecoverTotal: 4,
    subagentCheckpointRecoverTotal: 2,
    runtimeRecoveryInterruptTotal: 1,
    agentTaskResumeTotal: 9,
    agentTaskResumeFailedTotal: 3,
    ...overrides,
  };
}

export function createRuntimeEventChannelDiagnostic(
  overrides: Partial<RuntimeEventChannelDiagnostics> = {}
): RuntimeEventChannelDiagnostics {
  return {
    id: "channel-1",
    label: "runtime bridge",
    transport: "bridge",
    status: "open",
    retryAttempt: 2,
    retryDelayMs: 250,
    lastError: null,
    fallbackSinceMs: null,
    consecutiveFailures: 1,
    lastTransitionReason: "recovered",
    updatedAt: 1_771_331_696_000,
    ...overrides,
  };
}

export function createRuntimeEventChannelDiagnostics(): RuntimeEventChannelDiagnostics[] {
  return [
    createRuntimeEventChannelDiagnostic(),
    createRuntimeEventChannelDiagnostic({
      id: "channel-2",
      label: "server events",
      transport: "sse",
      status: "fallback",
      retryAttempt: 4,
      retryDelayMs: 1_000,
      lastError: "connection lost",
      fallbackSinceMs: 1_771_331_600_000,
      consecutiveFailures: 3,
      lastTransitionReason: "network",
      updatedAt: 1_771_331_697_000,
    }),
  ];
}

export function createFormattedDebugEntries(): FormattedDebugEntry[] {
  return [
    {
      id: "entry-1",
      timestamp: 1_771_331_696_000,
      source: "event",
      label: "runtime.updated",
      payload: { ok: true },
      timeLabel: "10:00:00",
      payloadText: '{"ok":true}',
    },
  ];
}

export function createDistributedDiagnosticsEntry(overrides: Partial<DebugEntry> = {}): DebugEntry {
  return {
    id: "distributed-1",
    timestamp: 1_771_331_696_000,
    source: "event",
    label: "runtime.updated",
    payload: {
      message: {
        method: "runtime/updated",
        params: {
          backendsTotal: 4,
          backendsHealthy: 3,
          observability: {
            snapshotAgeMs: 12,
            stateFabricFanoutQueueDepth: 1,
            threadLiveUpdateFanoutQueueDepth: 2,
            stateFabricFanoutCoalescedTotal: 3,
            threadLiveUpdateFanoutCoalescedTotal: 5,
          },
          executionMode: "runtime",
          diagnosticReason: "policy_rejected_local_access",
        },
      },
    },
    ...overrides,
  };
}

export function createDurabilityDiagnosticsEntry(overrides: Partial<DebugEntry> = {}): DebugEntry {
  return {
    id: "durability-1",
    timestamp: 1_771_331_696_000,
    source: "server",
    label: "runtime/updated warning durability degraded",
    payload: {
      reason: "agent_task_durability_degraded",
      revision: "durability-rev-1",
      mode: "active",
      degraded: true,
      checkpointWriteTotal: 42,
      checkpointWriteFailedTotal: 6,
    },
    ...overrides,
  };
}

export function createDebugDiagnosticsEntries(): DebugEntry[] {
  return [createDistributedDiagnosticsEntry(), createDurabilityDiagnosticsEntry()];
}
