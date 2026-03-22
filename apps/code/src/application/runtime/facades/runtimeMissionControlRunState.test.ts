import { describe, expect, it } from "vitest";
import type { AgentTaskSummary, HugeCodeRunSummary } from "@ku0/code-runtime-host-contract";
import {
  buildApprovalSummary,
  buildGovernanceSummary,
  buildInterventionSummary,
  buildNextAction,
  buildOperatorState,
  buildReviewDecisionSummary,
  formatHugeCodeRunStateLabel,
} from "./runtimeMissionControlRunState";

function createTask(overrides: Partial<AgentTaskSummary> = {}): AgentTaskSummary {
  return {
    taskId: "task-1",
    workspaceId: "ws-1",
    threadId: null,
    requestId: null,
    title: "Task",
    status: "queued",
    accessMode: "on-request",
    executionMode: "single",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    routedProvider: "openai",
    routedModelId: "gpt-5.3-codex",
    routedPool: null,
    routedSource: "workspace-default",
    currentStep: 0,
    createdAt: 1,
    updatedAt: 1,
    startedAt: null,
    completedAt: null,
    errorCode: null,
    errorMessage: null,
    pendingApprovalId: null,
    steps: [],
    ...overrides,
  };
}

const readyRouting: NonNullable<HugeCodeRunSummary["routing"]> = {
  backendId: null,
  provider: "openai",
  providerLabel: "OpenAI",
  pool: "codex",
  routeLabel: "OpenAI / codex",
  routeHint: "Workspace route is ready.",
  health: "ready",
  enabledAccountCount: 1,
  readyAccountCount: 1,
  enabledPoolCount: 1,
};

describe("runtimeMissionControlRunState", () => {
  it("formats canonical run states through one shared helper", () => {
    expect(formatHugeCodeRunStateLabel("draft")).toBe("Draft");
    expect(formatHugeCodeRunStateLabel("needs_input")).toBe("Needs input");
    expect(formatHugeCodeRunStateLabel("review_ready")).toBe("Review ready");
    expect(formatHugeCodeRunStateLabel("cancelled")).toBe("Cancelled");
  });

  it("builds a pending approval summary and follow-up action", () => {
    const task = createTask({
      status: "awaiting_approval",
      pendingApprovalId: "approval-1",
      steps: [
        {
          index: 0,
          kind: "diagnostics",
          role: "planner",
          status: "completed",
          message: "Need approval",
          runId: null,
          output: null,
          metadata: {
            approval: {
              requestReason: "Confirm write access.",
            },
          },
          startedAt: 1,
          updatedAt: 2,
          completedAt: 2,
          errorCode: null,
          errorMessage: null,
          approvalId: "approval-1",
        },
      ],
    });

    const approval = buildApprovalSummary(task);
    const intervention = buildInterventionSummary(task);

    expect(approval).toMatchObject({
      status: "pending_decision",
      approvalId: "approval-1",
      summary: "Confirm write access.",
    });
    expect(buildNextAction(task, approval, intervention, null)).toMatchObject({
      action: "continue_with_clarification",
      label: "Approve or reject this run",
    });
    expect(
      buildGovernanceSummary({
        runState: "needs_input",
        approval,
        reviewDecision: null,
        intervention,
        nextAction: buildNextAction(task, approval, intervention, null),
        completionReason: null,
      })
    ).toMatchObject({
      state: "awaiting_approval",
      blocking: true,
      suggestedAction: "continue_with_clarification",
    });
  });

  it("marks interrupted recovery runs as resumable", () => {
    const task = createTask({
      status: "interrupted",
      errorCode: "runtime_restart_recovery",
    });

    const intervention = buildInterventionSummary(task);

    expect(intervention.primaryAction).toBe("resume");
    expect(buildOperatorState(task, buildApprovalSummary(task), readyRouting, null)).toMatchObject({
      health: "attention",
      headline: "Run can resume from checkpoint",
    });
  });

  it("exposes pair-mode escalation when a reusable mission brief exists", () => {
    const task = createTask({
      status: "completed",
      title: "Refine review flow",
      steps: [
        {
          index: 0,
          kind: "read",
          role: "planner",
          status: "completed",
          message: "Inspect current review loop.",
          runId: null,
          output: "Inspect current review loop.",
          metadata: {},
          startedAt: 1,
          updatedAt: 1,
          completedAt: 1,
          errorCode: null,
          errorMessage: null,
          approvalId: null,
        },
      ],
    });

    const intervention = buildInterventionSummary(task);
    const pairModeAction = intervention.actions.find(
      (action) => action.action === "escalate_to_pair_mode"
    );

    expect(pairModeAction).toMatchObject({
      action: "escalate_to_pair_mode",
      enabled: true,
      supported: true,
      reason: null,
    });
  });

  it("surfaces accepted review decisions as healthy operator state", () => {
    const task = createTask({
      status: "completed",
      reviewDecision: {
        status: "accepted",
        reviewPackId: "review-pack:task-1",
        label: "Accepted",
        summary: "Looks good.",
        decidedAt: 10,
      },
    });

    const reviewDecision = buildReviewDecisionSummary(task, "review_ready");

    expect(reviewDecision).toMatchObject({
      status: "accepted",
      reviewPackId: "review-pack:task-1",
    });
    expect(
      buildOperatorState(task, buildApprovalSummary(task), readyRouting, reviewDecision)
    ).toMatchObject({
      health: "healthy",
      headline: "Result accepted in review",
    });
    expect(
      buildGovernanceSummary({
        runState: "review_ready",
        approval: buildApprovalSummary(task),
        reviewDecision,
        intervention: buildInterventionSummary(task),
        nextAction: buildNextAction(
          task,
          buildApprovalSummary(task),
          buildInterventionSummary(task),
          reviewDecision
        ),
        completionReason: "Looks good.",
      })
    ).toMatchObject({
      state: "completed",
      blocking: false,
      availableActions: [],
    });
  });

  it("marks review-ready runs as awaiting review with explicit governance actions", () => {
    const task = createTask({
      status: "completed",
      title: "Refine review flow",
    });
    const approval = buildApprovalSummary(task);
    const reviewDecision = buildReviewDecisionSummary(task, "review_ready");
    const intervention = buildInterventionSummary(task);
    const nextAction = buildNextAction(task, approval, intervention, reviewDecision);

    expect(
      buildGovernanceSummary({
        runState: "review_ready",
        approval,
        reviewDecision,
        intervention,
        nextAction,
        completionReason: "Run completed.",
      })
    ).toMatchObject({
      state: "awaiting_review",
      blocking: true,
      suggestedAction: "review_result",
      availableActions: expect.arrayContaining(["accept_result", "reject_result", "retry"]),
    });
  });

  it("elevates parent governance when a sub-agent is blocked", () => {
    const task = createTask({
      status: "running",
      title: "Delegate targeted verification",
    });
    const approval = buildApprovalSummary(task);
    const intervention = buildInterventionSummary(task);
    const nextAction = buildNextAction(task, approval, intervention, null);

    expect(
      buildGovernanceSummary({
        runState: "running",
        approval,
        reviewDecision: null,
        intervention,
        nextAction,
        completionReason: null,
        subAgents: [
          {
            sessionId: "sub-agent-1",
            parentRunId: "task-1",
            scopeProfile: "review",
            status: "awaiting_approval",
            approvalState: {
              status: "pending_decision",
            },
            checkpointState: null,
            summary: "Waiting for operator approval before continuing delegated review.",
            timedOutReason: null,
            interruptedReason: null,
          },
        ],
      })
    ).toMatchObject({
      state: "awaiting_approval",
      blocking: true,
      suggestedAction: "continue_with_clarification",
      summary: "Waiting for operator approval before continuing delegated review.",
    });
  });

  it("marks parent governance as action required when a sub-agent times out", () => {
    const task = createTask({
      status: "running",
      title: "Delegate targeted verification",
    });
    const approval = buildApprovalSummary(task);
    const intervention = buildInterventionSummary(task);
    const nextAction = buildNextAction(task, approval, intervention, null);

    expect(
      buildGovernanceSummary({
        runState: "running",
        approval,
        reviewDecision: null,
        intervention,
        nextAction,
        completionReason: null,
        subAgents: [
          {
            sessionId: "sub-agent-2",
            parentRunId: "task-1",
            scopeProfile: "review",
            status: "failed",
            approvalState: null,
            checkpointState: null,
            summary: "Delegated validation stopped after timeout.",
            timedOutReason: "Sub-agent exceeded the max delegated task window.",
            interruptedReason: null,
          },
        ],
      })
    ).toMatchObject({
      state: "action_required",
      blocking: true,
      suggestedAction: "retry",
      summary: "Sub-agent exceeded the max delegated task window.",
    });
  });
});
