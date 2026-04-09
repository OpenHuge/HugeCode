import { useCallback, useState } from "react";
import { useWorkspaceRuntimeAgentControl } from "../../../application/runtime/ports/runtimeAgentControl";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../../../utils/runtimeWorkspaceIds";
import type { ReviewPackDetailModel } from "@ku0/code-application/runtimeReviewPackSurfaceModel";

export type ReviewPackDecisionSubmissionState = {
  reviewPackId: string | null;
  actionId: "accept" | "reject" | null;
  phase: "idle" | "submitting" | "recorded" | "error";
  recordedStatus: "approved" | "rejected" | null;
  recordedAt: number | null;
  error: string | null;
  warning: string | null;
};

type ReviewPackDecisionAction = ReviewPackDetailModel["decisionActions"][number];

function formatReviewDecisionError(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Review decision could not be recorded.";
}

function formatReviewRefreshWarning(error: unknown) {
  void error;
  return "Decision recorded, but mission control could not be refreshed yet.";
}

export function useReviewPackDecisionActions(input: {
  workspaceId: string | null;
  onRefresh?: (() => void | Promise<void>) | null;
}) {
  const runtimeControl = useWorkspaceRuntimeAgentControl(
    (input.workspaceId ?? DEFAULT_RUNTIME_WORKSPACE_ID) as Parameters<
      typeof useWorkspaceRuntimeAgentControl
    >[0]
  );
  const [submission, setSubmission] = useState<ReviewPackDecisionSubmissionState>({
    reviewPackId: null,
    actionId: null,
    phase: "idle",
    recordedStatus: null,
    recordedAt: null,
    error: null,
    warning: null,
  });

  const submitDecision = useCallback(
    async (inputAction: { reviewPackId: string; action: ReviewPackDecisionAction }) => {
      if (inputAction.action.id !== "accept" && inputAction.action.id !== "reject") {
        return;
      }
      const actionTarget = inputAction.action.actionTarget;
      if (!actionTarget || actionTarget.kind !== "review_decision") {
        setSubmission({
          reviewPackId: inputAction.reviewPackId,
          actionId: inputAction.action.id,
          phase: "error",
          recordedStatus: null,
          recordedAt: null,
          error: inputAction.action.disabledReason ?? "Review action is unavailable.",
          warning: null,
        });
        return;
      }

      setSubmission({
        reviewPackId: inputAction.reviewPackId,
        actionId: inputAction.action.id,
        phase: "submitting",
        recordedStatus: null,
        recordedAt: null,
        error: null,
        warning: null,
      });

      const submitActionRequiredDecision = runtimeControl.actionRequiredSubmitV2;
      if (!submitActionRequiredDecision) {
        setSubmission({
          reviewPackId: inputAction.reviewPackId,
          actionId: inputAction.action.id,
          phase: "error",
          recordedStatus: null,
          recordedAt: null,
          error: "Review decisions are not supported by this runtime.",
          warning: null,
        });
        return;
      }

      try {
        const recordedStatus = await submitActionRequiredDecision({
          requestId: actionTarget.requestId,
          kind: actionTarget.kind,
          status: actionTarget.status,
          reason: null,
        });
        if (recordedStatus !== actionTarget.status) {
          setSubmission({
            reviewPackId: inputAction.reviewPackId,
            actionId: inputAction.action.id,
            phase: "error",
            recordedStatus: null,
            recordedAt: null,
            error: `Runtime recorded review decision as ${recordedStatus}. Refresh mission control and verify the final state.`,
            warning: null,
          });
          return;
        }
        let warning: string | null = null;
        try {
          await input.onRefresh?.();
        } catch (refreshError) {
          warning = formatReviewRefreshWarning(refreshError);
        }
        setSubmission({
          reviewPackId: inputAction.reviewPackId,
          actionId: inputAction.action.id,
          phase: "recorded",
          recordedStatus,
          recordedAt: Date.now(),
          error: null,
          warning,
        });
      } catch (error) {
        setSubmission({
          reviewPackId: inputAction.reviewPackId,
          actionId: inputAction.action.id,
          phase: "error",
          recordedStatus: null,
          recordedAt: null,
          error: formatReviewDecisionError(error),
          warning: null,
        });
      }
    },
    [input.onRefresh, runtimeControl]
  );

  return {
    submission,
    submitDecision,
  };
}
