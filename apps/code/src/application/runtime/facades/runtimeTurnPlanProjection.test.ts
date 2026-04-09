import { describe, expect, it } from "vitest";
import { normalizePlanStepStatus, normalizePlanUpdate } from "./runtimeTurnPlanProjection";

describe("runtimeTurnPlanProjection", () => {
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
  });

  describe("normalizePlanStepStatus", () => {
    it("maps extended plan step status values", () => {
      expect(normalizePlanStepStatus("awaiting_approval")).toBe("blocked");
      expect(normalizePlanStepStatus("FAILED")).toBe("failed");
      expect(normalizePlanStepStatus("interrupted")).toBe("cancelled");
      expect(normalizePlanStepStatus("running")).toBe("inProgress");
    });
  });
});
