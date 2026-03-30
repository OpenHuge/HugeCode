import { useEffect, useMemo, useState } from "react";
import { listRunExecutionProfiles } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import type { MissionInterventionDraft } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import type {
  MissionSurfaceDetailModel,
  ReviewPackDetailModel,
} from "../utils/reviewPackSurfaceModel";

export type PreparedInterventionDraft = {
  workspaceId: string;
  navigationTarget: ReviewPackDetailModel["navigationTarget"] | null;
  actionId: Exclude<ReviewPackDetailModel["decisionActions"][number]["id"], "accept" | "reject">;
  draft: MissionInterventionDraft;
};

export type ReviewAutomationTarget = {
  workspaceId: string;
  taskId: string;
  runId: string;
  reviewPackId?: string | null;
};

export type ReviewAutofixTarget = ReviewAutomationTarget & {
  autofixCandidate: {
    id: string;
    summary: string;
    status: "available" | "applied" | "blocked";
  };
};

export const DEFAULT_REVIEW_BACKEND_OPTION = "__mission-control_default_backend__";

export function useReviewPackSurfaceController(input: {
  detail: MissionSurfaceDetailModel | null;
  defaultInterventionBackendId: string | null;
  interventionBackendOptions: Array<{ value: string; label: string }>;
  onPrepareInterventionDraft: (input: {
    workspaceId: string;
    navigationTarget: ReviewPackDetailModel["navigationTarget"] | null;
    draft: MissionInterventionDraft;
  }) => unknown | Promise<unknown>;
  onLaunchInterventionDraft: (input: {
    workspaceId: string;
    navigationTarget: ReviewPackDetailModel["navigationTarget"] | null;
    draft: MissionInterventionDraft;
  }) => unknown | Promise<unknown>;
  onRunReviewAgent?: (input: ReviewAutomationTarget) => unknown | Promise<unknown>;
  onApplyReviewAutofix?: (input: ReviewAutofixTarget) => unknown | Promise<unknown>;
}) {
  const executionProfileOptions = useMemo(
    () =>
      listRunExecutionProfiles().map((profile) => ({
        value: profile.id,
        label: profile.name,
      })),
    []
  );
  const backendOptions = useMemo(
    () => [
      {
        value: DEFAULT_REVIEW_BACKEND_OPTION,
        label: input.defaultInterventionBackendId
          ? `Use default backend (${input.defaultInterventionBackendId})`
          : "Use default backend",
      },
      ...input.interventionBackendOptions,
    ],
    [input.defaultInterventionBackendId, input.interventionBackendOptions]
  );

  const [preparedIntervention, setPreparedIntervention] =
    useState<PreparedInterventionDraft | null>(null);
  const [interventionTitle, setInterventionTitle] = useState("");
  const [interventionInstruction, setInterventionInstruction] = useState("");
  const [interventionProfileId, setInterventionProfileId] = useState(
    executionProfileOptions[0]?.value ?? "balanced-delegate"
  );
  const [interventionBackendValue, setInterventionBackendValue] = useState(
    DEFAULT_REVIEW_BACKEND_OPTION
  );
  const [launchingIntervention, setLaunchingIntervention] = useState(false);
  const [focusedEvidenceBucketKind, setFocusedEvidenceBucketKind] = useState<string | null>(null);
  const [runningReviewAgentKey, setRunningReviewAgentKey] = useState<string | null>(null);
  const [applyingReviewAutofixKey, setApplyingReviewAutofixKey] = useState<string | null>(null);
  const [reviewAutomationError, setReviewAutomationError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !preparedIntervention ||
      !input.detail ||
      input.detail.kind === "mission_run" ||
      preparedIntervention.draft.sourceReviewPackId !== input.detail.id
    ) {
      setPreparedIntervention(null);
      setLaunchingIntervention(false);
    }
  }, [input.detail, preparedIntervention]);

  useEffect(() => {
    setFocusedEvidenceBucketKind(null);
    setReviewAutomationError(null);
    setRunningReviewAgentKey(null);
    setApplyingReviewAutofixKey(null);
  }, [input.detail]);

  function buildAutomationScopeKey(target: ReviewAutomationTarget) {
    return [target.workspaceId, target.taskId, target.runId, target.reviewPackId ?? ""].join(":");
  }

  async function handlePrepareInterventionDraft(next: PreparedInterventionDraft) {
    setPreparedIntervention(next);
    setInterventionTitle(next.draft.title);
    setInterventionInstruction(next.draft.instruction);
    setInterventionProfileId(next.draft.profileId);
    setInterventionBackendValue(
      next.draft.preferredBackendIds?.[0] ?? DEFAULT_REVIEW_BACKEND_OPTION
    );
    await input.onPrepareInterventionDraft(next);
  }

  async function handleLaunchPreparedInterventionDraft() {
    if (!preparedIntervention) {
      return;
    }
    setLaunchingIntervention(true);
    try {
      const trimmedTitle = interventionTitle.trim();
      const trimmedInstruction = interventionInstruction.trim();
      void trackProductAnalyticsEvent("manual_rescue_invoked", {
        workspaceId: preparedIntervention.workspaceId,
        taskId: preparedIntervention.draft.sourceTaskId,
        runId: preparedIntervention.draft.sourceRunId,
        reviewPackId: preparedIntervention.draft.sourceReviewPackId,
        decision: preparedIntervention.actionId,
        interventionKind: preparedIntervention.draft.intent,
        executionProfileId: interventionProfileId,
        backendId:
          interventionBackendValue === DEFAULT_REVIEW_BACKEND_OPTION
            ? (preparedIntervention.draft.preferredBackendIds?.[0] ?? null)
            : interventionBackendValue,
        eventSource: "review_surface",
      });
      await input.onLaunchInterventionDraft({
        workspaceId: preparedIntervention.workspaceId,
        navigationTarget: preparedIntervention.navigationTarget,
        draft: {
          ...preparedIntervention.draft,
          title: trimmedTitle,
          instruction:
            trimmedInstruction.length > 0
              ? trimmedInstruction
              : preparedIntervention.draft.instruction,
          profileId: interventionProfileId,
          preferredBackendIds:
            interventionBackendValue === DEFAULT_REVIEW_BACKEND_OPTION
              ? undefined
              : [interventionBackendValue],
        },
      });
      setPreparedIntervention(null);
    } finally {
      setLaunchingIntervention(false);
    }
  }

  function resetPreparedIntervention() {
    setPreparedIntervention(null);
    setLaunchingIntervention(false);
    setFocusedEvidenceBucketKind(null);
  }

  async function handleRunReviewAgent(target: ReviewAutomationTarget) {
    if (typeof input.onRunReviewAgent !== "function") {
      return;
    }
    const scopeKey = buildAutomationScopeKey(target);
    setReviewAutomationError(null);
    setRunningReviewAgentKey(scopeKey);
    try {
      void trackProductAnalyticsEvent("review_agent_requested", {
        workspaceId: target.workspaceId,
        taskId: target.taskId,
        runId: target.runId,
        reviewPackId: target.reviewPackId ?? null,
        eventSource: "review_surface",
      });
      await input.onRunReviewAgent(target);
    } catch (error) {
      setReviewAutomationError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setRunningReviewAgentKey((current) => (current === scopeKey ? null : current));
    }
  }

  async function handleApplyReviewAutofix(target: ReviewAutofixTarget) {
    if (typeof input.onApplyReviewAutofix !== "function") {
      return;
    }
    const scopeKey = buildAutomationScopeKey(target);
    setReviewAutomationError(null);
    setApplyingReviewAutofixKey(scopeKey);
    try {
      void trackProductAnalyticsEvent("review_autofix_requested", {
        workspaceId: target.workspaceId,
        taskId: target.taskId,
        runId: target.runId,
        reviewPackId: target.reviewPackId ?? null,
        autofixCandidateId: target.autofixCandidate.id,
        eventSource: "review_surface",
      });
      await input.onApplyReviewAutofix(target);
    } catch (error) {
      setReviewAutomationError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setApplyingReviewAutofixKey((current) => (current === scopeKey ? null : current));
    }
  }

  return {
    executionProfileOptions,
    backendOptions,
    preparedIntervention,
    interventionTitle,
    setInterventionTitle,
    interventionInstruction,
    setInterventionInstruction,
    interventionProfileId,
    setInterventionProfileId,
    interventionBackendValue,
    setInterventionBackendValue,
    launchingIntervention,
    focusedEvidenceBucketKind,
    setFocusedEvidenceBucketKind,
    reviewAutomationError,
    runningReviewAgentKey,
    applyingReviewAutofixKey,
    handlePrepareInterventionDraft,
    handleLaunchPreparedInterventionDraft,
    handleRunReviewAgent,
    handleApplyReviewAutofix,
    resetPreparedIntervention,
  };
}
