import { describe, expect, it } from "vitest";
import { normalizeRuntimeTaskForProjection } from "./WorkspaceHomeAgentRuntimeOrchestration.helpers";
import type { RuntimeAgentTaskSummary } from "../../../application/runtime/types/webMcpBridge";

function createRuntimeTask(
  overrides: Partial<RuntimeAgentTaskSummary> = {}
): RuntimeAgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "workspace-1",
    threadId: "thread-1",
    title: "Track A runtime truth",
    status: "running",
    accessMode: "full-access",
    distributedStatus: "running",
    currentStep: 1,
    createdAt: 1,
    updatedAt: 2,
    startedAt: 2,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    checkpointId: "checkpoint-1",
    traceId: "trace-1",
    recovered: false,
    ...overrides,
  };
}

describe("WorkspaceHomeAgentRuntimeOrchestration.helpers", () => {
  it("preserves runtime-owned task truth fields during projection", () => {
    const projected = normalizeRuntimeTaskForProjection(
      createRuntimeTask({
        requestId: "request-1",
        executionMode: "distributed",
        provider: "openai",
        modelId: "gpt-5.3-codex",
        reasonEffort: "high",
        routedProvider: "openai",
        routedModelId: "gpt-5.3-codex",
        routedPool: "codex",
        routedSource: "workspace-default",
        executionProfileId: "autonomous-delegate",
        executionProfile: {
          id: "autonomous-delegate",
          name: "Autonomous Delegate",
          description: "Runtime-owned execution profile",
          executionMode: "distributed",
          autonomy: "autonomous_delegate",
          supervisionLabel: "Checkpointed autonomy with targeted intervention",
          accessMode: "full-access",
          routingStrategy: "workspace_default",
          toolPosture: "workspace_extended",
          approvalSensitivity: "low_friction",
          identitySource: "runtime_agent_task",
        },
        profileReadiness: {
          ready: true,
          health: "ready",
          summary: "Profile is ready for delegated execution.",
          issues: [],
        },
        routing: {
          backendId: "backend-a",
          provider: "openai",
          providerLabel: "openai",
          pool: "codex",
          routeLabel: "backend-a / openai / codex",
          routeHint: "Placed on backend backend-a.",
          health: "ready",
          resolutionSource: "explicit_preference",
          lifecycleState: "confirmed",
          enabledAccountCount: 0,
          readyAccountCount: 0,
          enabledPoolCount: 0,
        },
        approvalState: {
          status: "not_required",
          approvalId: null,
          label: "No approval required",
          summary: "Runtime can proceed without approval.",
        },
        reviewDecision: {
          status: "pending",
          reviewPackId: "review-pack:task-1",
          label: "Decision pending",
          summary: "Awaiting operator review.",
          decidedAt: null,
        },
        reviewPackId: "review-pack:task-1",
        intervention: {
          actions: [],
          primaryAction: null,
        },
        operatorState: {
          health: "healthy",
          headline: "Runtime is healthy",
          detail: "Placement is confirmed.",
        },
        nextAction: {
          label: "Review",
          action: "review",
          detail: "Open the review pack.",
        },
        publishHandoff: {
          jsonPath: ".hugecode/runs/task-1/publish/handoff.json",
          markdownPath: ".hugecode/runs/task-1/publish/handoff.md",
          reason: "completed",
          summary: "AutoDrive prepared publish handoff.",
          at: 2,
          branchName: "autodrive/runtime-truth-task-1",
          reviewTitle: "Ship runtime truth",
        } as never,
        missionBrief: {
          objective: "Complete runtime truth wiring",
          doneDefinition: ["Task payload exposes routing and readiness."],
          constraints: ["Do not invent UI truth"],
          preferredBackendIds: ["backend-a"],
        },
        relaunchContext: {
          sourceTaskId: "task-0",
          sourceRunId: "run-0",
          sourceReviewPackId: "review-pack:run-0",
          summary: "Resume from previous review.",
          failureClass: "approval_required",
          recommendedActions: ["continue_with_clarification"],
        },
        checkpointState: {
          state: "interrupted",
          lifecycleState: "interrupted",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          recovered: true,
          updatedAt: 2,
          resumeReady: true,
          recoveredAt: 2,
          summary: "Run can resume from checkpoint-1.",
        },
        missionLinkage: {
          workspaceId: "workspace-1",
          taskId: "task-1",
          runId: "task-1",
          reviewPackId: "review-pack:task-1",
          checkpointId: "checkpoint-1",
          traceId: "trace-1",
          threadId: "thread-1",
          requestId: "request-1",
          missionTaskId: "runtime-task:task-1",
          taskEntityKind: "thread",
          recoveryPath: "thread",
          navigationTarget: {
            kind: "thread",
            workspaceId: "workspace-1",
            threadId: "thread-1",
          },
          summary: "Resume from thread-1 on another control device.",
        },
        reviewActionability: {
          state: "degraded",
          summary: "Review can continue, but runtime evidence is incomplete.",
          degradedReasons: ["runtime_evidence_incomplete"],
          actions: [
            {
              action: "retry",
              enabled: true,
              supported: true,
              reason: null,
            },
          ],
        },
        autoDrive: {
          enabled: true,
          destination: {
            title: "Ship the runtime truth contract",
            desiredEndState: ["Runtime task truth remains runtime-owned."],
            doneDefinition: {
              arrivalCriteria: ["Task truth is runtime-owned."],
              waypointIndicators: ["routing confirmed"],
              requiredValidation: ["tests pass"],
            },
          },
        },
        backendId: "backend-a",
        preferredBackendIds: ["backend-a"],
        rootTaskId: "task-root",
        parentTaskId: "task-parent",
        childTaskIds: ["task-child"],
        steps: [
          {
            index: 0,
            kind: "read",
            role: "coder",
            status: "completed",
            message: "Inspected runtime truth payload.",
            runId: null,
            output: null,
            metadata: {},
            startedAt: 1,
            updatedAt: 2,
            completedAt: 2,
            errorCode: null,
            errorMessage: null,
            approvalId: null,
          },
        ],
      })
    );

    expect(projected.threadId).toBe("thread-1");
    expect(projected.requestId).toBe("request-1");
    expect(projected.executionProfile?.id).toBe("autonomous-delegate");
    expect(projected.profileReadiness?.ready).toBe(true);
    expect(projected.routing?.lifecycleState).toBe("confirmed");
    expect(projected.reviewDecision?.reviewPackId).toBe("review-pack:task-1");
    expect(projected.reviewPackId).toBe("review-pack:task-1");
    expect(projected.checkpointState?.resumeReady).toBe(true);
    expect(projected.missionLinkage?.recoveryPath).toBe("thread");
    expect(projected.reviewActionability?.state).toBe("degraded");
    expect(
      (projected as { publishHandoff?: { branchName?: string | null } }).publishHandoff?.branchName
    ).toBe("autodrive/runtime-truth-task-1");
    expect(projected.backendId).toBe("backend-a");
    expect(projected.preferredBackendIds).toEqual(["backend-a"]);
    expect(projected.childTaskIds).toEqual(["task-child"]);
    expect(projected.steps).toHaveLength(1);
  });
});
