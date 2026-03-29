import { describe, expect, it } from "vitest";
import type { AgentTaskSummary } from "@ku0/code-runtime-host-contract";
import { buildPlacementEvidence } from "./runtimeMissionControlPlacement";

function createTask(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "ws-1",
    threadId: null,
    requestId: null,
    title: "Task",
    status: "running",
    accessMode: "on-request",
    executionMode: "single",
    provider: null,
    modelId: null,
    routedProvider: null,
    routedModelId: null,
    routedPool: null,
    routedSource: null,
    currentStep: 1,
    createdAt: 1,
    updatedAt: 1,
    startedAt: 1,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    preferredBackendIds: ["backend-primary"],
    steps: [],
    ...overrides,
  };
}

describe("runtimeMissionControlPlacement", () => {
  it("synthesizes unresolved placement evidence from execution-graph routing signals", () => {
    const placement = buildPlacementEvidence({
      task: createTask({
        executionGraph: {
          graphId: "graph-1",
          nodes: [
            {
              id: "graph-1:root",
              kind: "plan",
              status: "running",
              executorKind: "sub_agent",
              executorSessionId: "session-1",
              preferredBackendIds: ["backend-primary"],
              resolvedBackendId: null,
              placementLifecycleState: "requested",
              placementResolutionSource: "explicit_preference",
            },
          ],
          edges: [],
        },
      }),
      routing: {
        backendId: null,
        provider: null,
        providerLabel: null,
        pool: null,
        routeLabel: "Local runtime",
        routeHint: "This run does not require workspace OAuth routing.",
        health: "ready",
        enabledAccountCount: 0,
        readyAccountCount: 0,
        enabledPoolCount: 0,
      },
      executionProfile: null,
    });

    expect(placement).toEqual({
      resolvedBackendId: null,
      requestedBackendIds: ["backend-primary"],
      resolutionSource: "explicit_preference",
      lifecycleState: "requested",
      readiness: "attention",
      healthSummary: "placement_attention",
      attentionReasons: ["awaiting_backend_confirmation", "placement_unresolved"],
      summary: "Placement is unresolved.",
      rationale: "Runtime has not confirmed a concrete backend placement yet.",
    });
  });
});
