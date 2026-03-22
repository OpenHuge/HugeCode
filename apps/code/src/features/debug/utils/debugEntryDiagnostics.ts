import type { DebugEntry } from "../../../types";
import { normalizeRuntimeExecutionMode } from "../../../utils/runtimeExecutionMode";
import {
  parseRuntimeDurabilityDiagnostics,
  RUNTIME_DURABILITY_WINDOW_MS,
  serializeRuntimeDurabilityEventKey,
} from "../../../utils/runtimeUpdatedDurability";

export type DistributedDiagnostics = {
  backendsTotal: number | null;
  backendsHealthy: number | null;
  backendsDraining: number | null;
  placementFailuresTotal: number | null;
  queueDepth: number | null;
  snapshotAgeMs: number | null;
  stateFabricFanoutQueueDepth: number | null;
  threadLiveUpdateFanoutQueueDepth: number | null;
  stateFabricFanoutCoalescedTotal: number | null;
  threadLiveUpdateFanoutCoalescedTotal: number | null;
  accessMode: string | null;
  routedProvider: string | null;
  executionMode: "runtime" | "local-cli" | "hybrid" | null;
  reason: string | null;
};

export type AgentTaskDurabilityDiagnostics = {
  reason: string;
  revision: string | null;
  occurrencesInWindow: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  mode: string | null;
  degraded: boolean | null;
  checkpointWriteTotal: number | null;
  checkpointWriteFailedTotal: number | null;
  agentTaskCheckpointRecoverTotal: number | null;
  subagentCheckpointRecoverTotal: number | null;
  runtimeRecoveryInterruptTotal: number | null;
  agentTaskResumeTotal: number | null;
  agentTaskResumeFailedTotal: number | null;
};

type DurabilitySnapshot = {
  diagnostics: NonNullable<ReturnType<typeof parseRuntimeDurabilityDiagnostics>>;
  seenAt: number;
};

type DebugEntryDiagnosticsSnapshot = {
  distributedDiagnostics: DistributedDiagnostics | null;
  agentTaskDurabilityDiagnostics: AgentTaskDurabilityDiagnostics | null;
  hasRemoteExecutionDiagnostics: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readMetric(record: Record<string, unknown>, fields: string[]): number | null {
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readText(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}

function readExecutionMode(
  record: Record<string, unknown>,
  fields: string[]
): "runtime" | "local-cli" | "hybrid" | null {
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === "string") {
      const normalized = normalizeRuntimeExecutionMode(raw);
      if (normalized) {
        return normalized;
      }
    }
  }
  return null;
}

function collectDiagnosticCandidates(
  payloadRecord: Record<string, unknown>
): Record<string, unknown>[] {
  const messageRecord = asRecord(payloadRecord.message);
  const eventRecord = asRecord(payloadRecord.event);
  const candidates = [
    payloadRecord,
    asRecord(payloadRecord.params),
    asRecord(payloadRecord.payload),
    asRecord(payloadRecord.metrics),
    asRecord(payloadRecord.diagnostics),
    asRecord(payloadRecord.observability),
    messageRecord,
    asRecord(messageRecord?.params),
    asRecord(messageRecord?.payload),
    asRecord(asRecord(messageRecord?.params)?.observability),
    asRecord(asRecord(messageRecord?.payload)?.observability),
    eventRecord,
    asRecord(eventRecord?.payload),
    asRecord(asRecord(eventRecord?.payload)?.observability),
  ].filter((entry): entry is Record<string, unknown> => Boolean(entry));

  const uniqueCandidates: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    uniqueCandidates.push(candidate);
  }
  return uniqueCandidates;
}

function extractDistributedDiagnosticsFromCandidates(
  candidates: Record<string, unknown>[]
): DistributedDiagnostics | null {
  const diagnostics: DistributedDiagnostics = {
    backendsTotal: null,
    backendsHealthy: null,
    backendsDraining: null,
    placementFailuresTotal: null,
    queueDepth: null,
    snapshotAgeMs: null,
    stateFabricFanoutQueueDepth: null,
    threadLiveUpdateFanoutQueueDepth: null,
    stateFabricFanoutCoalescedTotal: null,
    threadLiveUpdateFanoutCoalescedTotal: null,
    accessMode: null,
    routedProvider: null,
    executionMode: null,
    reason: null,
  };
  let foundDiagnostics = false;

  for (const candidate of candidates) {
    if (parseRuntimeDurabilityDiagnostics(candidate)) {
      continue;
    }

    diagnostics.backendsTotal ??= readMetric(candidate, ["backendsTotal", "backends_total"]);
    diagnostics.backendsHealthy ??= readMetric(candidate, ["backendsHealthy", "backends_healthy"]);
    diagnostics.backendsDraining ??= readMetric(candidate, [
      "backendsDraining",
      "backends_draining",
    ]);
    diagnostics.placementFailuresTotal ??= readMetric(candidate, [
      "placementFailuresTotal",
      "placement_failures_total",
    ]);
    diagnostics.queueDepth ??= readMetric(candidate, ["queueDepth", "queue_depth"]);
    diagnostics.snapshotAgeMs ??= readMetric(candidate, ["snapshotAgeMs", "snapshot_age_ms"]);
    diagnostics.stateFabricFanoutQueueDepth ??= readMetric(candidate, [
      "stateFabricFanoutQueueDepth",
      "state_fabric_fanout_queue_depth",
    ]);
    diagnostics.threadLiveUpdateFanoutQueueDepth ??= readMetric(candidate, [
      "threadLiveUpdateFanoutQueueDepth",
      "thread_live_update_fanout_queue_depth",
    ]);
    diagnostics.stateFabricFanoutCoalescedTotal ??= readMetric(candidate, [
      "stateFabricFanoutCoalescedTotal",
      "state_fabric_fanout_coalesced_total",
    ]);
    diagnostics.threadLiveUpdateFanoutCoalescedTotal ??= readMetric(candidate, [
      "threadLiveUpdateFanoutCoalescedTotal",
      "thread_live_update_fanout_coalesced_total",
    ]);
    diagnostics.accessMode ??= readText(candidate, ["accessMode", "access_mode"]);
    diagnostics.routedProvider ??= readText(candidate, ["routedProvider", "routed_provider"]);
    diagnostics.executionMode ??= readExecutionMode(candidate, ["executionMode", "execution_mode"]);
    diagnostics.reason ??= readText(candidate, ["reason", "diagnosticReason", "diagnostic_reason"]);

    if (
      diagnostics.backendsTotal === null &&
      diagnostics.backendsHealthy === null &&
      diagnostics.backendsDraining === null &&
      diagnostics.placementFailuresTotal === null &&
      diagnostics.queueDepth === null &&
      diagnostics.snapshotAgeMs === null &&
      diagnostics.stateFabricFanoutQueueDepth === null &&
      diagnostics.threadLiveUpdateFanoutQueueDepth === null &&
      diagnostics.stateFabricFanoutCoalescedTotal === null &&
      diagnostics.threadLiveUpdateFanoutCoalescedTotal === null &&
      diagnostics.accessMode === null &&
      diagnostics.routedProvider === null &&
      diagnostics.executionMode === null &&
      diagnostics.reason === null
    ) {
      continue;
    }
    foundDiagnostics = true;
  }

  return foundDiagnostics ? diagnostics : null;
}

function extractLatestDurabilitySnapshot(entries: DebugEntry[]): DurabilitySnapshot | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const payloadRecord = asRecord(entry?.payload);
    if (!payloadRecord) {
      continue;
    }
    const candidates = collectDiagnosticCandidates(payloadRecord);

    for (const candidate of candidates) {
      const diagnostics = parseRuntimeDurabilityDiagnostics(candidate);
      if (!diagnostics) {
        continue;
      }
      return {
        diagnostics,
        seenAt:
          typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
            ? entry.timestamp
            : Date.now(),
      };
    }
  }

  return null;
}

function finalizeDurabilitySnapshot(
  entries: DebugEntry[],
  latest: DurabilitySnapshot
): AgentTaskDurabilityDiagnostics {
  const latestDiagnostics = latest.diagnostics;
  const dedupeKey = serializeRuntimeDurabilityEventKey(
    {
      revision: latestDiagnostics.revision,
      workspaceId: latestDiagnostics.workspaceId,
      reason: latestDiagnostics.reason,
    },
    latestDiagnostics.updatedAt ?? latest.seenAt
  );
  const windowStart = latest.seenAt - RUNTIME_DURABILITY_WINDOW_MS;
  let occurrencesInWindow = 0;
  let firstSeenAt = latest.seenAt;
  let lastSeenAt = latest.seenAt;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const payloadRecord = asRecord(entry?.payload);
    if (!payloadRecord) {
      continue;
    }
    const seenAt =
      typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
        ? entry.timestamp
        : null;
    if (seenAt === null || seenAt < windowStart || seenAt > latest.seenAt) {
      continue;
    }
    const candidates = collectDiagnosticCandidates(payloadRecord);
    for (const candidate of candidates) {
      const diagnostics = parseRuntimeDurabilityDiagnostics(candidate);
      if (!diagnostics) {
        continue;
      }
      const candidateKey = serializeRuntimeDurabilityEventKey(
        {
          revision: diagnostics.revision,
          workspaceId: diagnostics.workspaceId,
          reason: diagnostics.reason,
        },
        diagnostics.updatedAt ?? seenAt
      );
      if (candidateKey !== dedupeKey) {
        continue;
      }
      occurrencesInWindow += 1;
      firstSeenAt = Math.min(firstSeenAt, seenAt);
      lastSeenAt = Math.max(lastSeenAt, seenAt);
      break;
    }
  }

  return {
    reason: latestDiagnostics.reason,
    revision: latestDiagnostics.revision,
    occurrencesInWindow,
    firstSeenAt,
    lastSeenAt,
    mode: latestDiagnostics.mode,
    degraded: latestDiagnostics.degraded,
    checkpointWriteTotal: latestDiagnostics.checkpointWriteTotal,
    checkpointWriteFailedTotal: latestDiagnostics.checkpointWriteFailedTotal,
    agentTaskCheckpointRecoverTotal: latestDiagnostics.agentTaskCheckpointRecoverTotal,
    subagentCheckpointRecoverTotal: latestDiagnostics.subagentCheckpointRecoverTotal,
    runtimeRecoveryInterruptTotal: latestDiagnostics.runtimeRecoveryInterruptTotal,
    agentTaskResumeTotal: latestDiagnostics.agentTaskResumeTotal,
    agentTaskResumeFailedTotal: latestDiagnostics.agentTaskResumeFailedTotal,
  };
}

export function collectDebugEntryDiagnostics(
  entries: DebugEntry[],
  options?: {
    includeDistributedDiagnostics?: boolean;
  }
): DebugEntryDiagnosticsSnapshot {
  const includeDistributedDiagnostics = options?.includeDistributedDiagnostics ?? true;

  let distributedDiagnostics: DistributedDiagnostics | null = null;
  let latestDurability: DurabilitySnapshot | null = null;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const payloadRecord = asRecord(entry?.payload);
    if (!payloadRecord) {
      continue;
    }
    const candidates = collectDiagnosticCandidates(payloadRecord);

    if (!distributedDiagnostics && includeDistributedDiagnostics) {
      distributedDiagnostics = extractDistributedDiagnosticsFromCandidates(candidates);
    }

    if (!latestDurability) {
      for (const candidate of candidates) {
        const diagnostics = parseRuntimeDurabilityDiagnostics(candidate);
        if (!diagnostics) {
          continue;
        }
        latestDurability = {
          diagnostics,
          seenAt:
            typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
              ? entry.timestamp
              : Date.now(),
        };
        break;
      }
    }

    if (latestDurability && (distributedDiagnostics || !includeDistributedDiagnostics)) {
      break;
    }
  }

  const agentTaskDurabilityDiagnostics = latestDurability
    ? finalizeDurabilitySnapshot(entries, latestDurability)
    : null;
  const hasRemoteExecutionDiagnostics =
    (distributedDiagnostics?.accessMode ?? null) !== null ||
    (distributedDiagnostics?.routedProvider ?? null) !== null ||
    (distributedDiagnostics?.executionMode ?? null) !== null ||
    (distributedDiagnostics?.reason ?? null) !== null;

  return {
    distributedDiagnostics,
    agentTaskDurabilityDiagnostics,
    hasRemoteExecutionDiagnostics,
  };
}

export function formatExecutionMode(value: "runtime" | "local-cli" | "hybrid" | null): string {
  if (value === null) {
    return "-";
  }
  return value;
}

export function formatDiagnosticsTimestamp(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "-";
  }
  return new Date(value).toLocaleTimeString();
}

export { extractLatestDurabilitySnapshot };
