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
} from "../../../design-system";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
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
import type { RuntimeWorkspaceSkillCatalogState } from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";
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
  renderWorkspaceSkillCatalog,
  ReviewDetailSection,
  renderSkillUsage,
  renderSubAgentSummary,
  renderValidationItems,
  renderWarnings,
} from "./ReviewPackSurfaceSections";
import {
  type ReviewAutomationTarget,
  type ReviewAutofixTarget,
  type PreparedInterventionDraft,
  useReviewPackSurfaceController,
} from "./useReviewPackSurfaceController";
import {
  ReviewPackBrowserVerificationSection,
  useReviewPackBrowserVerificationLane,
} from "./ReviewPackBrowserVerificationSection";
import { ReviewPackMissionRunDetail } from "./ReviewPackMissionRunDetail";

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
  onRunReviewAgent?: (input: ReviewAutomationTarget) => unknown | Promise<unknown>;
  onApplyReviewAutofix?: (input: ReviewAutofixTarget) => unknown | Promise<unknown>;
  decisionSubmission?: ReviewPackDecisionSubmissionState | null;
  workspaceSkillCatalogState?: RuntimeWorkspaceSkillCatalogState;
};

const FAILURE_CONTEXT_SECTION_ID = "review-pack-failure-context",
  DECISION_ACTIONS_SECTION_ID = "review-pack-decision-actions";

function buildReviewAutomationScopeKey(target: ReviewAutomationTarget): string {
  return [target.workspaceId, target.taskId, target.runId, target.reviewPackId ?? ""].join(":");
}

function scrollToSection(sectionId: string) {
  if (typeof document === "undefined") {
    return;
  }
  const section = document.getElementById(sectionId);
  if (!section || typeof section.scrollIntoView !== "function") {
    return;
  }
  section.scrollIntoView({
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

function shouldShowWorkspaceSkillCatalog(
  detail: Pick<MissionRunDetailModel | ReviewPackDetailModel, "reviewIntelligence">,
  workspaceSkillCatalogState: RuntimeWorkspaceSkillCatalogState
) {
  return (
    workspaceSkillCatalogState.status !== "idle" ||
    (detail.reviewIntelligence?.allowedSkillIds.length ?? 0) > 0
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
  workspaceSkillCatalogState = { status: "idle", entries: [], error: null },
}: ReviewPackSurfaceProps) {
  const fallbackReason = describeFallbackReason(selection);
  const missionRunDetail = detail?.kind === "mission_run" ? detail : null;
  const reviewPackDetail = detail && detail.kind !== "mission_run" ? detail : null;
  const reviewPackAutofixCandidate =
    reviewPackDetail?.reviewIntelligence?.autofixCandidate ??
    reviewPackDetail?.autofixCandidate ??
    null;
  const missionRunBrowserVerificationLane = useReviewPackBrowserVerificationLane(missionRunDetail);
  const reviewPackBrowserVerificationLane = useReviewPackBrowserVerificationLane(reviewPackDetail);
  const displayedMissionRunDetail = missionRunDetail
    ? {
        ...missionRunDetail,
        artifacts: missionRunBrowserVerificationLane.displayedArtifacts,
        reproductionGuidance: missionRunBrowserVerificationLane.displayedReproductionGuidance,
        limitations: missionRunBrowserVerificationLane.displayedLimitations,
      }
    : null;
  const displayedReviewPackDetail = reviewPackDetail
    ? {
        ...reviewPackDetail,
        artifacts: reviewPackBrowserVerificationLane.displayedArtifacts,
        reproductionGuidance: reviewPackBrowserVerificationLane.displayedReproductionGuidance,
        limitations: reviewPackBrowserVerificationLane.displayedLimitations,
        decisionActionability:
          reviewPackBrowserVerificationLane.displayedDecisionActionability ??
          reviewPackDetail.decisionActionability,
      }
    : null;
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
        {displayedMissionRunDetail ? (
          <ReviewPackMissionRunDetail
            detail={displayedMissionRunDetail}
            fallbackReason={fallbackReason}
            onOpenMissionTarget={onOpenMissionTarget}
            reviewAutomationCallbacks={{
              onRunReviewAgent,
              onApplyReviewAutofix,
            }}
            reviewAutomationState={{
              runningReviewAgentKey,
              applyingReviewAutofixKey,
              reviewAutomationError,
              handleRunReviewAgent,
              handleApplyReviewAutofix,
            }}
            workspaceSkillCatalogState={workspaceSkillCatalogState}
            focusedEvidenceBucketKind={focusedEvidenceBucketKind}
            onFocusEvidenceBucket={setFocusedEvidenceBucketKind}
            browserVerificationLane={missionRunBrowserVerificationLane}
          />
        ) : displayedReviewPackDetail && displayedReviewDecision ? (
          <Card className={styles.detailCard} padding="lg" variant="translucent">
            <ReviewPackSurfaceHero
              reviewPackDetail={displayedReviewPackDetail}
              displayedReviewDecision={displayedReviewDecision}
              fallbackReason={fallbackReason}
            />
            {displayedReviewPackDetail.compactEvidenceInput ? (
              <CompactReviewEvidenceCard
                descriptor={buildCompactReviewEvidenceDescriptor(
                  displayedReviewPackDetail.compactEvidenceInput
                )}
                testId="review-pack-compact-evidence"
              />
            ) : null}
            {renderControlDeviceHandoff(displayedReviewPackDetail)}
            {displayedReviewPackDetail.executionLifecycle ||
            displayedReviewPackDetail.executionEvidence ? (
              <ReviewDetailSection title="Execution summary">
                {displayedReviewPackDetail.executionLifecycle ? (
                  <>
                    <div className={styles.bodyText}>
                      Lifecycle: {displayedReviewPackDetail.executionLifecycle.summary}
                    </div>
                    {renderCopyList(
                      displayedReviewPackDetail.executionLifecycle.details,
                      "Runtime did not publish lifecycle detail for this review pack."
                    )}
                  </>
                ) : null}
                {displayedReviewPackDetail.executionEvidence ? (
                  <>
                    <div className={styles.bodyText}>
                      Evidence: {displayedReviewPackDetail.executionEvidence.summary}
                    </div>
                    {renderCopyList(
                      displayedReviewPackDetail.executionEvidence.details,
                      "Runtime did not publish evidence detail for this review pack."
                    )}
                  </>
                ) : null}
              </ReviewDetailSection>
            ) : null}
            {renderOperatorCockpit({
              operatorSnapshot: displayedReviewPackDetail.operatorSnapshot,
              placement: displayedReviewPackDetail.placement,
              governance: displayedReviewPackDetail.governance,
              nextAction: {
                label: displayedReviewPackDetail.nextActionLabel ?? "Recommended next action",
                detail:
                  displayedReviewPackDetail.nextActionDetail ??
                  displayedReviewPackDetail.recommendedNextAction ??
                  "Inspect the runtime evidence, validate the result, then accept or retry.",
              },
              workspaceEvidence: displayedReviewPackDetail.workspaceEvidence,
              focusedEvidenceBucketKind,
              onFocusEvidenceBucket: setFocusedEvidenceBucketKind,
              actions: reviewPackCockpitActions,
            })}
            {displayedReviewPackDetail.provenanceSummary ||
            displayedReviewPackDetail.placement?.summary ||
            displayedReviewPackDetail.lineage?.summary ? (
              <Card className={styles.actionCard} variant="subtle">
                <CardTitle className={styles.actionTitle}>Source and runtime lineage</CardTitle>
                <div className={styles.bodyText}>
                  {[
                    displayedReviewPackDetail.provenanceSummary,
                    displayedReviewPackDetail.placement?.summary,
                    displayedReviewPackDetail.lineage?.summary,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" | ")}
                </div>
              </Card>
            ) : null}
            {displayedReviewPackDetail.navigationTarget ? (
              <Card className={styles.actionCard} variant="subtle">
                <CardTitle className={styles.actionTitle}>
                  {getNavigationTargetCardTitle(displayedReviewPackDetail.navigationTarget)}
                </CardTitle>
                <CardDescription className={styles.bodyText}>
                  {getNavigationTargetDescription(displayedReviewPackDetail.navigationTarget)}
                </CardDescription>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenMissionTarget(displayedReviewPackDetail.navigationTarget)}
                >
                  {displayedReviewPackDetail.nextActionLabel ??
                    getNavigationTargetButtonLabel(displayedReviewPackDetail.navigationTarget)}
                </Button>
              </Card>
            ) : null}
            {displayedReviewPackDetail.failureClassLabel ||
            displayedReviewPackDetail.failureClassSummary ? (
              <Card className={styles.actionCard} variant="subtle">
                <CardTitle className={styles.actionTitle}>
                  {displayedReviewPackDetail.failureClassLabel ?? "Failure class"}
                </CardTitle>
                <CardDescription className={styles.bodyText}>
                  {displayedReviewPackDetail.failureClassSummary ??
                    "Runtime attached structured failure metadata for this review pack."}
                </CardDescription>
              </Card>
            ) : null}
            {(displayedReviewPackDetail.failureClass ||
              displayedReviewPackDetail.publishHandoff) && (
              <section id={FAILURE_CONTEXT_SECTION_ID}>
                <ReviewDetailSection title="Recovery context">
                  <div className={styles.failureContext}>
                    {displayedReviewPackDetail.failureClass ? (
                      <StatusBadge tone="warning">
                        {displayedReviewPackDetail.failureClassLabel}
                      </StatusBadge>
                    ) : null}
                    <div className={styles.bodyText}>
                      {displayedReviewPackDetail.failureClassSummary ??
                        "The runtime recorded a failure class for this run."}
                    </div>
                    {displayedReviewPackDetail.publishHandoff
                      ? renderPublishHandoff(displayedReviewPackDetail.publishHandoff)
                      : null}
                  </div>
                </ReviewDetailSection>
              </section>
            )}
            <ReviewPackBrowserVerificationSection
              detail={displayedReviewPackDetail}
              lane={reviewPackBrowserVerificationLane}
            />
            <ReviewDetailSection
              title="Assumptions and inferred context"
              meta={
                displayedReviewPackDetail.assumptions.length > 0
                  ? `${displayedReviewPackDetail.assumptions.length} item${displayedReviewPackDetail.assumptions.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderCopyList(
                displayedReviewPackDetail.assumptions,
                displayedReviewPackDetail.emptySectionLabels.assumptions
              )}
            </ReviewDetailSection>
            <ReviewDetailSection
              title="Validation outcome"
              meta={
                displayedReviewPackDetail.validations.length > 0
                  ? `${displayedReviewPackDetail.validations.length} item${displayedReviewPackDetail.validations.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderValidationItems(displayedReviewPackDetail)}
            </ReviewDetailSection>
            <ReviewDetailSection
              title="Warnings"
              meta={
                displayedReviewPackDetail.warnings.length > 0
                  ? `${displayedReviewPackDetail.warnings.length} item${displayedReviewPackDetail.warnings.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderWarnings(displayedReviewPackDetail)}
            </ReviewDetailSection>
            <ReviewDetailSection
              title="Checks performed"
              meta={
                displayedReviewPackDetail.checksPerformed.length > 0
                  ? `${displayedReviewPackDetail.checksPerformed.length} item${displayedReviewPackDetail.checksPerformed.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {displayedReviewPackDetail.checksPerformed.length === 0 ? (
                <div className={styles.bodyText}>
                  The runtime did not publish a named checklist for this review pack.
                </div>
              ) : (
                <ul className={styles.bulletList}>
                  {displayedReviewPackDetail.checksPerformed.map((check) => (
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
                displayedReviewPackDetail.artifacts.length > 0
                  ? `${displayedReviewPackDetail.artifacts.length} item${displayedReviewPackDetail.artifacts.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderArtifacts(displayedReviewPackDetail)}
            </ReviewDetailSection>
            <ReviewDetailSection
              title="Reproduction guidance"
              meta={
                displayedReviewPackDetail.reproductionGuidance.length > 0
                  ? `${displayedReviewPackDetail.reproductionGuidance.length} item${displayedReviewPackDetail.reproductionGuidance.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderCopyList(
                displayedReviewPackDetail.reproductionGuidance,
                displayedReviewPackDetail.emptySectionLabels.reproduction
              )}
            </ReviewDetailSection>
            <ReviewDetailSection
              title="Rollback guidance"
              meta={
                displayedReviewPackDetail.rollbackGuidance.length > 0
                  ? `${displayedReviewPackDetail.rollbackGuidance.length} item${displayedReviewPackDetail.rollbackGuidance.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {renderCopyList(
                displayedReviewPackDetail.rollbackGuidance,
                displayedReviewPackDetail.emptySectionLabels.rollback
              )}
            </ReviewDetailSection>
            <ReviewDetailSection
              title="Backend audit"
              meta={displayedReviewPackDetail.backendAudit.missingReason ? "Derived" : undefined}
            >
              <div className={styles.bodyText}>
                {displayedReviewPackDetail.backendAudit.summary}
              </div>
              {displayedReviewPackDetail.backendAudit.details.length > 0 ? (
                <ul className={styles.bulletList}>
                  {displayedReviewPackDetail.backendAudit.details.map((item) => (
                    <li key={item} className={styles.bulletItem}>
                      <span className={styles.bulletCopy}>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {displayedReviewPackDetail.backendAudit.missingReason ? (
                <div className={styles.bodyText}>
                  {displayedReviewPackDetail.backendAudit.missingReason}
                </div>
              ) : null}
            </ReviewDetailSection>
            {displayedReviewPackDetail.executionContext ? (
              <ReviewDetailSection title="Execution context">
                <div className={styles.bodyText}>
                  {displayedReviewPackDetail.executionContext.summary}
                </div>
                {renderCopyList(
                  displayedReviewPackDetail.executionContext.details,
                  "The runtime did not publish additional execution context."
                )}
              </ReviewDetailSection>
            ) : null}
            {displayedReviewPackDetail.sourceProvenance ? (
              <ReviewDetailSection title="Source provenance">
                <div className={styles.bodyText}>
                  {displayedReviewPackDetail.sourceProvenance.summary}
                </div>
                {renderCopyList(
                  displayedReviewPackDetail.sourceProvenance.details,
                  "GitHub source provenance was not published for this review pack."
                )}
              </ReviewDetailSection>
            ) : null}
            {displayedReviewPackDetail.reviewIntelligence ||
            displayedReviewPackDetail.reviewGate ||
            displayedReviewPackDetail.reviewProfileId ||
            displayedReviewPackDetail.reviewRunId ||
            typeof onRunReviewAgent === "function" ||
            reviewPackAutofixCandidate?.status === "available" ? (
              <ReviewDetailSection title="Review intelligence">
                {renderReviewIntelligenceBlock(displayedReviewPackDetail, {
                  workspaceSkillCatalogState,
                  scopeKey: reviewPackAutomationScopeKey,
                  reviewAgentLabel: displayedReviewPackDetail.reviewRunId
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
                              workspaceId: displayedReviewPackDetail.workspaceId,
                              taskId: displayedReviewPackDetail.taskId,
                              runId: displayedReviewPackDetail.runId,
                              reviewPackId: displayedReviewPackDetail.id,
                            });
                          }
                        : null,
                    onApplyReviewAutofix:
                      typeof onApplyReviewAutofix === "function" && reviewPackAutofixCandidate
                        ? () => {
                            void handleApplyReviewAutofix({
                              workspaceId: displayedReviewPackDetail.workspaceId,
                              taskId: displayedReviewPackDetail.taskId,
                              runId: displayedReviewPackDetail.runId,
                              reviewPackId: displayedReviewPackDetail.id,
                              autofixCandidate: reviewPackAutofixCandidate,
                            });
                          }
                        : null,
                    onRelaunchWithFindings: displayedReviewPackDetail.navigationTarget
                      ? () => {
                          onOpenMissionTarget(displayedReviewPackDetail.navigationTarget);
                        }
                      : () => scrollToSection(DECISION_ACTIONS_SECTION_ID),
                  },
                })}
              </ReviewDetailSection>
            ) : null}
            {shouldShowWorkspaceSkillCatalog(
              displayedReviewPackDetail,
              workspaceSkillCatalogState
            ) && (
              <ReviewDetailSection title="Workspace skill catalog">
                {renderWorkspaceSkillCatalog(displayedReviewPackDetail, workspaceSkillCatalogState)}
              </ReviewDetailSection>
            )}
            {getReviewFindings(displayedReviewPackDetail).length > 0 ? (
              <ReviewDetailSection
                title="Review findings"
                meta={`${getReviewFindings(displayedReviewPackDetail).length} item${getReviewFindings(displayedReviewPackDetail).length === 1 ? "" : "s"}`}
              >
                {renderReviewFindings(displayedReviewPackDetail)}
              </ReviewDetailSection>
            ) : null}
            {getSkillUsage(displayedReviewPackDetail).length > 0 ? (
              <ReviewDetailSection
                title="Skill usage"
                meta={`${getSkillUsage(displayedReviewPackDetail).length} item${getSkillUsage(displayedReviewPackDetail).length === 1 ? "" : "s"}`}
              >
                {renderSkillUsage(displayedReviewPackDetail)}
              </ReviewDetailSection>
            ) : null}
            {displayedReviewPackDetail.missionBrief ? (
              <ReviewDetailSection title="Mission brief">
                <div className={styles.bodyText}>
                  {displayedReviewPackDetail.missionBrief.summary}
                </div>
                {renderCopyList(
                  displayedReviewPackDetail.missionBrief.details,
                  "Mission brief detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}
            {displayedReviewPackDetail.relaunchContext ? (
              <ReviewDetailSection title="Relaunch context">
                <div className={styles.bodyText}>
                  {displayedReviewPackDetail.relaunchContext.summary}
                </div>
                {renderCopyList(
                  displayedReviewPackDetail.relaunchContext.details,
                  "Relaunch context detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}
            {displayedReviewPackDetail.lineage ? (
              <ReviewDetailSection title="Mission lineage">
                <div className={styles.bodyText}>{displayedReviewPackDetail.lineage.summary}</div>
                {renderCopyList(
                  displayedReviewPackDetail.lineage.details,
                  "Mission lineage detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}
            {displayedReviewPackDetail.ledger ? (
              <ReviewDetailSection title="Run ledger">
                <div className={styles.bodyText}>{displayedReviewPackDetail.ledger.summary}</div>
                {renderCopyList(
                  displayedReviewPackDetail.ledger.details,
                  "Run ledger detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}

            {displayedReviewPackDetail.checkpoint ? (
              <ReviewDetailSection title="Checkpoint and handoff">
                <div className={styles.bodyText}>
                  {displayedReviewPackDetail.checkpoint.summary}
                </div>
                {renderCopyList(
                  displayedReviewPackDetail.checkpoint.details,
                  "Checkpoint and handoff detail was not published."
                )}
              </ReviewDetailSection>
            ) : null}

            <ReviewDetailSection title="Relaunch options">
              {renderRelaunchOptions(displayedReviewPackDetail.relaunchOptions)}
            </ReviewDetailSection>

            <ReviewDetailSection title="Sub-agent supervision">
              {renderSubAgentSummary(displayedReviewPackDetail.subAgentSummary)}
            </ReviewDetailSection>

            <ReviewDetailSection title="Publish handoff">
              {renderPublishHandoff(displayedReviewPackDetail.publishHandoff)}
            </ReviewDetailSection>

            <section id={DECISION_ACTIONS_SECTION_ID}>
              <ReviewDetailSection
                title="Review decisions and follow-up"
                meta={`${displayedReviewPackDetail.decisionActions.filter((action) => action.enabled).length}/${displayedReviewPackDetail.decisionActions.length} available`}
              >
                {displayedReviewPackDetail.decisionActionability ? (
                  <div className={styles.section}>
                    <div className={styles.bodyText}>
                      Decision source: {displayedReviewPackDetail.decisionActionability.sourceLabel}
                    </div>
                    <div className={styles.bodyText}>
                      {displayedReviewPackDetail.decisionActionability.summary}
                    </div>
                    {displayedReviewPackDetail.decisionActionability.details.length > 0
                      ? renderCopyList(
                          displayedReviewPackDetail.decisionActionability.details,
                          "Decision availability detail was not published."
                        )
                      : null}
                  </div>
                ) : null}
                {renderDecisionActions(
                  displayedReviewPackDetail,
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
                displayedReviewPackDetail.limitations.length > 0
                  ? `${displayedReviewPackDetail.limitations.length} item${displayedReviewPackDetail.limitations.length === 1 ? "" : "s"}`
                  : undefined
              }
            >
              {displayedReviewPackDetail.limitations.length === 0 ? (
                <div className={styles.bodyText}>
                  No additional review limitations are currently recorded for this pack.
                </div>
              ) : (
                <ul className={styles.bulletList}>
                  {displayedReviewPackDetail.limitations.map((limitation) => (
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
