import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  StatusBadge,
  type StatusBadgeTone,
} from "../../../design-system";
import { formatRelativeTime } from "../../../utils/time";
import type { MissionNavigationTarget } from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { CompactReviewEvidenceCard } from "./CompactReviewEvidenceCard";
import * as styles from "./ReviewPackSurface.css";
import { buildCompactReviewEvidenceDescriptor } from "../utils/compactReviewEvidence";
import type { MissionRunDetailModel } from "@ku0/code-application/runtimeReviewPackSurfaceModel";
import type { RuntimeWorkspaceSkillCatalogState } from "../../../application/runtime/facades/runtimeReviewIntelligenceFacade";
import {
  getNavigationTargetButtonLabel,
  getNavigationTargetCardTitle,
  getNavigationTargetDescription,
  getReviewFindings,
  getSkillUsage,
  renderCopyList,
  renderArtifacts,
  renderOperatorCockpit,
  renderReviewFindings,
  renderReviewIntelligenceBlock,
  renderSubAgentSummary,
  renderValidationItems,
  renderWarnings,
  renderWorkspaceSkillCatalog,
  renderSkillUsage,
  ReviewDetailSection,
} from "./ReviewPackSurfaceSections";
import {
  ReviewLoopHeader,
  ReviewSignalGroup,
  ReviewSummaryCard,
} from "./review-loop/ReviewLoopAdapters";
import {
  ReviewPackBrowserVerificationSection,
  type ReviewPackBrowserVerificationLane,
} from "./ReviewPackBrowserVerificationSection";

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

type ReviewAutomationState = {
  runningReviewAgentKey: string | null;
  applyingReviewAutofixKey: string | null;
  reviewAutomationError: string | null;
  handleRunReviewAgent: (input: ReviewAutomationTarget) => Promise<void>;
  handleApplyReviewAutofix: (input: ReviewAutofixTarget) => Promise<void>;
};

function shouldShowWorkspaceSkillCatalog(
  detail: Pick<MissionRunDetailModel, "reviewIntelligence">,
  workspaceSkillCatalogState: RuntimeWorkspaceSkillCatalogState
) {
  return (
    workspaceSkillCatalogState.status !== "idle" ||
    (detail.reviewIntelligence?.allowedSkillIds.length ?? 0) > 0
  );
}

function buildReviewAutomationScopeKey(target: ReviewAutomationTarget): string {
  return [target.workspaceId, target.taskId, target.runId, target.reviewPackId ?? ""].join(":");
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

export function ReviewPackMissionRunDetail(props: {
  detail: MissionRunDetailModel;
  fallbackReason: string | null;
  onOpenMissionTarget: (target: MissionNavigationTarget) => void;
  reviewAutomationCallbacks: {
    onRunReviewAgent?: (input: ReviewAutomationTarget) => unknown | Promise<unknown>;
    onApplyReviewAutofix?: (input: ReviewAutofixTarget) => unknown | Promise<unknown>;
  };
  reviewAutomationState: ReviewAutomationState;
  workspaceSkillCatalogState: RuntimeWorkspaceSkillCatalogState;
  focusedEvidenceBucketKind: string | null;
  onFocusEvidenceBucket: (kind: string | null) => void;
  browserVerificationLane: ReviewPackBrowserVerificationLane;
}) {
  const {
    detail,
    fallbackReason,
    onOpenMissionTarget,
    reviewAutomationCallbacks,
    reviewAutomationState,
    workspaceSkillCatalogState,
    focusedEvidenceBucketKind,
    onFocusEvidenceBucket,
    browserVerificationLane,
  } = props;
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

      <ReviewPackBrowserVerificationSection detail={detail} lane={browserVerificationLane} />

      {detail.reviewIntelligence ||
      detail.reviewGate ||
      detail.reviewProfileId ||
      detail.reviewRunId ||
      typeof reviewAutomationCallbacks.onRunReviewAgent === "function" ||
      autofixCandidate?.status === "available" ? (
        <ReviewDetailSection title="Review intelligence">
          {renderReviewIntelligenceBlock(detail, {
            workspaceSkillCatalogState,
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

      {shouldShowWorkspaceSkillCatalog(detail, workspaceSkillCatalogState) && (
        <ReviewDetailSection title="Workspace skill catalog">
          {renderWorkspaceSkillCatalog(detail, workspaceSkillCatalogState)}
        </ReviewDetailSection>
      )}

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
