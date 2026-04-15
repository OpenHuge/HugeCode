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
      workspaceId: "workspace-1",
      runtimeTasks: [
        {
          ...buildTask("resume-task", "interrupted", 10),
          runSummary: {
            id: "resume-task",
            taskId: "resume-task",
            workspaceId: "workspace-1",
            state: "paused",
            title: "Resume task",
            summary: "Resume from runtime-published checkpoint.",
            startedAt: 1,
            finishedAt: null,
            updatedAt: 10,
            currentStepIndex: 0,
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
        },
        buildTask("approval-task", "awaiting_approval", 5),
      ],
      statusFilter: "all",
      capabilities: {
        mode: "electron-bridge",
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
        state: "ready",
        ready: true,
        launchAllowed: true,
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
      workspaceId: "workspace-1",
      runtimeTasks: [
        {
          ...buildTask("native-run", "running", 12),
          runSummary: {
            id: "native-run",
            taskId: "native-run",
            workspaceId: "workspace-1",
            state: "running",
            title: "Runtime-native run",
            summary: "Published from runtime",
            startedAt: 1,
            finishedAt: null,
            updatedAt: 12,
            currentStepIndex: 0,
            warnings: [],
            validations: [],
            artifacts: [],
            changedPaths: [],
            governance: {
              state: "awaiting_review",
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
        mode: "electron-bridge",
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
        state: "ready",
        ready: true,
        launchAllowed: true,
        detail: null,
      },
      runtimeToolMetrics: null,
      runtimeToolGuardrails: null,
      stalePendingApprovalMs: 10,
    });

    expect(state.projectedRunsByTaskId.get("native-run")?.title).toBe("Runtime-native run");
    expect(state.projectedRunsByTaskId.get("native-run")?.summary).toBe("Published from runtime");
  });

  it("does not synthesize projected runs when runtime omitted run summaries", () => {
    const state = buildRuntimeMissionControlOrchestrationState({
      workspaceId: "workspace-1",
      runtimeTasks: [buildTask("task-without-run", "running", 12)],
      statusFilter: "all",
      capabilities: {
        mode: "electron-bridge",
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
        state: "ready",
        ready: true,
        launchAllowed: true,
        detail: null,
      },
      runtimeToolMetrics: null,
      runtimeToolGuardrails: null,
      stalePendingApprovalMs: 10,
    });

    expect(state.projectedRunsByTaskId.has("task-without-run")).toBe(false);
    expect(state.visibleRuntimeRuns).toEqual([
      {
        task: expect.objectContaining({ taskId: "task-without-run" }),
        run: null,
      },
    ]);
    expect(state.continuityReadiness.items).toHaveLength(0);
  });

  it("feeds runtime-published context pressure into launch readiness", () => {
    const state = buildRuntimeMissionControlOrchestrationState({
      workspaceId: "workspace-1",
      runtimeTasks: [
        {
          ...buildTask("context-pressure-task", "running", 12),
          contextBoundary: {
            boundaryId: "boundary-1",
            trigger: "tool_output",
            phase: "mid_turn",
            status: "failed",
          },
        },
      ],
      statusFilter: "all",
      capabilities: {
        mode: "electron-bridge",
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
        state: "ready",
        ready: true,
        launchAllowed: true,
        detail: null,
      },
      runtimeToolMetrics: null,
      runtimeToolGuardrails: null,
      stalePendingApprovalMs: 10,
    });

    expect(state.launchReadiness.state).toBe("blocked");
    expect(state.launchReadiness.contextPressure.pressureState).toBe("critical");
    expect(state.launchReadiness.contextPressure.detail).toContain("boundary-1 failed");
  });

  it("surfaces runtime invocation host truth for launch orchestration", () => {
    const state = buildRuntimeMissionControlOrchestrationState({
      workspaceId: "workspace-1",
      runtimeTasks: [],
      statusFilter: "all",
      capabilities: {
        mode: "electron-bridge",
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
        state: "ready",
        ready: true,
        launchAllowed: true,
        detail: null,
      },
      runtimeToolMetrics: null,
      runtimeToolGuardrails: null,
      runtimeInvocationHostRegistry: {
        registryVersion: "runtime-invocation-host-registry-v1",
        generatedAt: 1,
        workspaceId: "workspace-1",
        summary: {
          total: 1,
          executable: 1,
          resolveOnly: 0,
          reserved: 0,
          unsupported: 0,
          ready: 1,
          attention: 0,
          blocked: 0,
        },
        hosts: [
          {
            hostId: "runtime:built-in-tools",
            category: "built_in_runtime_tool",
            label: "Runtime built-in tools",
            summary: "Runtime-native execution host",
            authority: "runtime",
            dispatchMode: "execute",
            readiness: {
              state: "ready",
              available: true,
              reason: null,
              checkedAt: 1,
            },
            requirementKeys: ["runtime_service"],
            dispatchMethods: ["code_runtime_invocation_dispatch_v1"],
            provenance: {
              source: "runtime_host_registry",
              registryVersion: "runtime-invocation-host-registry-v1",
              workspaceId: "workspace-1",
            },
          },
        ],
      },
      stalePendingApprovalMs: 10,
    });

    expect(state.launchInvocationTruth).toMatchObject({
      selectedInvocationHostLabel: "Runtime built-in tools",
      runtimeDispatchMode: "execute",
      usesCanonicalRuntimeDispatch: true,
      usesCompatibilityFallback: false,
      truthSourceLabel: "Runtime invocation host registry",
    });
  });
});
