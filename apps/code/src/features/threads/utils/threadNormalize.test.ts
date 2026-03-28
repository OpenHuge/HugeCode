import { describe, expect, it } from "vitest";
import {
  extractReviewThreadId,
  normalizePlanStepStatus,
  normalizePlanUpdate,
  normalizeRateLimits,
} from "./threadNormalize";

describe("normalizePlanUpdate", () => {
  it("normalizes a plan when the payload uses an array", () => {
    expect(
      normalizePlanUpdate("turn-1", " Note ", [{ step: "Do it", status: "in_progress" }])
    ).toEqual({
      turnId: "turn-1",
      explanation: "Note",
      steps: [{ step: "Do it", status: "inProgress" }],
      distributedGraph: null,
    });
  });

  it("normalizes a plan when the payload uses an object with steps", () => {
    expect(
      normalizePlanUpdate("turn-2", null, {
        explanation: "Hello",
        steps: [{ step: "Ship it", status: "completed" }],
      })
    ).toEqual({
      turnId: "turn-2",
      explanation: "Hello",
      steps: [{ step: "Ship it", status: "completed" }],
      distributedGraph: null,
    });
  });

  it("normalizes distributed graph payload additively", () => {
    expect(
      normalizePlanUpdate("turn-4", null, {
        steps: [],
        distributed_graph: {
          nodes: [{ id: "node-1", title: "Node 1", status: "running" }],
          edges: [],
        },
      })
    ).toEqual({
      turnId: "turn-4",
      explanation: null,
      steps: [],
      distributedGraph: {
        graphId: null,
        updatedAt: null,
        nodes: [
          {
            id: "node-1",
            title: "Node 1",
            status: "running",
            backendId: null,
            backendLabel: null,
            group: null,
            queueDepth: null,
            attempt: null,
            maxAttempts: null,
            startedAt: null,
            finishedAt: null,
            parentId: null,
            metadata: null,
          },
        ],
        edges: [],
        summary: {
          totalNodes: 1,
          runningNodes: 1,
          completedNodes: 0,
          failedNodes: 0,
          queueDepth: null,
          placementFailuresTotal: null,
          accessMode: null,
          routedProvider: null,
          executionMode: null,
          reason: null,
        },
      },
    });
  });

  it("returns null when there is no explanation or steps", () => {
    expect(normalizePlanUpdate("turn-3", "", { steps: [] })).toBeNull();
  });

  it("maps extended plan step status values", () => {
    expect(normalizePlanStepStatus("awaiting_approval")).toBe("blocked");
    expect(normalizePlanStepStatus("FAILED")).toBe("failed");
    expect(normalizePlanStepStatus("interrupted")).toBe("cancelled");
    expect(normalizePlanStepStatus("running")).toBe("inProgress");
  });

  it("merges incremental rate limit updates onto the previous snapshot", () => {
    const previous = {
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: {
        usedPercent: 10,
        windowDurationMins: 30,
        resetsAt: 999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "24.00",
      },
      planType: "pro",
    };

    expect(
      normalizeRateLimits(
        {
          primary: {
            remaining_percent: 25,
          },
          credits: {
            balance: "21.50",
          },
        },
        previous
      )
    ).toEqual({
      primary: {
        usedPercent: 75,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: {
        usedPercent: 10,
        windowDurationMins: 30,
        resetsAt: 999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "21.50",
      },
      planType: "pro",
    });
  });

  it("clears fields on explicit null while preserving omitted keys", () => {
    const previous = {
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: {
        usedPercent: 10,
        windowDurationMins: 30,
        resetsAt: 999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "24.00",
      },
      planType: "pro",
    };

    expect(
      normalizeRateLimits(
        {
          secondary: null,
          credits: null,
          planType: null,
        },
        previous
      )
    ).toEqual({
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: null,
      credits: null,
      planType: null,
    });
  });

  it("inherits the full previous snapshot when the update payload omits all keys", () => {
    const previous = {
      primary: {
        usedPercent: 40,
        windowDurationMins: 60,
        resetsAt: 1234,
      },
      secondary: null,
      credits: {
        hasCredits: false,
        unlimited: true,
        balance: null,
      },
      planType: "enterprise",
    };

    expect(normalizeRateLimits({}, previous)).toEqual(previous);
  });

  it("extracts review thread ids from legacy threadId review-start payloads", () => {
    expect(
      extractReviewThreadId({
        result: {
          threadId: "thread-review-legacy",
        },
      })
    ).toBe("thread-review-legacy");
  });

  it("merges limit id/name incrementally across updates", () => {
    const previous = {
      primary: null,
      secondary: null,
      credits: null,
      planType: "pro",
      limitId: "codex",
      limitName: "Codex",
    };

    expect(
      normalizeRateLimits(
        {
          limit_name: "Codex Team",
        },
        previous
      )
    ).toEqual({
      primary: null,
      secondary: null,
      credits: null,
      planType: "pro",
      limitId: "codex",
      limitName: "Codex Team",
    });
  });
});
