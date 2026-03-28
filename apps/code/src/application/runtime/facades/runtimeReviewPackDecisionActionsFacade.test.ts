import { describe, expect, it } from "vitest";
import {
  buildRuntimeReviewPackFollowUpState,
  buildRuntimeReviewPackDecisionActions,
  buildRuntimeReviewPackInterventionDecisionActions,
} from "./runtimeReviewPackDecisionActionsFacade";

describe("runtimeReviewPackDecisionActionsFacade", () => {
  it("builds registry-driven intervention actions with clarify-specific instructions", () => {
    const actions = buildRuntimeReviewPackInterventionDecisionActions({
      navigationTarget: {
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
      readOnlyReason: null,
      runtimeInterventionsSupported: true,
      nextActionDetail: "Retry the run with the recorded context.",
      title: "Retry run",
      instruction: "Investigate the failure and continue.",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-1"],
      sourceTaskId: "task-1",
      sourceRunId: "run-1",
      sourceReviewPackId: "review-pack-1",
      reviewActionability: {
        state: "ready",
        summary: "Runtime review actionability is ready.",
        degradedReasons: [],
        actions: [
          { action: "retry", enabled: true, supported: true, reason: null },
          {
            action: "continue_with_clarification",
            enabled: true,
            supported: true,
            reason: null,
          },
          {
            action: "switch_profile_and_retry",
            enabled: false,
            supported: true,
            reason: "Choose another execution profile first.",
          },
          { action: "escalate_to_pair_mode", enabled: true, supported: true, reason: null },
        ],
      },
      actions: [
        {
          action: "retry",
          enabled: true,
          supported: true,
          reason: null,
        },
        {
          action: "continue_with_clarification",
          enabled: true,
          supported: true,
          reason: null,
        },
        {
          action: "switch_profile_and_retry",
          enabled: false,
          supported: true,
          reason: "Choose another execution profile first.",
        },
        {
          action: "escalate_to_pair_mode",
          enabled: true,
          supported: true,
          reason: null,
        },
      ],
    });

    expect(actions.map((action) => action.id)).toEqual([
      "retry",
      "clarify",
      "switch_profile_and_retry",
      "continue_in_pair",
    ]);
    expect(actions[0]?.enabled).toBe(true);
    expect(actions[0]?.interventionDraft?.intent).toBe("retry");
    expect(actions[1]?.interventionDraft?.instruction).toContain("Clarify before continuing");
    expect(actions[2]?.enabled).toBe(false);
    expect(actions[2]?.disabledReason).toBe("Choose another execution profile first.");
    expect(actions[3]?.interventionDraft?.intent).toBe("pair_mode");
  });

  it("blocks accept and reject actions when evidence is incomplete", () => {
    const actions = buildRuntimeReviewPackDecisionActions({
      reviewDecision: {
        status: "pending",
        reviewPackId: "review-pack-1",
        summary: "",
      },
      evidenceState: "incomplete",
      reviewStatus: "incomplete_evidence",
      readOnlyReason: null,
      interventionActions: [],
    });

    expect(actions[0]).toMatchObject({
      id: "accept",
      enabled: false,
      disabledReason:
        "Runtime evidence is incomplete. Collect the missing review pack evidence before accepting or rejecting this result.",
    });
    expect(actions[1]).toMatchObject({
      id: "reject",
      enabled: false,
    });
  });

  it("builds a runtime follow-up bundle from placement and continuation defaults", () => {
    const state = buildRuntimeReviewPackFollowUpState({
      source: "runtime_snapshot_v1",
      placement: {
        requestedBackendIds: ["backend-1"],
        lifecycleState: "confirmed",
        readiness: "ready",
      },
      routingBackendId: "backend-fallback",
      contract: null,
      taskSource: {
        kind: "manual",
        title: "Mission",
      },
      runtimeDefaults: {
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack-1",
        executionProfileId: "balanced-delegate",
      },
      reviewActionability: {
        state: "ready",
        summary: "Runtime review actionability is ready.",
        degradedReasons: [],
        actions: [
          { action: "retry", enabled: true, supported: true, reason: null },
          { action: "accept_result", enabled: true, supported: true, reason: null },
          { action: "reject_result", enabled: true, supported: true, reason: null },
        ],
      },
      navigationTarget: {
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
      nextActionDetail: null,
      title: "Retry run",
      instruction: "Investigate the failure and continue.",
      actions: [
        {
          action: "retry",
          enabled: true,
          supported: true,
          reason: null,
        },
      ],
      reviewDecision: {
        status: "pending",
        reviewPackId: "review-pack-1",
        summary: "",
      },
      evidenceState: "confirmed",
      reviewStatus: "ready",
    });

    expect(state.readOnlyReason).toBeNull();
    expect(state.preferredBackendIds).toEqual(["backend-1"]);
    expect(state.continuationDefaults?.executionProfileId).toBe("balanced-delegate");
    expect(state.interventionActions[0]?.id).toBe("retry");
    expect(state.decisionActions[0]?.enabled).toBe(true);
  });

  it("surfaces when runtime review actionability is unavailable", () => {
    const state = buildRuntimeReviewPackFollowUpState({
      source: "runtime_snapshot_v1",
      placement: {
        requestedBackendIds: ["backend-1"],
        lifecycleState: "confirmed",
        readiness: "ready",
      },
      routingBackendId: "backend-fallback",
      contract: null,
      taskSource: {
        kind: "manual",
        title: "Mission",
      },
      runtimeDefaults: {
        sourceTaskId: "task-1",
        sourceRunId: "run-1",
        sourceReviewPackId: "review-pack-1",
        executionProfileId: "balanced-delegate",
      },
      navigationTarget: {
        kind: "review",
        workspaceId: "workspace-1",
        taskId: "task-1",
        runId: "run-1",
        reviewPackId: "review-pack-1",
      },
      nextActionDetail: null,
      title: "Retry run",
      instruction: "Investigate the failure and continue.",
      actions: [
        {
          action: "retry",
          enabled: true,
          supported: true,
          reason: null,
        },
      ],
      reviewDecision: {
        status: "pending",
        reviewPackId: "review-pack-1",
        summary: "",
      },
      evidenceState: "confirmed",
      reviewStatus: "ready",
    });

    expect(state.decisionActionability).toEqual({
      summary:
        "Canonical runtime review actionability is unavailable. Follow-up and review decisions stay disabled until runtime publishes the action set.",
      details: [
        "Decision source: Runtime review actionability unavailable.",
        "This surface no longer reconstructs follow-up actions or default review policy in page-local logic.",
      ],
      sourceLabel: "Runtime review actionability unavailable",
      usesFallback: false,
    });
    expect(state.interventionActions[0]?.enabled).toBe(false);
    expect(state.decisionActions[0]?.enabled).toBe(false);
  });
});
