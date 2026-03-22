import { beforeEach, describe, expect, it } from "vitest";
import type { RuntimeToolExecutionSnapshot } from "./runtimeToolExecutionMetrics";
import {
  __resetRuntimeToolReliabilityPolicyForTests,
  COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE,
  evaluateRuntimeToolReliability,
  RUNTIME_TOOL_CIRCUIT_OPEN_MS,
  RUNTIME_TOOL_MAX_INPUT_BYTES,
  readRuntimeToolReliabilityCircuitState,
  recordRuntimeToolReliabilityOutcome,
} from "./runtimeToolReliabilityPolicy";

function buildSnapshotWithRecentStatuses(
  scope: "write" | "runtime" | "computer_observe",
  statuses: Array<"success" | "validation_failed" | "runtime_failed" | "timeout" | "blocked">
): RuntimeToolExecutionSnapshot {
  const now = 1_000_000;
  return {
    totals: {
      attemptedTotal: statuses.length,
      startedTotal: statuses.length,
      completedTotal: statuses.length,
      successTotal: statuses.filter((status) => status === "success").length,
      validationFailedTotal: statuses.filter((status) => status === "validation_failed").length,
      runtimeFailedTotal: statuses.filter((status) => status === "runtime_failed").length,
      timeoutTotal: statuses.filter((status) => status === "timeout").length,
      blockedTotal: statuses.filter((status) => status === "blocked").length,
      truncatedTotal: 0,
    },
    byTool: {},
    recent: statuses.map((status, index) => ({
      toolName: "tool",
      scope,
      status,
      errorCode: null,
      durationMs: 1,
      truncatedOutput: false,
      at: now - index,
    })),
    updatedAt: now,
  };
}

describe("runtimeToolReliabilityPolicy", () => {
  beforeEach(() => {
    __resetRuntimeToolReliabilityPolicyForTests();
  });

  it("blocks oversized input payloads", () => {
    const payload = {
      content: "x".repeat(RUNTIME_TOOL_MAX_INPUT_BYTES + 128),
    };
    const result = evaluateRuntimeToolReliability({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      payload,
    });
    expect(result.allowed).toBe(false);
    if (result.allowed) {
      throw new Error("expected oversized payload to be blocked");
    }
    expect(result.reason).toBe("payload_too_large");
  });

  it("enforces computer observe rate limit per workspace", () => {
    for (let index = 0; index < COMPUTER_OBSERVE_RATE_LIMIT_PER_MINUTE; index += 1) {
      const result = evaluateRuntimeToolReliability({
        toolName: "run-runtime-computer-observe",
        scope: "computer_observe",
        workspaceId: "ws-rate-limit",
        payload: { workspaceId: "ws-rate-limit", query: `probe-${index}` },
        nowMs: 1000 + index,
        snapshotOverride: buildSnapshotWithRecentStatuses("computer_observe", ["success"]),
      });
      expect(result.allowed).toBe(true);
    }

    const blocked = evaluateRuntimeToolReliability({
      toolName: "run-runtime-computer-observe",
      scope: "computer_observe",
      workspaceId: "ws-rate-limit",
      payload: { workspaceId: "ws-rate-limit", query: "overflow" },
      nowMs: 1100,
      snapshotOverride: buildSnapshotWithRecentStatuses("computer_observe", ["success"]),
    });
    expect(blocked.allowed).toBe(false);
    if (blocked.allowed) {
      throw new Error("expected rate limit to block overflow request");
    }
    expect(blocked.reason).toBe("rate_limited");
  });

  it("opens circuit on low recent success rate and closes after half-open probes recover", () => {
    const lowSuccess = buildSnapshotWithRecentStatuses("runtime", [
      "success",
      "success",
      "success",
      ...new Array(17).fill("runtime_failed"),
    ]);
    const firstDecision = evaluateRuntimeToolReliability({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      payload: { instruction: "test" },
      nowMs: 10_000,
      snapshotOverride: lowSuccess,
    });
    expect(firstDecision.allowed).toBe(false);
    expect(readRuntimeToolReliabilityCircuitState("runtime").state).toBe("open");

    const probe1 = evaluateRuntimeToolReliability({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      payload: { instruction: "probe-1" },
      nowMs: 10_000 + RUNTIME_TOOL_CIRCUIT_OPEN_MS + 1,
      snapshotOverride: buildSnapshotWithRecentStatuses("runtime", ["success"]),
    });
    expect(probe1.allowed).toBe(true);
    recordRuntimeToolReliabilityOutcome({
      scope: "runtime",
      status: "success",
      nowMs: 10_000 + RUNTIME_TOOL_CIRCUIT_OPEN_MS + 2,
    });

    const probe2 = evaluateRuntimeToolReliability({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      payload: { instruction: "probe-2" },
      nowMs: 10_000 + RUNTIME_TOOL_CIRCUIT_OPEN_MS + 3,
      snapshotOverride: buildSnapshotWithRecentStatuses("runtime", ["success"]),
    });
    expect(probe2.allowed).toBe(true);
    recordRuntimeToolReliabilityOutcome({
      scope: "runtime",
      status: "success",
      nowMs: 10_000 + RUNTIME_TOOL_CIRCUIT_OPEN_MS + 4,
    });

    const probe3 = evaluateRuntimeToolReliability({
      toolName: "run-runtime-live-skill",
      scope: "runtime",
      payload: { instruction: "probe-3" },
      nowMs: 10_000 + RUNTIME_TOOL_CIRCUIT_OPEN_MS + 5,
      snapshotOverride: buildSnapshotWithRecentStatuses("runtime", ["success"]),
    });
    expect(probe3.allowed).toBe(true);
    recordRuntimeToolReliabilityOutcome({
      scope: "runtime",
      status: "runtime_failed",
      nowMs: 10_000 + RUNTIME_TOOL_CIRCUIT_OPEN_MS + 6,
    });

    expect(readRuntimeToolReliabilityCircuitState("runtime").state).toBe("closed");
  });
});
