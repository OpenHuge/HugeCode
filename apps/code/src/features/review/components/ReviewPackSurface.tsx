import { useMemo } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Select,
  StatusBadge,
  Textarea,
  type StatusBadgeTone,
} from "../../../design-system";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import { formatRelativeTime } from "../../../utils/time";
import type {
  MissionControlFreshnessState,
  MissionNavigationTarget,
} from "../../missions/utils/missionControlPresentation";
import type { MissionReviewEntry } from "../../missions/utils/missionControlPresentation";
import { ReviewQueuePanel } from "./ReviewQueuePanel";
import * as styles from "./ReviewPackSurface.css";
import { CompactReviewEvidenceCard } from "./CompactReviewEvidenceCard";
import { ReviewPackSurfaceHero } from "./ReviewPackSurfaceHero";
import { buildCompactReviewEvidenceDescriptor } from "../utils/compactReviewEvidence";
import type {
  MissionRunDetailModel,
  MissionSurfaceDetailModel,
  ReviewPackDetailModel,
  ReviewPackSelectionState,
} from "../utils/reviewPackSurfaceModel";
import type { ReviewPackDecisionSubmissionState } from "../hooks/useReviewPackDecisionActions";
import type { MissionInterventionDraft } from "../../../application/runtime/facades/runtimeTaskInterventionDraftFacade";
import {
  buildDisplayedReviewDecision,
  getReviewFindings,
  getNavigationTargetButtonLabel,
  getNavigationTargetCardTitle,
  getNavigationTargetDescription,
  getSkillUsage,
  renderCopyList,
  renderControlDeviceHandoff,
  renderArtifacts,
  renderOperatorCockpit,
  renderPublishHandoff,
  renderRelaunchOptions,
  renderReviewFindings,
  renderReviewIntelligenceBlock,
  ReviewDetailSection,
  renderSkillUsage,
  renderSubAgentSummary,
  renderValidationItems,
  renderWarnings,
} from "./ReviewPackSurfaceSections";
import {
  ReviewLoopHeader,
  ReviewSignalGroup,
  ReviewSummaryCard,
} from "./review-loop/ReviewLoopAdapters";
import {
  type PreparedInterventionDraft,
  useReviewPackSurfaceController,
} from "./useReviewPackSurfaceController";

type ReviewAutomationTarget = {
  workspaceId: string;
  taskId: string;
  runId: string;
  reviewPackId?: string | null;
};

type ReviewAutofixTarget = ReviewAutomationTarget & {
  autofixCandidate: {
    id: string;
    summary: string;
    status: "available" | "applied" | "blocked";
  };
};

type ReviewAutomationCallbacks = {
  onRunReviewAgent?: (input: ReviewAutomationTarget) => unknown | Promise<unknown>;
  onApplyReviewAutofix?: (input: ReviewAutofixTarget) => unknown | Promise<unknown>;
};

type ReviewAutomationState = {
  runningReviewAgentKey: string | null;
  applyingReviewAutofixKey: string | null;
  reviewAutomationError: string | null;
  handleRunReviewAgent: (input: ReviewAutomationTarget) => Promise<void>;
  handleApplyReviewAutofix: (input: ReviewAutofixTarget) => Promise<void>;
};

export type ReviewPackSurfaceProps = {
  workspaceName?: string | null;
  items: MissionReviewEntry[];
  detail: MissionSurfaceDetailModel | null;
  selection: ReviewPackSelectionState;
  freshness?: MissionControlFreshnessState | null;
  onRefresh?: () => void;
  onSelectReviewPack: (entry: MissionReviewEntry) => void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
  onSubmitDecisionAction?: (input: {
    reviewPackId: string;
    action: ReviewPackDetailModel["decisionActions"][number];
  }) => void | Promise<void>;
  onPrepareInterventionDraft?: (input: {
    workspaceId: string;
    navigationTarget: MissionNavigationTarget | null;
    draft: MissionInterventionDraft;
  }) => unknown | Promise<unknown>;
  interventionBackendOptions?: Array<{ value: string; label: string }>;
  defaultInterventionBackendId?: string | null;
  interventionLaunchError?: string | null;
  onLaunchInterventionDraft?: (input: {
    workspaceId: string;
    navigationTarget: MissionNavigationTarget | null;
    draft: MissionInterventionDraft;
  }) => unknown | Promise<unknown>;
  onRunReviewAgent?: ReviewAutomationCallbacks["onRunReviewAgent"];
  onApplyReviewAutofix?: ReviewAutomationCallbacks["onApplyReviewAutofix"];
  decisionSubmission?: ReviewPackDecisionSubmissionState | null;
};

const FAILURE_CONTEXT_SECTION_ID = "review-pack-failure-context";
const DECISION_ACTIONS_SECTION_ID = "review-pack-decision-actions";

function buildReviewAutomationScopeKey(target: ReviewAutomationTarget): string {
  return [target.workspaceId, target.taskId, target.runId, target.reviewPackId ?? ""].join(":");
}

function scrollToSection(sectionId: string) {
  if (typeof document === "undefined") {
    return;
  }
  document.getElementById(sectionId)?.scrollIntoView({
    block: "start",
    behavior: "smooth",
  });
}

function describeFallbackReason(selection: ReviewPackSelectionState): string | null {
  switch (selection.fallbackReason) {
    case "requested_review_pack_missing":
      return selection.detailKind === "mission_run"
        ? "The requested review pack is no longer available. Showing the linked mission detail instead."
        : "The requested review pack is no longer available. Showing the newest available pack instead.";
    case "requested_task_missing":
      return "The requested mission is no longer available. Showing the newest available mission detail instead.";
    case "requested_run_missing":
      return "The requested run is no longer available. Showing the newest available mission detail instead.";
    case "requested_workspace_empty":
      return "This workspace does not currently have any runtime mission detail to inspect.";
    case "no_review_packs":
      return "No runtime mission detail is available for this workspace yet.";
    default:
      return null;
  }
}

function renderDecisionActions(
  detail: ReviewPackDetailModel,
  onOpenMissionTarget: (target: MissionNavigationTarget) => void,
  onSubmitDecisionAction: NonNullable<ReviewPackSurfaceProps["onSubmitDecisionAction"]>,
  onPrepareInterventionDraft: (input: PreparedInterventionDraft) => void | Promise<void>,
  decisionSubmission: ReviewPackDecisionSubmissionState | null
) {
  const locallyRecordedDecisionPendingSync =
    decisionSubmission?.reviewPackId === detail.id &&
    decisionSubmission.phase === "recorded" &&
    detail.reviewDecision.status === "pending";

  return (
    <div className={styles.actionGrid}>
      {detail.decisionActions.map((action) => (
        <div key={action.id} className={styles.actionItem}>
          <span className={styles.actionItemTitle}>{action.label}</span>
          <span className={styles.actionItemBody}>{action.detail}</span>
          {(() => {
            const isSubmitting =
              decisionSubmission?.reviewPackId === detail.id &&
              decisionSubmission.phase === "submitting" &&
              decisionSubmission.actionId === action.id;
            const submissionError =
              decisionSubmission?.reviewPackId === detail.id &&
              decisionSubmission.actionId === action.id
                ? decisionSubmission.error
                : null;
            const isDecisionAction = action.actionTarget !== null;
            const decisionActionDisabledReason =
              locallyRecordedDecisionPendingSync && isDecisionAction
                ? "Decision already recorded. Waiting for runtime mission control to publish the updated review state."
                : action.disabledReason;
            const canSubmitDecision =
              action.enabled && action.actionTarget !== null && !locallyRecordedDecisionPendingSync;
            return (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={
                    isSubmitting ||
                    (locallyRecordedDecisionPendingSync && isDecisionAction) ||
                    !action.enabled ||
                    (action.navigationTarget === null &&
                      action.actionTarget === null &&
                      action.interventionDraft === null)
                  }
                  onClick={() => {
                    if (canSubmitDecision) {
                      void trackProductAnalyticsEvent("review_decision_submitted", {
                        workspaceId: detail.workspaceId,
                        taskId: detail.taskId,
                        runId: detail.runId,
                        reviewPackId: detail.id,
                        reviewStatus: detail.reviewStatus,
                        decision: action.id,
                        eventSource: "review_surface",
                      });
                      void onSubmitDecisionAction({
                        reviewPackId: detail.id,
                        action,
                      });
                      return;
                    }
                    if (action.enabled && action.interventionDraft) {
                      const followUpActionId = action.id as PreparedInterventionDraft["actionId"];
                      void trackProductAnalyticsEvent("review_follow_up_prepared", {
                        workspaceId: detail.workspaceId,
                        taskId: detail.taskId,
                        runId: detail.runId,
                        reviewPackId: detail.id,
                        decision: followUpActionId,
                        interventionKind: action.interventionDraft.intent,
                        executionProfileId: action.interventionDraft.profileId,
                        backendId: action.interventionDraft.preferredBackendIds?.[0] ?? null,
                        eventSource: "review_surface",
                      });
                      void onPrepareInterventionDraft({
                        workspaceId: detail.workspaceId,
                        navigationTarget: action.navigationTarget,
                        actionId: followUpActionId,
                        draft: action.interventionDraft,
                      });
                      return;
                    }
                    if (action.enabled && action.navigationTarget) {
                      onOpenMissionTarget(action.navigationTarget);
                    }
                  }}
                >
                  {isSubmitting
                    ? action.id === "accept"
                      ? "Accepting..."
                      : action.id === "reject"
                        ? "Rejecting..."
                        : action.label
                    : locallyRecordedDecisionPendingSync && isDecisionAction
                      ? `${action.label} unavailable`
                      : action.enabled
                        ? action.label
                        : `${action.label} unavailable`}
                </Button>
                {decisionActionDisabledReason ? (
                  <span className={styles.actionItemBody}>{decisionActionDisabledReason}</span>
                ) : null}
                {submissionError ? (
                  <span className={styles.actionItemBody}>{submissionError}</span>
                ) : null}
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function resolveRunStateTone(runState: MissionRunDetailModel["runState"]): StatusBadgeTone {
  switch (runState) {
    case "review_ready":
      return "success";
    case "failed":
      return "error";
    case "needs_input":
    case "paused":
    case "cancelled":
      return "warning";
    case "running":
    case "validating":
      return "progress";
    case "queued":
    case "preparing":
    case "draft":
    default:
      return "default";
  }
}

function resolveOperatorHealthTone(
  health: MissionRunDetailModel["operatorHealth"]
): StatusBadgeTone {
  switch (health) {
    case "healthy":
      return "success";
    case "blocked":
      return "error";
    case "attention":
    default:
      return "warning";
  }
}

function renderMissionRunDetail(
  detail: MissionRunDetailModel,
  fallbackReason: string | null,
  onOpenMissionTarget: (target: MissionNavigationTarget) => void,
  reviewAutomationCallbacks: ReviewAutomationCallbacks,
  reviewAutomationState: ReviewAutomationState,
  focusedEvidenceBucketKind: string | null,
  onFocusEvidenceBucket: (kind: string | null) => void
) {
  const validations = detail.validations ?? [];
  const artifacts = detail.artifacts ?? [];
  const navigationTarget = detail.navigationTarget;
  const cockpitActions =
    navigationTarget === null
      ? []
      : [
          {
            id: "open-mission-target",
            label: getNavigationTargetButtonLabel(navigationTarget),
            onClick: () => onOpenMissionTarget(navigationTarget),
          },
        ];
  const reviewAutomationTarget = {
    workspaceId: detail.workspaceId,
    taskId: detail.taskId,
    runId: detail.runId,
  } satisfies ReviewAutomationTarget;
  const reviewAutomationScopeKey = buildReviewAutomationScopeKey(reviewAutomationTarget);
  const autofixCandidate = detail.autofixCandidate;
  return (
    <Card className={styles.detailCard} padding="lg" variant="translucent">
      <ReviewLoopHeader
        eyebrow="Mission Detail"
        title={detail.taskTitle}
        description={detail.summary}
        signals={
          <ReviewSignalGroup className={styles.chipRow}>
            <StatusBadge tone={resolveRunStateTone(detail.runState)}>
              {detail.runStateLabel}
            </StatusBadge>
            <StatusBadge tone={resolveOperatorHealthTone(detail.operatorHealth)}>
              {detail.operatorHeadline}
            </StatusBadge>
            {detail.secondaryLabel ? <StatusBadge>{detail.secondaryLabel}</StatusBadge> : null}
          </ReviewSignalGroup>
        }
      />
      <div className={styles.contextGrid}>
        <ReviewSummaryCard
          label="Workspace"
          value={detail.workspaceName}
          detail="Runtime-owned mission workspace"
        />
        <ReviewSummaryCard
          label="Updated"
          value={formatRelativeTime(detail.updatedAt)}
          detail="Mission detail freshness"
        />
        <ReviewSummaryCard
          label="Source"
          value={detail.sourceLabel}
          detail="Published mission source"
        />
        <ReviewSummaryCard
          label="Run"
          value={detail.runTitle ?? detail.runId}
          detail="Linked execution attempt"
        />
      </div>

      {fallbackReason ? (
        <Card className={styles.emptyState} variant="subtle">
          {fallbackReason}
        </Card>
      ) : null}

      {detail.compactEvidenceInput ? (
        <CompactReviewEvidenceCard
          descriptor={buildCompactReviewEvidenceDescriptor(detail.compactEvidenceInput)}
          testId="review-mission-run-compact-evidence"
        />
      ) : null}

      {renderOperatorCockpit({
        operatorSnapshot: detail.operatorSnapshot,
        placement: detail.placement,
        governance: detail.governance,
        approval: {
          label: detail.approvalLabel,
          summary: detail.approvalSummary,
        },
        nextAction: {
          label: detail.nextActionLabel,
          detail: detail.nextActionDetail,
        },
        workspaceEvidence: detail.workspaceEvidence,
        focusedEvidenceBucketKind,
        onFocusEvidenceBucket,
        actions: cockpitActions,
      })}

      {navigationTarget ? (
        <Card className={styles.actionCard} variant="subtle">
          <CardTitle className={styles.actionTitle}>
            {getNavigationTargetCardTitle(navigationTarget)}
          </CardTitle>
          <CardDescription className={styles.bodyText}>
            {getNavigationTargetDescription(navigationTarget)}
          </CardDescription>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenMissionTarget(navigationTarget)}
          >
            {getNavigationTargetButtonLabel(navigationTarget)}
          </Button>
        </Card>
      ) : null}

      <ReviewDetailSection title="Route and supervision">
        <ul className={styles.bulletList}>
          <li className={styles.bulletItem}>
            <span className={styles.bulletHeadline}>{detail.routeSummary}</span>
            <span className={styles.bulletCopy}>
              {detail.routeDetails.join(" | ") || "Routing detail was not published for this run."}
            </span>
          </li>
          <li className={styles.bulletItem}>
            <span className={styles.bulletHeadline}>{detail.operatorHeadline}</span>
            <span className={styles.bulletCopy}>
              {detail.operatorDetail ?? "The runtime did not publish additional operator guidance."}
            </span>
          </li>
          {detail.approvalLabel ? (
            <li className={styles.bulletItem}>
              <span className={styles.bulletHeadline}>{detail.approvalLabel}</span>
              <span className={styles.bulletCopy}>
                {detail.approvalSummary ?? "Approval detail was not published for this run."}
              </span>
            </li>
          ) : null}
        </ul>
      </ReviewDetailSection>

      {detail.executionContext ? (
        <ReviewDetailSection title="Execution context">
          <div className={styles.bodyText}>{detail.executionContext.summary}</div>
          {renderCopyList(
            detail.executionContext.details,
            "The runtime did not publish additional execution context."
          )}
        </ReviewDetailSection>
      ) : null}

      {detail.sourceProvenance ? (
        <ReviewDetailSection title="Source provenance">
          <div className={styles.bodyText}>{detail.sourceProvenance.summary}</div>
          {renderCopyList(
            detail.sourceProvenance.details,
            "GitHub source provenance was not published for this mission run."
          )}
        </ReviewDetailSection>
      ) : null}

      {detail.reviewIntelligence ||
      detail.reviewGate ||
      detail.reviewProfileId ||
      detail.reviewRunId ||
      typeof reviewAutomationCallbacks.onRunReviewAgent === "function" ||
      autofixCandidate?.status === "available" ? (
        <ReviewDetailSection title="Review intelligence">
          {renderReviewIntelligenceBlock(detail, {
            emptyLabel: "Review intelligence metadata was not published for this mission run.",
            fallbackLabel: detail.reviewProfileId
              ? `Review profile ${detail.reviewProfileId} is attached to this mission run.`
              : "Review intelligence metadata is available for this mission run.",
            scopeKey: reviewAutomationScopeKey,
            reviewAgentLabel: detail.reviewRunId ? "Re-run review agent" : "Run review agent",
            runningReviewAgentKey: reviewAutomationState.runningReviewAgentKey,
            applyingReviewAutofixKey: reviewAutomationState.applyingReviewAutofixKey,
            reviewAutomationError: reviewAutomationState.reviewAutomationError,
            runReviewAgentEnabled: typeof reviewAutomationCallbacks.onRunReviewAgent === "function",
            autofixEnabled: typeof reviewAutomationCallbacks.onApplyReviewAutofix === "function",
            actionHandlers: {
              onRunReviewAgent:
                typeof reviewAutomationCallbacks.onRunReviewAgent === "function"
                  ? () => {
                      void reviewAutomationState.handleRunReviewAgent(reviewAutomationTarget);
                    }
                  : null,
              onApplyReviewAutofix:
                typeof reviewAutomationCallbacks.onApplyReviewAutofix === "function" &&
                autofixCandidate
                  ? () => {
                      void reviewAutomationState.handleApplyReviewAutofix({
                        ...reviewAutomationTarget,
                        autofixCandidate,
                      });
                    }
                  : null,
              onRelaunchWithFindings:
                navigationTarget !== null
                  ? () => {
                      onOpenMissionTarget(navigationTarget);
                    }
                  : null,
            },
          })}
        </ReviewDetailSection>
      ) : null}

      {getReviewFindings(detail).length > 0 ? (
        <ReviewDetailSection
          title="Review findings"
          meta={`${getReviewFindings(detail).length} item${getReviewFindings(detail).length === 1 ? "" : "s"}`}
        >
          {renderReviewFindings(detail)}
        </ReviewDetailSection>
      ) : null}

      {getSkillUsage(detail).length > 0 ? (
        <ReviewDetailSection
          title="Skill usage"
          meta={`${getSkillUsage(detail).length} item${getSkillUsage(detail).length === 1 ? "" : "s"}`}
        >
          {renderSkillUsage(detail)}
        </ReviewDetailSection>
      ) : null}

      {detail.missionBrief ? (
        <ReviewDetailSection title="Mission brief">
          <div className={styles.bodyText}>{detail.missionBrief.summary}</div>
          {renderCopyList(detail.missionBrief.details, "Mission brief detail was not published.")}
        </ReviewDetailSection>
      ) : null}

      {detail.relaunchContext ? (
        <ReviewDetailSection title="Relaunch context">
          <div className={styles.bodyText}>{detail.relaunchContext.summary}</div>
          {renderCopyList(
            detail.relaunchContext.details,
            "Relaunch context detail was not published."
          )}
        </ReviewDetailSection>
      ) : null}

      {detail.lineage ? (
        <ReviewDetailSection title="Mission lineage">
          <div className={styles.bodyText}>{detail.lineage.summary}</div>
          {renderCopyList(detail.lineage.details, "Mission lineage detail was not published.")}
        </ReviewDetailSection>
      ) : null}

      {detail.ledger ? (
        <ReviewDetailSection title="Run ledger">
          <div className={styles.bodyText}>{detail.ledger.summary}</div>
          {renderCopyList(detail.ledger.details, "Run ledger detail was not published.")}
        </ReviewDetailSection>
      ) : null}

      {detail.checkpoint ? (
        <ReviewDetailSection title="Checkpoint and handoff">
          <div className={styles.bodyText}>{detail.checkpoint.summary}</div>
          {renderCopyList(
            detail.checkpoint.details,
            "Checkpoint and handoff detail was not published."
          )}
        </ReviewDetailSection>
      ) : null}

      <ReviewDetailSection title="AutoDrive route snapshot">
        {renderCopyList(detail.autoDriveSummary, detail.emptySectionLabels.autoDrive)}
      </ReviewDetailSection>

      <ReviewDetailSection title="Sub-agent supervision">
        {renderSubAgentSummary(detail.subAgentSummary)}
      </ReviewDetailSection>

      <ReviewDetailSection
        title="Validation evidence"
        meta={
          validations.length > 0
            ? `${validations.length} item${validations.length === 1 ? "" : "s"}`
            : undefined
        }
      >
        {renderValidationItems(detail)}
      </ReviewDetailSection>

      <ReviewDetailSection
        title="Warnings"
        meta={
          detail.warnings.length > 0
            ? `${detail.warnings.length} item${detail.warnings.length === 1 ? "" : "s"}`
            : undefined
        }
      >
        {renderWarnings(detail)}
      </ReviewDetailSection>

      <ReviewDetailSection
        title="Artifacts and evidence"
        meta={
          artifacts.length > 0
            ? `${artifacts.length} item${artifacts.length === 1 ? "" : "s"}`
            : undefined
        }
      >
        {renderArtifacts(detail)}
      </ReviewDetailSection>

      <ReviewDetailSection title="Mission limitations">
        {renderCopyList(detail.limitations, "No additional runtime limitations were recorded.")}
      </ReviewDetailSection>
    </Card>
  );
}

export function ReviewPackSurface({
  workspaceName = null,
  items,
  detail,
  selection,
  freshness = null,
  onRefresh,
  onSelectReviewPack,
  onOpenMissionTarget = () => undefined,
  onSubmitDecisionAction = () => undefined,
  onPrepareInterventionDraft = () => undefined,
  interventionBackendOptions = [],
  defaultInterventionBackendId = null,
  interventionLaunchError = null,
  onLaunchInterventionDraft = () => undefined,
  onRunReviewAgent,
  onApplyReviewAutofix,
  decisionSubmission = null,
}: ReviewPackSurfaceProps) {
  const fallbackReason = describeFallbackReason(selection);
  const missionRunDetail = detail?.kind === "mission_run" ? detail : null;
  const reviewPackDetail = detail && detail.kind !== "mission_run" ? detail : null;
  const reviewPackAutofixCandidate =
    reviewPackDetail?.reviewIntelligence?.autofixCandidate ??
    reviewPackDetail?.autofixCandidate ??
    null;
  const reviewPackAutomationScopeKey = reviewPackDetail
    ? buildReviewAutomationScopeKey({
        workspaceId: reviewPackDetail.workspaceId,
        taskId: reviewPackDetail.taskId,
        runId: reviewPackDetail.runId,
        reviewPackId: reviewPackDetail.id,
      })
    : "";
  const displayedReviewDecision = reviewPackDetail
    ? buildDisplayedReviewDecision(reviewPackDetail, decisionSubmission)
    : null;
  const {
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
  } = useReviewPackSurfaceController({
    detail,
    defaultInterventionBackendId,
    interventionBackendOptions,
    onPrepareInterventionDraft,
    onLaunchInterventionDraft,
    onRunReviewAgent,
    onApplyReviewAutofix,
  });

  const reviewPackCockpitActions = useMemo(() => {
    if (!reviewPackDetail) {
      return [];
    }

    const actions: Array<{
      id: string;
      label: string;
      onClick: () => void;
      variant?: "ghost" | "secondary";
    }> = [];

    if (reviewPackDetail.navigationTarget) {
      actions.push({
        id: "open-mission-target",
        label: getNavigationTargetButtonLabel(reviewPackDetail.navigationTarget),
        onClick: () => onOpenMissionTarget(reviewPackDetail.navigationTarget),
      });
    }

    const retryAction = reviewPackDetail.decisionActions.find(
      (action) => action.id === "retry" && action.enabled && action.interventionDraft !== null
    );
    if (retryAction?.interventionDraft) {
      const retryDraft = retryAction.interventionDraft;
      actions.push({
        id: "prepare-retry-draft",
        label: "Prepare retry draft",
        onClick: () => {
          void handlePrepareInterventionDraft({
            workspaceId: reviewPackDetail.workspaceId,
            navigationTarget: retryAction.navigationTarget,
            actionId: "retry",
            draft: retryDraft,
          });
        },
      });
    }

    actions.push({
      id: "jump-to-decisions",
      label: "Open decision and recovery",
      variant: "ghost",
      onClick: () => scrollToSection(DECISION_ACTIONS_SECTION_ID),
    });

    if (reviewPackDetail.failureClass || reviewPackDetail.publishHandoff) {
      actions.push({
        id: "jump-to-failure-context",
        label: "Open recovery context",
        variant: "ghost",
        onClick: () => scrollToSection(FAILURE_CONTEXT_SECTION_ID),
      });
    }

    return actions;
  }, [handlePrepareInterventionDraft, onOpenMissionTarget, reviewPackDetail]);

  return (
    <div
      className={styles.surface}
      data-testid="review-pack-surface"
      data-review-loop-panel="review-pack"
    >
      <div className={styles.listRail}>
        <ReviewQueuePanel
          workspaceName={workspaceName}
          items={items}
          selectedReviewPackId={selection.selectedReviewPackId}
          selectedRunId={selection.selectedRunId}
          freshness={freshness}
          onRefresh={onRefresh}
          onSelectReviewPack={onSelectReviewPack}
          onOpenMissionTarget={onOpenMissionTarget}
        />
      </div>

      <div className={styles.detailRail}>
        {missionRunDetail ? (
          renderMissionRunDetail(
            missionRunDetail,
            fallbackReason,
            onOpenMissionTarget,
            {
              onRunReviewAgent,
              onApplyReviewAutofix,
            },
            {
              runningReviewAgentKey,
              applyingReviewAutofixKey,
              reviewAutomationError,
              handleRunReviewAgent,
              handleApplyReviewAutofix,
            },
            focusedEvidenceBucketKind,
            setFocusedEvidenceBucketKind
          )
        ) : reviewPackDetail && displayedReviewDecision ? (
          <Card className={styles.detailCard} padding="lg" variant="translucent">
            <ReviewPackSurfaceHero
              reviewPackDetail={reviewPackDetail}
              displayedReviewDecision={displayedReviewDecision}
              fallbackReason={fallbackReason}
            />

            {reviewPackDetail.compactEvidenceInput ? (
              <CompactReviewEvidenceCard
                descriptor={buildCompactReviewEvidenceDescriptor(
                  reviewPackDetail.compactEvidenceInput
                )}
                testId="review-pack-compact-evidence"
              />
            ) : null}

            {renderControlDeviceHandoff(reviewPackDetail)}

            {renderOperatorCockpit({
              operatorSnapshot: reviewPackDetail.operatorSnapshot,
              placement: reviewPackDetail.placement,
              governance: reviewPackDetail.governance,
              nextAction: {
                label: reviewPackDetail.nextActionLabel ?? "Recommended next action",
                detail:
                  reviewPackDetail.nextActionDetail ??
                  reviewPackDetail.recommendedNextAction ??
                  "Inspect the runtime evidence, validate the result, then accept or retry.",
              },
              workspaceEvidence: reviewPackDetail.workspaceEvidence,
              focusedEvidenceBucketKind,
              onFocusEvidenceBucket: setFocusedEvidenceBucketKind,
              actions: reviewPackCockpitActions,
            })}

            {reviewPackDetail.provenanceSummary ||
            reviewPackDetail.placement?.summary ||
            reviewPackDetail.lineage?.summary ? (
              <Card className={styles.actionCard} variant="subtle">
                <CardTitle className={styles.actionTitle}>Source and runtime lineage</CardTitle>
                <div className={styles.bodyText}>
                  {[
                    reviewPackDetail.provenanceSummary,
                    reviewPackDetail.placement?.summary,
                    reviewPackDetail.lineage?.summary,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" | ")}
                </div>
              </Card>
            ) : null}

            {reviewPackDetail.navigationTarget ? (
              <Card className={styles.actionCard} variant="subtle">
                <CardTitle className={styles.actionTitle}>
                  {getNavigationTargetCardTitle(reviewPackDetail.navigationTarget)}
                </CardTitle>
                <CardDescription className={styles.bodyText}>
                  {getNavigationTargetDescription(reviewPackDetail.navigationTarget)}
                </CardDescription>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenMissionTarget(reviewPackDetail.navigationTarget)}
                >
                  {reviewPackDetail.nextActionLabel ??
                    getNavigationTargetButtonLabel(reviewPackDetail.navigationTarget)}
                </Button>
              </Card>
            ) : null}

            {reviewPackDetail.failureClassLabel || reviewPackDetail.failureClassSummary ? (
              <Card className={styles.actionCard} variant="subtle">
                <CardTitle className={styles.actionTitle}>
                  {reviewPackDetail.failureClassLabel ?? "Failure class"}
                </CardTitle>
                <CardDescription className={styles.bodyText}>
                  {reviewPackDetail.failureClassSummary ??
                    "Runtime attached structured failure metadata for this review pack."}
                </CardDescription>
              </Card>
            ) : null}

            {(reviewPackDetail.failureClass || reviewPackDetail.publishHandoff) && (
              <section id={FAILURE_CONTEXT_SECTION_ID}>
                <ReviewDetailSection title="Recovery context">
                  <div className={styles.failureContext}>
                    {reviewPackDetail.failureClass ? (
                      <StatusBadge tone="warning">{reviewPackDetail.failureClassLabel}</StatusBadge>
                    ) : null}
                    <div className={styles.bodyText}>
                      {reviewPackDetail.failureClassSummary ??
                        "The runtime recorded a failure class for this run."}
                    </div>
                    {reviewPackDetail.publishHandoff
                      ? renderPublishHandoff(reviewPackDetail.publishHandoff)
                      : null}
                  </div>
                </ReviewDetailSection>
              </section>
            )}

            <ReviewDetailSection
              title="Assumptions and inferred context"
              meta={
                reviewPackDetail.assumptions.length > 0
                  ? `${reviewPackDetail.assumptions.length} item${reviewPackDetail.assumptions.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderCopyList(
                reviewPackDetail.assumptions,
                reviewPackDetail.emptySectionLabels.assumptions
              )}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Validation outcome"
              meta={
                reviewPackDetail.validations.length > 0
                  ? `${reviewPackDetail.validations.length} item${reviewPackDetail.validations.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderValidationItems(reviewPackDetail)}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Warnings"
              meta={
                reviewPackDetail.warnings.length > 0
                  ? `${reviewPackDetail.warnings.length} item${reviewPackDetail.warnings.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderWarnings(reviewPackDetail)}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Checks performed"
              meta={
                reviewPackDetail.checksPerformed.length > 0
                  ? `${reviewPackDetail.checksPerformed.length} item${reviewPackDetail.checksPerformed.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {reviewPackDetail.checksPerformed.length === 0 ? (
                <div className={styles.bodyText}>
                  The runtime did not publish a named checklist for this review pack.
                </div>
              ) : (
                <ul className={styles.bulletList}>
                  {reviewPackDetail.checksPerformed.map((check) => (
                    <li key={check} className={styles.bulletItem}>
                      <span className={styles.bulletCopy}>{check}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Artifacts and evidence"
              meta={
                reviewPackDetail.artifacts.length > 0
                  ? `${reviewPackDetail.artifacts.length} item${reviewPackDetail.artifacts.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderArtifacts(reviewPackDetail)}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Reproduction guidance"
              meta={
                reviewPackDetail.reproductionGuidance.length > 0
                  ? `${reviewPackDetail.reproductionGuidance.length} item${reviewPackDetail.reproductionGuidance.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderCopyList(
                reviewPackDetail.reproductionGuidance,
                reviewPackDetail.emptySectionLabels.reproduction
              )}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Rollback guidance"
              meta={
                reviewPackDetail.rollbackGuidance.length > 0
                  ? `${reviewPackDetail.rollbackGuidance.length} item${reviewPackDetail.rollbackGuidance.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderCopyList(
                reviewPackDetail.rollbackGuidance,
                reviewPackDetail.emptySectionLabels.rollback
              )}
            </ReviewDetailSection>

            <ReviewDetailSection
              title="Backend audit"
              meta={reviewPackDetail.backendAudit.missingReason ? "Derived" : undefined}
            >
              <div className={styles.bodyText}>{reviewPackDetail.backendAudit.summary}</div>
              {reviewPackDetail.backendAudit.details.length > 0 ? (
                <ul className={styles.bulletList}>
                  {reviewPackDetail.backendAudit.details.map((item) => (
                    <li key={item} className={styles.bulletItem}>
                      <span className={styles.bulletCopy}>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {reviewPackDetail.backendAudit.missingReason ? (
                <div className={styles.bodyText}>{reviewPackDetail.backendAudit.missingReason}</div>
              ) : null}
            </ReviewDetailSection>

            {reviewPackDetail.executionContext ? (
              <ReviewDetailSection title="Execution context">
                <div className={styles.bodyText}>{reviewPackDetail.executionContext.summary}</div>
                {renderCopyList(
                  reviewPackDetail.executionContext.details,
                  "The runtime did not publish additional execution context."
                )}
              </ReviewDetailSection>
            ) : null}

            {reviewPackDetail.sourceProvenance ? (
              <ReviewDetailSection title="Source provenance">
                <div className={styles.bodyText}>{reviewPackDetail.sourceProvenance.summary}</div>
                {renderCopyList(
                  reviewPackDetail.sourceProvenance.details,
                  "GitHub source provenance was not published for this review pack."
                )}
              </ReviewDetailSection>
            ) : null}

            {reviewPackDetail.reviewIntelligence ||
            reviewPackDetail.reviewGate ||
            reviewPackDetail.reviewProfileId ||
            reviewPackDetail.reviewRunId ||
            typeof onRunReviewAgent === "function" ||
            reviewPackAutofixCandidate?.status === "available" ? (
              <ReviewDetailSection title="Review intelligence">
                {renderReviewIntelligenceBlock(reviewPackDetail, {
                  emptyLabel:
                    "Review intelligence metadata was not published for this review pack.",
                  fallbackLabel: reviewPackDetail.reviewProfileId
                    ? `Review profile ${reviewPackDetail.reviewProfileId} is attached to this review pack.`
                    : "Review intelligence metadata is available for this review pack.",
                  scopeKey: reviewPackAutomationScopeKey,
                  reviewAgentLabel: reviewPackDetail.reviewRunId
                    ? "Re-run review agent"
                    : "Run review agent",
                  runningReviewAgentKey,
                  applyingReviewAutofixKey,
                  reviewAutomationError,
                  runReviewAgentEnabled: typeof onRunReviewAgent === "function",
                  autofixEnabled: typeof onApplyReviewAutofix === "function",
                  actionHandlers: {
                    onRunReviewAgent:
                      typeof onRunReviewAgent === "function"
                        ? () => {
                            void handleRunReviewAgent({
                              workspaceId: reviewPackDetail.workspaceId,
                              taskId: reviewPackDetail.taskId,
                              runId: reviewPackDetail.runId,
                              reviewPackId: reviewPackDetail.id,
                            });
                          }
                        : null,
                    onApplyReviewAutofix:
                      typeof onApplyReviewAutofix === "function" && reviewPackAutofixCandidate
                        ? () => {
                            void handleApplyReviewAutofix({
                              workspaceId: reviewPackDetail.workspaceId,
                              taskId: reviewPackDetail.taskId,
                              runId: reviewPackDetail.runId,
                              reviewPackId: reviewPackDetail.id,
                              autofixCandidate: reviewPackAutofixCandidate,
                            });
                          }
                        : null,
                    onRelaunchWithFindings: () => scrollToSection(DECISION_ACTIONS_SECTION_ID),
                  },
                })}
              </ReviewDetailSection>
            ) : null}

            {getReviewFindings(reviewPackDetail).length > 0 ? (
              <ReviewDetailSection
                title="Review findings"
                meta={`${getReviewFindings(reviewPackDetail).length} item${getReviewFindings(reviewPackDetail).length === 1 ? "" : "s"}`}
              >
                {renderReviewFindings(reviewPackDetail)}
              </ReviewDetailSection>
            ) : null}

            {getSkillUsage(reviewPackDetail).length > 0 ? (
              <ReviewDetailSection
                title="Skill usage"
                meta={`${getSkillUsage(reviewPackDetail).length} item${getSkillUsage(reviewPackDetail).length === 1 ? "" : "s"}`}
              >
                {renderSkillUsage(reviewPackDetail)}
              </ReviewDetailSection>
            ) : null}

            {reviewPackDetail.missionBrief ? (
              <ReviewDetailSection title="Mission brief">
                <div className={styles.bodyText}>{reviewPackDetail.missionBrief.summary}</div>
                {renderCopyList(
                  reviewPackDetail.missionBrief.details,
                  "Mission brief detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}

            {reviewPackDetail.relaunchContext ? (
              <ReviewDetailSection title="Relaunch context">
                <div className={styles.bodyText}>{reviewPackDetail.relaunchContext.summary}</div>
                {renderCopyList(
                  reviewPackDetail.relaunchContext.details,
                  "Relaunch context detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}
            {reviewPackDetail.lineage ? (
              <ReviewDetailSection title="Mission lineage">
                <div className={styles.bodyText}>{reviewPackDetail.lineage.summary}</div>
                {renderCopyList(
                  reviewPackDetail.lineage.details,
                  "Mission lineage detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}

            {reviewPackDetail.ledger ? (
              <ReviewDetailSection title="Run ledger">
                <div className={styles.bodyText}>{reviewPackDetail.ledger.summary}</div>
                {renderCopyList(
                  reviewPackDetail.ledger.details,
                  "Run ledger detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}

            {reviewPackDetail.checkpoint ? (
              <ReviewDetailSection title="Checkpoint and handoff">
                <div className={styles.bodyText}>{reviewPackDetail.checkpoint.summary}</div>
                {renderCopyList(
                  reviewPackDetail.checkpoint.details,
                  "Checkpoint and handoff detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}

            <ReviewDetailSection title="Relaunch options">
              {renderRelaunchOptions(reviewPackDetail.relaunchOptions)}
            </ReviewDetailSection>

            <ReviewDetailSection title="Sub-agent supervision">
              {renderSubAgentSummary(reviewPackDetail.subAgentSummary)}
            </ReviewDetailSection>

            <ReviewDetailSection title="Publish handoff">
              {renderPublishHandoff(reviewPackDetail.publishHandoff)}
            </ReviewDetailSection>

            <section id={DECISION_ACTIONS_SECTION_ID}>
              <ReviewDetailSection
                title="Review decisions and follow-up"
                meta={`${reviewPackDetail.decisionActions.filter((action) => action.enabled).length}/${reviewPackDetail.decisionActions.length} available`}
              >
                {reviewPackDetail.decisionActionability ? (
                  <div className={styles.section}>
                    <div className={styles.bodyText}>
                      Decision source: {reviewPackDetail.decisionActionability.sourceLabel}
                    </div>
                    <div className={styles.bodyText}>
                      {reviewPackDetail.decisionActionability.summary}
                    </div>
                    {reviewPackDetail.decisionActionability.details.length > 0
                      ? renderCopyList(
                          reviewPackDetail.decisionActionability.details,
                          "Decision availability detail was not published."
                        )
                      : null}
                  </div>
                ) : null}
                {renderDecisionActions(
                  reviewPackDetail,
                  onOpenMissionTarget,
                  onSubmitDecisionAction,
                  handlePrepareInterventionDraft,
                  decisionSubmission
                )}
              </ReviewDetailSection>
            </section>

            {preparedIntervention ? (
              <ReviewDetailSection
                title="Mission Control relaunch"
                meta={preparedIntervention.draft.intent.replaceAll("_", " ")}
              >
                <div className={styles.interventionGrid}>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Run title</span>
                    <Input
                      aria-label="Intervention run title"
                      value={interventionTitle}
                      onChange={(event) => setInterventionTitle(event.currentTarget.value)}
                      placeholder="Retry run title"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Execution profile</span>
                    <Select
                      ariaLabel="Intervention execution profile"
                      options={executionProfileOptions}
                      value={interventionProfileId}
                      onValueChange={setInterventionProfileId}
                      placeholder="Select execution profile"
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Backend route</span>
                    <Select
                      ariaLabel="Intervention backend route"
                      options={backendOptions}
                      value={interventionBackendValue}
                      onValueChange={setInterventionBackendValue}
                      placeholder="Use default backend"
                    />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Instruction</span>
                  <Textarea
                    aria-label="Intervention instruction"
                    value={interventionInstruction}
                    onChange={(event) => setInterventionInstruction(event.currentTarget.value)}
                    rows={8}
                  />
                </div>
                {interventionLaunchError ? (
                  <div className={styles.interventionError}>{interventionLaunchError}</div>
                ) : null}
                <div className={styles.interventionActions}>
                  <Button
                    type="button"
                    size="sm"
                    disabled={launchingIntervention}
                    onClick={() => {
                      void handleLaunchPreparedInterventionDraft();
                    }}
                  >
                    {launchingIntervention ? "Launching..." : "Launch relaunch draft"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={launchingIntervention}
                    onClick={() => resetPreparedIntervention()}
                  >
                    Clear draft
                  </Button>
                </div>
              </ReviewDetailSection>
            ) : null}

            <ReviewDetailSection
              title="Limitations and missing evidence"
              meta={
                reviewPackDetail.limitations.length > 0
                  ? `${reviewPackDetail.limitations.length} item${reviewPackDetail.limitations.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {reviewPackDetail.limitations.length === 0 ? (
                <div className={styles.bodyText}>
                  No additional review limitations are currently recorded for this pack.
                </div>
              ) : (
                <ul className={styles.bulletList}>
                  {reviewPackDetail.limitations.map((limitation) => (
                    <li key={limitation} className={styles.bulletItem}>
                      <span className={styles.bulletCopy}>{limitation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </ReviewDetailSection>
          </Card>
        ) : (
          <Card className={styles.emptyState} variant="subtle">
            {fallbackReason ??
              "Select a review pack to inspect its summary, validation output, warnings, artifacts, and next action."}
          </Card>
        )}
      </div>
    </div>
  );
}
