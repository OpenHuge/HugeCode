import { describe, expect, it } from "vitest";
import {
  collectDistributedTaskGraphSubtreeTaskIds,
  normalizeDistributedTaskGraphSnapshot,
} from "./distributedTaskGraph";

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

  it("collects subtree task ids across parent links and graph edges", () => {
    expect(
      collectDistributedTaskGraphSubtreeTaskIds(
        {
          graphId: "task-root-1",
          nodes: [
            { id: "task-root-1", title: "root", status: "running" },
            {
              id: "task-node-1",
              title: "node 1",
              status: "running",
              parentId: "task-root-1",
            },
            {
              id: "task-node-2",
              title: "node 2",
              status: "queued",
              parentId: "task-node-1",
            },
            {
              id: "task-node-3",
              title: "node 3",
              status: "queued",
            },
          ],
          edges: [{ fromId: "task-node-2", toId: "task-node-3", kind: "depends_on" }],
        },
        "task-node-1"
      )
    ).toEqual(["task-node-1", "task-node-2", "task-node-3"]);
  });
});
