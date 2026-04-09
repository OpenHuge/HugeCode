import { Card, StatusBadge } from "../../../design-system";
import { formatRelativeTime } from "../../../utils/time";
import {
  getReviewEvidenceStateTone,
  getReviewStatusTone,
  getValidationOutcomeTone,
} from "../../../utils/reviewPackLabels";
import type { ReviewPackDetailModel } from "@ku0/code-application/runtimeReviewPackSurfaceModel";
import * as styles from "./ReviewPackSurface.css";
import {
  ReviewLoopHeader,
  ReviewSignalGroup,
  ReviewSummaryCard,
} from "./review-loop/ReviewLoopAdapters";
import { resolveReviewDecisionTone } from "./ReviewPackSurfaceSections";

type ReviewPackDisplayedDecision = {
  decidedAt: number | null;
  label: string;
  status: ReviewPackDetailModel["reviewDecision"]["status"];
  summary: string;
  warning: string | null;
};

type ReviewPackSurfaceHeroProps = {
  displayedReviewDecision: ReviewPackDisplayedDecision;
  fallbackReason: string | null;
  reviewPackDetail: ReviewPackDetailModel;
};

function resolveReviewBadgeTone(
  tone: "success" | "warning" | "danger" | "neutral"
): "success" | "warning" | "error" | "default" {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "error";
    case "neutral":
    default:
      return "default";
  }
}

export function ReviewPackSurfaceHero({
  displayedReviewDecision,
  fallbackReason,
  reviewPackDetail,
}: ReviewPackSurfaceHeroProps) {
  return (
    <>
      <ReviewLoopHeader
        eyebrow="Review Pack"
        title={reviewPackDetail.taskTitle}
        description={reviewPackDetail.summary}
        signals={
          <ReviewSignalGroup className={styles.chipRow}>
            <StatusBadge
              tone={resolveReviewBadgeTone(getReviewStatusTone(reviewPackDetail.reviewStatus))}
            >
              {reviewPackDetail.reviewStatusLabel}
            </StatusBadge>
            <StatusBadge
              tone={resolveReviewBadgeTone(
                getReviewEvidenceStateTone(reviewPackDetail.evidenceState)
              )}
            >
              {reviewPackDetail.evidenceLabel}
            </StatusBadge>
            <StatusBadge
              tone={resolveReviewBadgeTone(
                getValidationOutcomeTone(reviewPackDetail.validationOutcome)
              )}
            >
              {reviewPackDetail.validationLabel}
            </StatusBadge>
            <StatusBadge tone={resolveReviewDecisionTone(displayedReviewDecision.status)}>
              {displayedReviewDecision.label}
            </StatusBadge>
            {reviewPackDetail.secondaryLabel ? (
              <StatusBadge>{reviewPackDetail.secondaryLabel}</StatusBadge>
            ) : null}
          </ReviewSignalGroup>
        }
      />
      <div className={styles.contextGrid}>
        <ReviewSummaryCard
          label="Workspace"
          value={reviewPackDetail.workspaceName}
          detail="Runtime-owned review workspace"
        />
        <ReviewSummaryCard
          label="Generated"
          value={formatRelativeTime(reviewPackDetail.createdAt)}
          detail="Review pack freshness"
        />
        <ReviewSummaryCard
          label="Source"
          value={reviewPackDetail.sourceLabel}
          detail="Published review source"
        />
        <ReviewSummaryCard
          label="Run"
          value={reviewPackDetail.runTitle ?? reviewPackDetail.runId}
          detail="Linked execution attempt"
        />
      </div>

      {fallbackReason ? (
        <Card className={styles.emptyState} variant="subtle">
          {fallbackReason}
        </Card>
      ) : null}

      <div className={styles.actionCard}>
        <ReviewLoopHeader
          eyebrow="Review decision"
          title={displayedReviewDecision.label}
          description={displayedReviewDecision.summary}
          signals={
            displayedReviewDecision.decidedAt ? (
              <ReviewSignalGroup>
                <StatusBadge>
                  Updated {formatRelativeTime(displayedReviewDecision.decidedAt)}
                </StatusBadge>
              </ReviewSignalGroup>
            ) : undefined
          }
        />
        {displayedReviewDecision.warning ? (
          <div className={styles.bodyText}>{displayedReviewDecision.warning}</div>
        ) : null}
      </div>
    </>
  );
}
