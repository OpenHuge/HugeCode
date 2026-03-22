import type {
  AccessMode,
  CollaborationModeOption,
  ComposerExecutionMode,
  RequestUserInputRequest,
} from "../../../types";

export type ComposerWorkflowTone = "neutral" | "live" | "warning" | "success";

export type ComposerWorkflowState = {
  label: string;
  detail: string;
  tone: ComposerWorkflowTone;
  tags: string[];
};

function formatAccessModeLabel(mode: AccessMode): string {
  switch (mode) {
    case "read-only":
      return "Read only";
    case "full-access":
      return "Full access";
    default:
      return "On-request";
  }
}

function formatExecutionModeLabel(
  mode: ComposerExecutionMode,
  options: Array<{ value: ComposerExecutionMode; label: string; disabled?: boolean }>
): string {
  return options.find((entry) => entry.value === mode)?.label ?? mode;
}

export function buildComposerWorkflowState({
  collaborationModes,
  selectedCollaborationModeId,
  accessMode,
  executionOptions,
  selectedExecutionMode,
  selectedEffort,
  queuedCount,
  isProcessing,
  canQueueInFlight,
  pendingUserInputRequest,
  pendingUserInputRequestIndex,
  pendingUserInputRequestCount,
  pendingQuestionIndex,
  pendingQuestionCount,
  pendingApprovalActive,
  pendingToolCallActive,
  pendingPlanReviewActive,
}: {
  collaborationModes: CollaborationModeOption[];
  selectedCollaborationModeId: string | null;
  accessMode: AccessMode;
  executionOptions: Array<{ value: ComposerExecutionMode; label: string; disabled?: boolean }>;
  selectedExecutionMode: ComposerExecutionMode;
  selectedEffort: string | null;
  queuedCount: number;
  isProcessing: boolean;
  canQueueInFlight: boolean;
  pendingUserInputRequest: RequestUserInputRequest | null;
  pendingUserInputRequestIndex: number;
  pendingUserInputRequestCount: number;
  pendingQuestionIndex: number;
  pendingQuestionCount: number;
  pendingApprovalActive: boolean;
  pendingToolCallActive: boolean;
  pendingPlanReviewActive: boolean;
}) {
  const planModeId =
    collaborationModes.find((mode) => mode.label.toLowerCase() === "plan")?.id ?? null;
  const isPlanModeSelected = Boolean(planModeId && selectedCollaborationModeId === planModeId);
  const tags = [
    isPlanModeSelected ? "Plan mode" : "Chat mode",
    formatAccessModeLabel(accessMode),
    formatExecutionModeLabel(selectedExecutionMode, executionOptions),
    selectedEffort ? `${selectedEffort} reasoning` : null,
    queuedCount > 0 ? `${queuedCount} queued` : null,
  ].filter((value): value is string => Boolean(value));

  if (pendingUserInputRequest) {
    return {
      label: `Pending answers ${pendingQuestionIndex + 1}/${pendingQuestionCount}`,
      detail:
        pendingUserInputRequestCount > 1
          ? `Request ${pendingUserInputRequestIndex} of ${pendingUserInputRequestCount} is waiting in the main draft field. Select an option or type a custom answer without losing your existing prompt.`
          : "Answer the active question in the main draft field. Your original draft is preserved and returns as soon as the request is resolved.",
      tone: "warning" as const,
      tags,
    };
  }
  if (pendingApprovalActive) {
    return {
      label: "Approval required",
      detail:
        "Review the requested command, then accept or decline from the same composer surface so the execution flow stays in one place.",
      tone: "warning" as const,
      tags,
    };
  }
  if (pendingToolCallActive) {
    return {
      label: "Tool output needed",
      detail:
        "Inspect the requested tool call, capture the output here, and send the result back without switching panels.",
      tone: "warning" as const,
      tags,
    };
  }
  if (pendingPlanReviewActive) {
    return {
      label: "Plan ready",
      detail:
        "Refine the proposed route or implement it directly from the composer so planning and execution stay aligned.",
      tone: "success" as const,
      tags,
    };
  }
  if (isProcessing) {
    return {
      label: "Run active",
      detail: canQueueInFlight
        ? "The current run is in flight. Keep drafting here and use queue to line up the next step instead of waiting for the agent to finish."
        : "The current run is in flight. The composer keeps your next instruction ready while the agent works.",
      tone: "live" as const,
      tags,
    };
  }
  return {
    label: isPlanModeSelected ? "Plan composer" : "Ready to send",
    detail: isPlanModeSelected
      ? "Shape the route first, then hand off implementation once the plan reads cleanly."
      : "Draft the next instruction here, then route it with the controls below before sending it to the workspace agent.",
    tone: "neutral" as const,
    tags,
  };
}
