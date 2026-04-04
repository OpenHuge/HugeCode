import type {
  AgentTaskSummary,
  HugeCodeMissionLineage,
  HugeCodeRunLedger,
  HugeCodeSubAgentSummary,
  HugeCodeTaskMode,
  HugeCodeTaskModeSource,
  HugeCodeTaskSourceSummary,
} from "@ku0/code-runtime-host-contract";
import { describe, expect, it } from "vitest";
import { projectAgentTaskSummaryToRunSummary } from "./runtimeMissionControlRunProjection";

function createTask(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  return {
    taskId: "run-1",
    workspaceId: "ws-1",
    threadId: "thread-1",
    requestId: "request-1",
    title: "Inspect runtime projection extraction",
    status: "completed",
    accessMode: "full-access",
    executionMode: "single",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: "codex",
    routedSource: "workspace-default",
    currentStep: 0,
    createdAt: 10,
    updatedAt: 20,
    startedAt: 11,
    completedAt: 21,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [],
    ...overrides,
  };
}

function createTaskSource(): HugeCodeTaskSourceSummary {
  return {
    kind: "manual_thread",
    label: "Manual thread",
    title: "Inspect runtime projection extraction",
    externalId: null,
    canonicalUrl: null,
    threadId: "thread-1",
    requestId: "request-1",
    sourceTaskId: null,
    sourceRunId: null,
    githubSource: null,
  };
}

function createLineage(objective: string | null): HugeCodeMissionLineage {
  return {
    objective,
    desiredEndState: [],
    hardBoundaries: [],
    doneDefinition: null,
    riskPolicy: null,
    taskMode: "delegate",
    executionProfileId: "profile-1",
    taskSource: createTaskSource(),
    threadId: "thread-1",
    requestId: "request-1",
    rootTaskId: null,
    parentTaskId: null,
    childTaskIds: [],
    reviewDecisionState: null,
    reviewDecisionSummary: null,
  };
}

function createLedger(): HugeCodeRunLedger {
  return {
    traceId: "trace-1",
    checkpointId: null,
    recovered: false,
    stepCount: 0,
    completedStepCount: 0,
    warningCount: 1,
    validationCount: 1,
    artifactCount: 0,
    evidenceState: "confirmed",
    backendId: "backend-primary",
    routeLabel: "Workspace backend",
    completionReason: "Completed successfully",
    lastProgressAt: 20,
  };
}

function createSubAgent(sessionId: string): HugeCodeSubAgentSummary {
  return {
    sessionId,
    parentRunId: "run-1",
    scopeProfile: "delegate",
    status: "completed",
    approvalState: null,
    checkpointState: null,
    summary: "Nested step complete.",
    timedOutReason: null,
    interruptedReason: null,
  };
}

describe("runtimeMissionControlRunProjection", () => {
  it("projects terminal tasks into canonical run summaries with review-pack defaults", () => {
    const task = createTask({
      taskSource: createTaskSource(),
      nextOperatorAction: {
        action: "review",
        label: "Review the evidence",
        detail: "Open the review surface.",
        source: "review_pack",
        sessionBoundary: {
          workspaceId: "ws-1",
          taskId: "thread-1",
          runId: "run-1",
          missionTaskId: "thread-1",
          sessionKind: "thread",
          threadId: "thread-1",
          requestId: "request-1",
          reviewPackId: "review-pack:run-1",
          checkpointId: null,
          traceId: "trace-1",
          navigationTarget: {
            kind: "thread",
            workspaceId: "ws-1",
            threadId: "thread-1",
          },
        },
      },
    });

    const run = projectAgentTaskSummaryToRunSummary(
      task,
      {
        resolveExecutionProfile: () => ({
          id: "profile-1",
          name: "Delegate",
          description: "Delegated execution.",
          executionMode: "remote_sandbox",
          autonomy: "autonomous_delegate",
          supervisionLabel: "Checkpointed autonomy",
          accessMode: "full-access",
          networkPolicy: "default",
          routingStrategy: "workspace_default",
          toolPosture: "workspace_extended",
          approvalSensitivity: "low_friction",
          identitySource: "workspace-routing",
          validationPresetId: "fast",
        }),
        deriveTaskMode: (): {
          mode: HugeCodeTaskMode | null;
          modeSource: HugeCodeTaskModeSource;
        } => ({
          mode: "delegate",
          modeSource: "execution_profile",
        }),
        buildRoutingSummary: () => ({
          backendId: "backend-primary",
          provider: "openai",
          providerLabel: "OpenAI",
          pool: "codex",
          routeLabel: "Workspace backend",
          routeHint: "Primary backend is ready.",
          health: "ready",
          enabledAccountCount: 1,
          readyAccountCount: 1,
          enabledPoolCount: 1,
        }),
        buildProfileReadiness: () => null,
        buildApprovalSummary: () => ({
          status: "not_required",
          approvalId: null,
          label: "No pending approval",
          summary: "No approval gate is active.",
        }),
        buildReviewDecisionSummary: () => null,
        buildInterventionSummary: () => null,
        buildOperatorState: () => null,
        buildNextAction: () => ({
          label: "Review the evidence",
          action: "review",
          detail: "Open the review surface.",
        }),
        deriveRunValidations: () => [
          {
            id: "validation-1",
            label: "pnpm validate:fast",
            outcome: "passed",
            summary: "Fast validation passed.",
            startedAt: 18,
            finishedAt: 19,
          },
        ],
        deriveRunArtifacts: () => [],
        deriveRunChangedPaths: () => ["src/runtime.ts"],
        deriveRunWarnings: () => ["One non-blocking warning."],
        deriveRunCompletionReason: () => "Completed successfully",
        deriveRuntimeTaskSource: () => createTaskSource(),
        normalizeSubAgentSessions: (subAgents) => subAgents ?? [],
        buildGovernanceSummary: () => ({
          state: "action_required",
          label: "Action required",
          summary: "Governance evidence recorded.",
          blocking: false,
          suggestedAction: "review_result",
          availableActions: ["review_result"],
        }),
        buildMissionLineage: ({ objective }) => createLineage(objective),
        buildRunLedger: () => createLedger(),
        buildPlacementEvidence: () => ({
          summary: "Workspace-default backend confirmed.",
          lifecycleState: "confirmed",
          resolutionSource: "workspace_default",
          requestedBackendIds: ["backend-primary"],
          resolvedBackendId: "backend-primary",
          readiness: "ready",
          healthSummary: "placement_ready",
          attentionReasons: [],
          rationale: "Primary backend remained healthy.",
        }),
        buildRunOperatorSnapshot: () => null,
        buildRunWorkspaceEvidence: ({ run }) => ({
          summary: `Workspace evidence for ${run.id}`,
          buckets: [],
        }),
        projectRuntimeExecutionGraphSummary: () => null,
        projectAgentTaskStatusToRunState: () => "review_ready",
        isTerminalRunState: (state) => state === "review_ready",
        resolveMissionTaskId: (taskId, threadId) => threadId ?? `runtime-task:${taskId}`,
        buildRunPublishHandoff: () => null,
        buildMissionRunCheckpoint: () => null,
      },
      {
        subAgents: [createSubAgent("sub-1")],
        workspaceRoot: "/repo",
      }
    );

    expect(run).toMatchObject({
      id: "run-1",
      taskId: "thread-1",
      state: "review_ready",
      reviewPackId: "review-pack:run-1",
      continuation: null,
      nextOperatorAction: {
        action: "review",
        label: "Review the evidence",
      },
      workspaceEvidence: {
        summary: "Workspace evidence for run-1",
      },
      subAgents: [expect.objectContaining({ sessionId: "sub-1" })],
    });
  });
});
