import { describe, expect, it } from "vitest";
import { buildRuntimeMissionControlOrchestrationState } from "./runtimeMissionControlOrchestration";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

function buildTask(
  taskId: string,
  status: RuntimeAgentTaskSummary["status"],
  updatedAt: number
): RuntimeAgentTaskSummary {
  return {
    taskId,
    workspaceId: "workspace-1",
    threadId: null,
    requestId: null,
    title: `Task ${taskId}`,
    status,
    accessMode: "on-request",
    executionMode: "single",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    reasonEffort: "medium",
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: "codex",
    routedSource: "workspace-default",
    currentStep: 0,
    createdAt: 1,
    updatedAt,
    startedAt: 1,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: status === "awaiting_approval" ? `${taskId}-approval` : null,
    steps: [],
  };
}

describe("buildRuntimeMissionControlOrchestrationState", () => {
  it("centralizes graph-backed continuity and launch readiness state", () => {
    const state = buildRuntimeMissionControlOrchestrationState({
      runtimeTasks: [
        {
          ...buildTask("resume-task", "interrupted", 10),
          recovered: true,
          executionGraph: {
            graphId: "graph-resume-task",
            nodes: [
              {
                id: "graph-resume-task:root",
                kind: "plan",
                resolvedBackendId: "backend-1",
                checkpoint: {
                  state: "interrupted",
                  lifecycleState: "interrupted",
                  checkpointId: "checkpoint-1",
                  traceId: "trace-1",
                  recovered: true,
                  updatedAt: 10,
                  resumeReady: true,
                  recoveredAt: 10,
                  summary: "Resume from checkpoint-1.",
                },
              },
            ],
            edges: [],
          },
        },
        buildTask("approval-task", "awaiting_approval", 5),
      ],
      statusFilter: "all",
      capabilities: {
        mode: "tauri",
        methods: [],
        features: [],
        wsEndpointPath: "/ws",
        error: null,
      },
      health: {
        app: "runtime",
        version: "1.0.0",
        status: "ok",
      },
      healthError: null,
      selectedRoute: {
        value: "auto",
        label: "Automatic workspace routing",
        ready: true,
        detail: null,
      },
      runtimeToolMetrics: null,
      runtimeToolGuardrails: null,
      stalePendingApprovalMs: 10,
      now: () => 20,
    });

    expect(state.resumeReadyRuntimeTasks.map((task) => task.taskId)).toEqual(["resume-task"]);
    expect(state.pendingApprovalTasks.map((task) => task.taskId)).toEqual(["approval-task"]);
    expect(state.stalePendingApprovalTasks.map((task) => task.taskId)).toEqual(["approval-task"]);
    expect(state.continuityReadiness.recoverableRunCount).toBe(1);
    expect(state.launchReadiness.approvalPressure.pendingCount).toBe(1);
    expect(state.visibleRuntimeRuns).toHaveLength(2);
    expect(state.projectedRunsByTaskId.get("resume-task")?.executionGraph?.graphId).toBe(
      "graph-resume-task"
    );
  });

  it("prefers runtime-published run summaries over local projection fallback", () => {
    const state = buildRuntimeMissionControlOrchestrationState({
      runtimeTasks: [
        {
          ...buildTask("native-run", "running", 12),
          runSummary: {
            id: "native-run",
            taskId: "native-run",
            workspaceId: "workspace-1",
            state: "in_progress",
            title: "Runtime-native run",
            summary: "Published from runtime",
            startedAt: 1,
            finishedAt: null,
            updatedAt: 12,
            warnings: [],
            validations: [],
            artifacts: [],
            changedPaths: [],
            governance: {
              state: "in_progress",
              label: "Runtime-governed execution",
              summary: "Published from runtime",
              blocking: false,
              suggestedAction: null,
              availableActions: [],
            },
          },
        },
      ],
      statusFilter: "all",
      capabilities: {
        mode: "tauri",
        methods: [],
        features: [],
        wsEndpointPath: "/ws",
        error: null,
      },
      health: {
        app: "runtime",
        version: "1.0.0",
        status: "ok",
      },
      healthError: null,
      selectedRoute: {
        value: "auto",
        label: "Automatic workspace routing",
        ready: true,
        detail: null,
      },
      runtimeToolMetrics: null,
      runtimeToolGuardrails: null,
      stalePendingApprovalMs: 10,
    });

    expect(state.projectedRunsByTaskId.get("native-run")?.title).toBe("Runtime-native run");
    expect(state.projectedRunsByTaskId.get("native-run")?.summary).toBe("Published from runtime");
  });
});
