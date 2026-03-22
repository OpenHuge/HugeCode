import { describe, expect, it } from "vitest";
import { normalizeDistributedTaskGraphSnapshot } from "./distributedGraph";

describe("normalizeDistributedTaskGraphSnapshot", () => {
  it("maps runtime contract task graph payloads", () => {
    const snapshot = normalizeDistributedTaskGraphSnapshot({
      taskId: "task-root-1",
      rootTaskId: "task-root-1",
      nodes: [
        {
          taskId: "task-node-1",
          parentTaskId: "task-root-1",
          role: "planner",
          backendId: "backend-a",
          status: "completed",
          attempt: 1,
        },
        {
          taskId: "task-node-2",
          parentTaskId: "task-root-1",
          role: "coder",
          backendId: "backend-b",
          status: "running",
          attempt: 2,
        },
      ],
      edges: [
        {
          fromTaskId: "task-node-1",
          toTaskId: "task-node-2",
          type: "depends_on",
        },
      ],
    });

    expect(snapshot).toBeTruthy();
    expect(snapshot?.graphId).toBe("task-root-1");
    expect(snapshot?.nodes[0]).toMatchObject({
      id: "task-node-1",
      title: "planner",
      parentId: "task-root-1",
    });
    expect(snapshot?.edges[0]).toEqual({
      fromId: "task-node-1",
      toId: "task-node-2",
      kind: "depends_on",
    });
  });

  it("maps distributed diagnostics fields from summary payloads", () => {
    const snapshot = normalizeDistributedTaskGraphSnapshot({
      taskId: "task-root-2",
      nodes: [
        {
          taskId: "task-node-3",
          role: "verify",
          status: "failed",
        },
      ],
      summary: {
        queueDepth: 11,
        placementFailuresTotal: 3,
        access_mode: "on-request",
        routed_provider: "openai",
        execution_mode: "runtime",
        reason: "Runtime provider refused direct local host access",
      },
    });

    expect(snapshot?.summary).toMatchObject({
      queueDepth: 11,
      placementFailuresTotal: 3,
      accessMode: "on-request",
      routedProvider: "openai",
      executionMode: "runtime",
    });
  });

  it("returns null for empty records", () => {
    expect(normalizeDistributedTaskGraphSnapshot({})).toBeNull();
  });
});
