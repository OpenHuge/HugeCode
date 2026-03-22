import { describe, expect, it } from "vitest";
import type { DebugEntry } from "../../../types";
import {
  collectDebugEntryDiagnostics,
  formatDiagnosticsTimestamp,
  formatExecutionMode,
} from "./debugEntryDiagnostics";

function createDistributedEntry(): DebugEntry {
  return {
    id: "distributed-1",
    timestamp: Date.now(),
    source: "event",
    label: "runtime.updated",
    payload: {
      message: {
        method: "runtime/updated",
        params: {
          backendsTotal: 4,
          backendsHealthy: 3,
          backendsDraining: 1,
          placementFailuresTotal: 2,
          queueDepth: 9,
          observability: {
            snapshotAgeMs: 12,
            stateFabricFanoutQueueDepth: 1,
            threadLiveUpdateFanoutQueueDepth: 2,
            stateFabricFanoutCoalescedTotal: 3,
            threadLiveUpdateFanoutCoalescedTotal: 5,
          },
          accessMode: "on-request",
          routedProvider: "openai",
          executionMode: "local_cli",
          diagnosticReason: "policy_rejected_local_access",
        },
      },
    },
  };
}

function createDurabilityEntries(): DebugEntry[] {
  const baseTimestamp = 1_771_331_696_000;
  return [
    {
      id: "durability-0",
      timestamp: baseTimestamp - 40_000,
      source: "server",
      label: "runtime/updated warning durability degraded",
      payload: {
        reason: "agent_task_durability_degraded",
        revision: "durability-rev-1",
        mode: "active",
        degraded: true,
        checkpointWriteTotal: 40,
        checkpointWriteFailedTotal: 5,
      },
    },
    {
      id: "durability-1",
      timestamp: baseTimestamp - 20_000,
      source: "server",
      label: "runtime/updated warning durability degraded",
      payload: {
        reason: "agent_task_durability_degraded",
        revision: "durability-rev-1",
        mode: "active",
        degraded: true,
        checkpointWriteTotal: 42,
        checkpointWriteFailedTotal: 6,
        agentTaskCheckpointRecoverTotal: 4,
        subagentCheckpointRecoverTotal: 2,
        runtimeRecoveryInterruptTotal: 1,
        agentTaskResumeTotal: 9,
        agentTaskResumeFailedTotal: 3,
      },
    },
    {
      id: "durability-2",
      timestamp: baseTimestamp,
      source: "server",
      label: "runtime/updated warning durability degraded",
      payload: {
        reason: "agent_task_durability_degraded",
        revision: "durability-rev-1",
        mode: "active",
        degraded: true,
        checkpointWriteTotal: 42,
        checkpointWriteFailedTotal: 6,
        agentTaskCheckpointRecoverTotal: 4,
        subagentCheckpointRecoverTotal: 2,
        runtimeRecoveryInterruptTotal: 1,
        agentTaskResumeTotal: 9,
        agentTaskResumeFailedTotal: 3,
      },
    },
  ];
}

describe("debugEntryDiagnostics", () => {
  it("collects distributed diagnostics with diagnosticReason fallback", () => {
    const result = collectDebugEntryDiagnostics([createDistributedEntry()], {
      includeDistributedDiagnostics: true,
    });

    expect(result.distributedDiagnostics).toEqual({
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
      executionMode: "local-cli",
      reason: "policy_rejected_local_access",
    });
    expect(result.hasRemoteExecutionDiagnostics).toBe(true);
  });

  it("collects durability diagnostics and occurrence counts", () => {
    const result = collectDebugEntryDiagnostics(createDurabilityEntries(), {
      includeDistributedDiagnostics: false,
    });

    expect(result.distributedDiagnostics).toBeNull();
    expect(result.agentTaskDurabilityDiagnostics?.reason).toBe("agent_task_durability_degraded");
    expect(result.agentTaskDurabilityDiagnostics?.revision).toBe("durability-rev-1");
    expect(result.agentTaskDurabilityDiagnostics?.occurrencesInWindow).toBe(2);
    expect(result.agentTaskDurabilityDiagnostics?.checkpointWriteTotal).toBe(42);
    expect(result.agentTaskDurabilityDiagnostics?.agentTaskResumeFailedTotal).toBe(3);
  });

  it("formats execution mode and timestamps for debug presentation", () => {
    expect(formatExecutionMode("runtime")).toBe("runtime");
    expect(formatExecutionMode(null)).toBe("-");
    expect(formatDiagnosticsTimestamp(null)).toBe("-");
    expect(formatDiagnosticsTimestamp(-1)).toBe("-");
  });
});
