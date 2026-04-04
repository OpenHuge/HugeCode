import type {
  AgentTaskSummary,
  HugeCodeGovernanceAction,
  HugeCodeSubAgentSummary,
  HugeCodeRunState,
  HugeCodeRunSummary,
} from "@ku0/code-runtime-host-contract";
import {
  buildTaskCheckpointState,
  isTaskCheckpointResumeReady,
} from "./runtimeMissionControlCheckpoint";

export function formatHugeCodeRunStateLabel(state: HugeCodeRunState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "queued":
      return "Queued";
    case "preparing":
      return "Preparing";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "needs_input":
      return "Needs input";
    case "validating":
      return "Validating";
    case "review_ready":
      return "Review ready";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

function isTerminalRunState(state: HugeCodeRunState): boolean {
  return state === "review_ready" || state === "failed" || state === "cancelled";
}

export function isRecoverableRuntimeTask(
  task: Pick<AgentTaskSummary, "status" | "errorCode" | "recovered" | "checkpointState">
) {
  return task.status === "interrupted" && isTaskCheckpointResumeReady(task);
}

function findLatestApprovalSummary(task: AgentTaskSummary) {
  const steps = [...(task.steps ?? [])].reverse();
  for (const step of steps) {
    const approval = step.metadata?.approval;
    if (!approval) {
      continue;
    }
    return approval;
  }
  return null;
}

export function buildApprovalSummary(
  task: AgentTaskSummary
): NonNullable<HugeCodeRunSummary["approval"]> {
  if (task.approvalState) {
    return task.approvalState;
  }
  const latestApproval = findLatestApprovalSummary(task);
  if (task.pendingApprovalId || task.status === "awaiting_approval") {
    return {
      status: "pending_decision",
      approvalId: task.pendingApprovalId,
      label: "Awaiting approval",
      summary:
        latestApproval?.requestReason?.trim() ||
        "This run is waiting for an operator decision before it can continue.",
    };
  }
  if (latestApproval?.resolutionStatus === "approved" || latestApproval?.decision === "approved") {
    return {
      status: "approved",
      approvalId: null,
      label: "Approval resolved",
      summary: latestApproval.resolutionReason?.trim() || "Approval was granted for this run.",
    };
  }
  if (latestApproval?.resolutionStatus === "rejected" || latestApproval?.decision === "rejected") {
    return {
      status: "rejected",
      approvalId: null,
      label: "Approval rejected",
      summary:
        latestApproval.resolutionReason?.trim() ||
        "A required approval was rejected and the run could not continue.",
    };
  }
  return {
    status: "not_required",
    approvalId: null,
    label: "No pending approval",
    summary: "This run does not currently require an approval decision.",
  };
}

export function buildReviewDecisionSummary(
  task: AgentTaskSummary,
  runState: HugeCodeRunState
): NonNullable<HugeCodeRunSummary["reviewDecision"]> | null {
  if (!isTerminalRunState(runState)) {
    return null;
  }
  if (task.reviewDecision) {
    return task.reviewDecision;
  }
  return {
    status: "pending",
    reviewPackId: `review-pack:${task.taskId}`,
    label: "Decision pending",
    summary: "Accept or reject this result from the review surface.",
    decidedAt: null,
  };
}

export function buildInterventionSummary(
  task: AgentTaskSummary
): NonNullable<HugeCodeRunSummary["intervention"]> {
  if (task.intervention) {
    return task.intervention;
  }
  const hasReplayableBrief =
    Boolean(task.title?.trim()) ||
    (task.steps ?? []).some(
      (step) => step.message.trim().length > 0 || Boolean(step.output?.trim())
    );
  const isRecoverable = isRecoverableRuntimeTask(task);
  const checkpoint = buildTaskCheckpointState(task);
  const actions = [
    {
      action: "pause" as const,
      label: "Pause",
      enabled: task.status === "running",
      supported: true,
      reason: null,
    },
    {
      action: "resume" as const,
      label: "Resume",
      enabled: task.status === "paused" || isRecoverable,
      supported: true,
      reason:
        task.status === "paused" || isRecoverable
          ? null
          : (checkpoint?.summary ?? "Only paused or recoverable interrupted runs can resume."),
    },
    {
      action: "cancel" as const,
      label: "Cancel",
      enabled:
        task.status === "queued" ||
        task.status === "running" ||
        task.status === "paused" ||
        task.status === "awaiting_approval",
      supported: true,
      reason: null,
    },
    {
      action: "retry" as const,
      label: "Retry",
      enabled: hasReplayableBrief,
      supported: hasReplayableBrief,
      reason: hasReplayableBrief ? null : "Retry needs a reusable mission brief.",
    },
    {
      action: "continue_with_clarification" as const,
      label: "Clarify",
      enabled: hasReplayableBrief,
      supported: hasReplayableBrief,
      reason: hasReplayableBrief ? null : "Clarification needs a reusable mission brief.",
    },
    {
      action: "narrow_scope" as const,
      label: "Narrow scope",
      enabled: hasReplayableBrief,
      supported: hasReplayableBrief,
      reason: hasReplayableBrief ? null : "Scope adjustment needs a reusable mission brief.",
    },
    {
      action: "relax_validation" as const,
      label: "Relax validation",
      enabled: hasReplayableBrief,
      supported: hasReplayableBrief,
      reason: hasReplayableBrief ? null : "Validation changes need a reusable mission brief.",
    },
    {
      action: "switch_profile_and_retry" as const,
      label: "Switch profile",
      enabled: hasReplayableBrief,
      supported: hasReplayableBrief,
      reason: hasReplayableBrief ? null : "Profile switching needs a reusable mission brief.",
    },
    {
      action: "escalate_to_pair_mode" as const,
      label: "Escalate to pair mode",
      enabled: hasReplayableBrief,
      supported: hasReplayableBrief,
      reason: hasReplayableBrief ? null : "Pair-mode escalation needs a reusable mission brief.",
    },
  ];

  let primaryAction: NonNullable<HugeCodeRunSummary["intervention"]>["primaryAction"] = null;
  if (task.pendingApprovalId || task.status === "awaiting_approval") {
    primaryAction = "continue_with_clarification";
  } else if (task.status === "paused") {
    primaryAction = "resume";
  } else if (isRecoverable) {
    primaryAction = "resume";
  } else if (
    task.status === "failed" ||
    task.status === "completed" ||
    task.status === "cancelled"
  ) {
    primaryAction = "retry";
  } else if (task.status === "running" || task.status === "queued") {
    primaryAction = "cancel";
  }

  return {
    actions,
    primaryAction,
  };
}

export function buildOperatorState(
  task: AgentTaskSummary,
  approval: NonNullable<HugeCodeRunSummary["approval"]>,
  routing: NonNullable<HugeCodeRunSummary["routing"]>,
  reviewDecision: NonNullable<HugeCodeRunSummary["reviewDecision"]> | null
): NonNullable<HugeCodeRunSummary["operatorState"]> {
  if (reviewDecision?.status === "accepted") {
    return {
      health: "healthy",
      headline: "Result accepted in review",
      detail: reviewDecision.summary,
    };
  }
  if (reviewDecision?.status === "rejected") {
    return {
      health: "attention",
      headline: "Result rejected in review",
      detail: reviewDecision.summary,
    };
  }
  if (approval.status === "pending_decision") {
    return {
      health: "blocked",
      headline: "Operator decision required",
      detail: approval.summary,
    };
  }
  if (routing.health === "blocked") {
    return {
      health: "blocked",
      headline: "Routing is blocking execution",
      detail: routing.routeHint,
    };
  }
  if (task.status === "failed") {
    return {
      health: "attention",
      headline: "Run failed",
      detail: task.errorMessage?.trim() || "Inspect the run and relaunch or switch profile.",
    };
  }
  if (isRecoverableRuntimeTask(task)) {
    const checkpoint = buildTaskCheckpointState(task);
    return {
      health: "attention",
      headline: "Run can resume from checkpoint",
      detail:
        checkpoint?.summary ??
        "Resume is available because runtime recovery preserved checkpoint state.",
    };
  }
  if (task.status === "paused") {
    const checkpoint = buildTaskCheckpointState(task);
    return {
      health: "attention",
      headline: "Run paused",
      detail:
        checkpoint?.summary ??
        "Resume when you want the route to continue from the latest checkpoint.",
    };
  }
  return {
    health: routing.health === "ready" ? "healthy" : "attention",
    headline: routing.health === "ready" ? "Run is controllable" : "Run needs operator attention",
    detail: routing.health === "ready" ? null : routing.routeHint,
  };
}

export function buildNextAction(
  task: AgentTaskSummary,
  approval: NonNullable<HugeCodeRunSummary["approval"]>,
  intervention: NonNullable<HugeCodeRunSummary["intervention"]>,
  reviewDecision: NonNullable<HugeCodeRunSummary["reviewDecision"]> | null
): NonNullable<HugeCodeRunSummary["nextAction"]> {
  if (reviewDecision?.status === "accepted") {
    return {
      label: "Review accepted",
      action: "review",
      detail: reviewDecision.summary,
    };
  }
  if (reviewDecision?.status === "rejected") {
    return {
      label: "Review rejected",
      action: "review",
      detail: reviewDecision.summary,
    };
  }
  if (approval.status === "pending_decision") {
    return {
      label: "Approve or reject this run",
      action: "continue_with_clarification",
      detail: approval.summary,
    };
  }
  if (task.status === "completed") {
    return {
      label: "Review the result",
      action: "review",
      detail: "The run finished and is ready for operator review.",
    };
  }
  if (task.status === "paused") {
    const checkpoint = buildTaskCheckpointState(task);
    return {
      label: "Resume paused route",
      action: "resume",
      detail:
        checkpoint?.summary ?? "This run is paused and can continue from its latest checkpoint.",
    };
  }
  if (intervention.primaryAction === "resume") {
    const checkpoint = buildTaskCheckpointState(task);
    return {
      label: "Resume from checkpoint",
      action: "resume",
      detail: checkpoint?.summary ?? "Runtime recovery preserved state for this interrupted run.",
    };
  }
  if (intervention.primaryAction === "retry") {
    return {
      label: "Retry with the current brief",
      action: "retry",
      detail: "Launch a new run from the prior mission brief or switch profile first.",
    };
  }
  if (intervention.primaryAction === "cancel") {
    return {
      label: "Continue monitoring or cancel",
      action: "cancel",
      detail: "This run is still active and can be interrupted from Mission Control.",
    };
  }
  return {
    label: "Inspect run state",
    action: "review",
    detail: task.errorMessage?.trim() || null,
  };
}

function pushUniqueAction(
  target: HugeCodeGovernanceAction[],
  value: HugeCodeGovernanceAction | null
) {
  if (value === null || target.includes(value)) {
    return;
  }
  target.push(value);
}

function readSubAgentApprovalStatus(subAgent: HugeCodeSubAgentSummary): string | null {
  const approvalState = subAgent.approvalState;
  if (!approvalState) {
    return null;
  }
  return typeof approvalState === "string" ? approvalState : (approvalState.status ?? null);
}

function buildSubAgentGovernanceSummary(subAgents: HugeCodeSubAgentSummary[] | null | undefined): {
  state: "awaiting_approval" | "action_required";
  label: string;
  summary: string;
  suggestedAction: HugeCodeGovernanceAction | null;
} | null {
  if (!subAgents || subAgents.length === 0) {
    return null;
  }

  const awaitingApproval = subAgents.find(
    (subAgent) =>
      subAgent.status === "awaiting_approval" ||
      readSubAgentApprovalStatus(subAgent) === "pending_decision"
  );
  if (awaitingApproval) {
    return {
      state: "awaiting_approval",
      label: "Sub-agent awaiting approval",
      summary:
        awaitingApproval.summary?.trim() ||
        `Sub-agent ${awaitingApproval.sessionId} is waiting for approval before the parent run can continue.`,
      suggestedAction: "continue_with_clarification",
    };
  }

  const timedOut = subAgents.find((subAgent) => Boolean(subAgent.timedOutReason?.trim()));
  if (timedOut) {
    return {
      state: "action_required",
      label: "Sub-agent timed out",
      summary:
        timedOut.timedOutReason?.trim() ||
        timedOut.summary?.trim() ||
        `Sub-agent ${timedOut.sessionId} timed out and blocked the parent run.`,
      suggestedAction: "retry",
    };
  }

  const blocked = subAgents.find((subAgent) =>
    ["failed", "cancelled", "interrupted"].includes(subAgent.status)
  );
  if (blocked) {
    return {
      state: "action_required",
      label: "Sub-agent requires operator action",
      summary:
        blocked.interruptedReason?.trim() ||
        blocked.summary?.trim() ||
        `Sub-agent ${blocked.sessionId} requires operator intervention before the parent run should continue.`,
      suggestedAction: "retry",
    };
  }

  return null;
}

export function buildGovernanceSummary(input: {
  runState: HugeCodeRunState;
  approval: NonNullable<HugeCodeRunSummary["approval"]>;
  reviewDecision: NonNullable<HugeCodeRunSummary["reviewDecision"]> | null;
  intervention: NonNullable<HugeCodeRunSummary["intervention"]>;
  nextAction: NonNullable<HugeCodeRunSummary["nextAction"]>;
  completionReason?: string | null;
  subAgents?: HugeCodeSubAgentSummary[] | null;
}): NonNullable<HugeCodeRunSummary["governance"]> {
  const availableActions: HugeCodeGovernanceAction[] = [];
  for (const action of input.intervention.actions) {
    if (action.enabled && action.supported) {
      pushUniqueAction(availableActions, action.action);
    }
  }
  if (input.reviewDecision?.status === "pending") {
    pushUniqueAction(availableActions, "review_result");
    pushUniqueAction(availableActions, "accept_result");
    pushUniqueAction(availableActions, "reject_result");
  }

  if (input.reviewDecision?.status === "accepted") {
    return {
      state: "completed",
      label: "Governance complete",
      summary: input.reviewDecision.summary,
      blocking: false,
      suggestedAction: null,
      availableActions: [],
    };
  }

  const subAgentGovernance = buildSubAgentGovernanceSummary(input.subAgents);
  if (subAgentGovernance) {
    return {
      state: subAgentGovernance.state,
      label: subAgentGovernance.label,
      summary: subAgentGovernance.summary,
      blocking: true,
      suggestedAction: subAgentGovernance.suggestedAction,
      availableActions,
    };
  }

  if (input.approval.status === "pending_decision") {
    return {
      state: "awaiting_approval",
      label: "Awaiting approval",
      summary: input.approval.summary,
      blocking: true,
      suggestedAction:
        input.nextAction.action === "review" ? "review_result" : input.nextAction.action,
      availableActions,
    };
  }

  if (input.runState === "review_ready" && input.reviewDecision?.status === "pending") {
    return {
      state: "awaiting_review",
      label: "Awaiting review decision",
      summary: input.reviewDecision.summary,
      blocking: true,
      suggestedAction: "review_result",
      availableActions,
    };
  }

  if (
    input.reviewDecision?.status === "rejected" ||
    input.runState === "failed" ||
    input.runState === "cancelled" ||
    input.runState === "paused" ||
    input.runState === "needs_input"
  ) {
    return {
      state: "action_required",
      label: "Operator action required",
      summary:
        input.reviewDecision?.summary ??
        input.completionReason ??
        input.nextAction.detail ??
        "This run needs explicit operator intervention before it should continue.",
      blocking: true,
      suggestedAction:
        input.reviewDecision?.status === "rejected"
          ? (input.intervention.primaryAction ?? "review_result")
          : input.nextAction.action === "review"
            ? "review_result"
            : input.nextAction.action,
      availableActions,
    };
  }

  return {
    state: "in_progress",
    label: "Runtime-governed execution",
    summary:
      input.nextAction.detail ??
      "The runtime is still executing this run and can surface an intervention when needed.",
    blocking: false,
    suggestedAction:
      input.nextAction.action === "review" ? "review_result" : input.nextAction.action,
    availableActions,
  };
}
