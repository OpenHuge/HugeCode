import { describe, expect, it } from "vitest";
import { planRuntimeSubAgentBatch } from "./webMcpBridgeRuntimeSubAgentBatchPlanner";

describe("webMcpBridgeRuntimeSubAgentBatchPlanner", () => {
  it("builds dependency-aware waves in topological order", () => {
    const plan = planRuntimeSubAgentBatch({
      executionMode: "parallel",
      maxParallel: 4,
      tasks: [
        { index: 0, taskKey: "collect", dependsOn: [] },
        { index: 1, taskKey: "analyze", dependsOn: ["collect"] },
        { index: 2, taskKey: "lint", dependsOn: ["collect"] },
        { index: 3, taskKey: "summarize", dependsOn: ["analyze", "lint"] },
      ],
    });

    expect(plan.waves).toEqual([["collect"], ["analyze", "lint"], ["summarize"]]);
    expect(plan.order).toEqual(["collect", "analyze", "lint", "summarize"]);
  });

  it("throws when dependencies reference an unknown task key", () => {
    expect(() =>
      planRuntimeSubAgentBatch({
        executionMode: "parallel",
        maxParallel: 2,
        tasks: [
          { index: 0, taskKey: "collect", dependsOn: [] },
          { index: 1, taskKey: "analyze", dependsOn: ["missing-task"] },
        ],
      })
    ).toThrow(/missing-task/);
  });

  it("throws when task keys are duplicated", () => {
    expect(() =>
      planRuntimeSubAgentBatch({
        executionMode: "parallel",
        maxParallel: 2,
        tasks: [
          { index: 0, taskKey: "duplicate", dependsOn: [] },
          { index: 1, taskKey: "duplicate", dependsOn: [] },
        ],
      })
    ).toThrow(/Duplicate taskKey/);
  });

  it("throws when the graph has a dependency cycle", () => {
    expect(() =>
      planRuntimeSubAgentBatch({
        executionMode: "parallel",
        maxParallel: 3,
        tasks: [
          { index: 0, taskKey: "a", dependsOn: ["c"] },
          { index: 1, taskKey: "b", dependsOn: ["a"] },
          { index: 2, taskKey: "c", dependsOn: ["b"] },
        ],
      })
    ).toThrow(/cycle/i);
  });

  it("clamps maxParallel and forces sequential mode to 1", () => {
    const clampedHigh = planRuntimeSubAgentBatch({
      executionMode: "parallel",
      maxParallel: 99,
      tasks: [{ index: 0, taskKey: "task-1", dependsOn: [] }],
    });
    const clampedLow = planRuntimeSubAgentBatch({
      executionMode: "parallel",
      maxParallel: -3,
      tasks: [{ index: 0, taskKey: "task-1", dependsOn: [] }],
    });
    const sequential = planRuntimeSubAgentBatch({
      executionMode: "sequential",
      maxParallel: 6,
      tasks: [{ index: 0, taskKey: "task-1", dependsOn: [] }],
    });

    expect(clampedHigh.maxParallel).toBe(6);
    expect(clampedLow.maxParallel).toBe(1);
    expect(sequential.maxParallel).toBe(1);
  });

  it("forces sequential fallback for approval-sensitive batches", () => {
    const plan = planRuntimeSubAgentBatch({
      executionMode: "parallel",
      maxParallel: 4,
      provider: "openai",
      tasks: [
        { index: 0, taskKey: "inspect", dependsOn: [], requiresApproval: true },
        { index: 1, taskKey: "summarize", dependsOn: [] },
      ],
    });

    expect(plan.executionMode).toBe("sequential");
    expect(plan.maxParallel).toBe(1);
    expect(plan.policy.parallelToolCallsAllowed).toBe(false);
    expect(plan.policy.reasonCodes).toContain("approval-sensitive-tasks");
  });
});
