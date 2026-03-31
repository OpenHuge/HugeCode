import { useMemo } from "react";
import { Button, Input } from "../../../design-system";
import { readBrowserReadiness } from "../../../application/runtime/ports/browserCapability";
import {
  buildRuntimeBrowserExtractionResultPresentation,
  useRuntimeBrowserExtractionOperator,
} from "../../../application/runtime/facades/runtimeBrowserExtractionOperator";
import {
  attachRuntimeBrowserVerificationEvidence,
  ignoreRuntimeBrowserVerificationCandidate,
  useRuntimeBrowserVerificationEvidence,
  type RuntimeBrowserVerificationAttachment,
  type RuntimeBrowserVerificationCandidate,
} from "../../../application/runtime/facades/runtimeBrowserVerificationEvidence";
import type { MissionRunDetailModel, ReviewPackDetailModel } from "../utils/reviewPackSurfaceModel";
import * as styles from "./ReviewPackSurface.css";
import { ReviewDetailSection } from "./ReviewPackSurfaceSections";

type ReviewPackBrowserVerificationDetail = MissionRunDetailModel | ReviewPackDetailModel;
type ReviewPackBrowserVerificationReviewDetail = ReviewPackDetailModel;

export type ReviewPackBrowserVerificationLane = {
  attachments: RuntimeBrowserVerificationAttachment[];
  pendingCandidate: RuntimeBrowserVerificationCandidate | null;
  displayedArtifacts: ReviewPackBrowserVerificationDetail["artifacts"];
  displayedReproductionGuidance: string[];
  displayedLimitations: string[];
  displayedDecisionActionability: ReviewPackDetailModel["decisionActionability"] | null;
  browserReadiness: ReturnType<typeof readBrowserReadiness>;
  browserExtraction: ReturnType<typeof useRuntimeBrowserExtractionOperator>;
  attachPendingEvidence(): void;
  ignorePendingEvidence(): void;
};

function buildAttachmentDecisionDetail(attachment: RuntimeBrowserVerificationAttachment) {
  const target = attachment.result.title ?? attachment.result.sourceUrl ?? "the selected page";
  return `Browser verification evidence attached: ${target}.`;
}

function buildPendingDecisionDetail(
  candidate: RuntimeBrowserVerificationCandidate,
  scopeLabel: string
) {
  const target = candidate.result.title ?? candidate.result.sourceUrl ?? "the selected page";
  return `Browser verification evidence is available for ${target} but has not been attached to this ${scopeLabel} yet.`;
}

function buildAttachmentReproductionStep(attachment: RuntimeBrowserVerificationAttachment) {
  return `Inspect ${attachment.artifact.label} at ${attachment.artifact.uri}.`;
}

function mergeArtifacts(
  baseArtifacts: ReviewPackBrowserVerificationDetail["artifacts"],
  attachments: RuntimeBrowserVerificationAttachment[]
) {
  const seenIds = new Set(baseArtifacts.map((artifact) => artifact.id));
  const nextArtifacts = [...baseArtifacts];
  for (const attachment of attachments) {
    if (seenIds.has(attachment.artifact.id)) {
      continue;
    }
    seenIds.add(attachment.artifact.id);
    nextArtifacts.push(attachment.artifact);
  }
  return nextArtifacts;
}

function buildDisplayedReproductionGuidance(
  detail: ReviewPackBrowserVerificationDetail,
  attachments: RuntimeBrowserVerificationAttachment[]
) {
  const next = detail.kind === "mission_run" ? [] : [...detail.reproductionGuidance];
  for (const attachment of attachments) {
    const step = buildAttachmentReproductionStep(attachment);
    if (!next.includes(step)) {
      next.push(step);
    }
  }
  return next;
}

function buildDisplayedDecisionActionability(
  detail: ReviewPackBrowserVerificationReviewDetail,
  attachments: RuntimeBrowserVerificationAttachment[],
  pendingCandidate: RuntimeBrowserVerificationCandidate | null
) {
  const details = [...detail.decisionActionability.details];
  if (attachments.length > 0) {
    for (const attachment of attachments) {
      details.push(buildAttachmentDecisionDetail(attachment));
    }
  } else if (pendingCandidate) {
    details.push(buildPendingDecisionDetail(pendingCandidate, "review pack"));
  }
  return {
    ...detail.decisionActionability,
    details,
  };
}

function buildDisplayedLimitations(
  detail: ReviewPackBrowserVerificationDetail,
  pendingCandidate: RuntimeBrowserVerificationCandidate | null
) {
  if (!pendingCandidate) {
    return detail.limitations;
  }
  return [
    ...detail.limitations,
    `Browser verification evidence is pending operator attach or ignore for this ${detail.kind === "mission_run" ? "mission run" : "review pack"}.`,
  ];
}

function resolveScope(detail: ReviewPackBrowserVerificationDetail) {
  return {
    workspaceId: detail.workspaceId,
    taskId: detail.taskId,
    runId: detail.runId,
    reviewPackId: detail.kind === "mission_run" ? null : detail.id,
  };
}

function renderCandidateBlock(
  candidate: RuntimeBrowserVerificationCandidate,
  actions: {
    attachPendingEvidence(): void;
    ignorePendingEvidence(): void;
  }
) {
  const presentation = buildRuntimeBrowserExtractionResultPresentation(candidate.result);
  return (
    <div className={styles.section}>
      <div className={styles.actionItem}>
        <span className={styles.actionItemTitle}>{presentation.headline}</span>
        <span className={styles.actionItemBody}>{presentation.detail}</span>
        <span className={styles.actionItemBody}>
          Source: {candidate.readinessSourceLabel} | Host: {candidate.runtimeHost}
        </span>
        {candidate.result.title ? (
          <span className={styles.actionItemBody}>{candidate.result.title}</span>
        ) : null}
        {candidate.result.sourceUrl ? (
          <span className={styles.actionItemBody}>{candidate.result.sourceUrl}</span>
        ) : null}
        {candidate.result.normalizedText ? (
          <span className={styles.actionItemBody}>{candidate.result.normalizedText}</span>
        ) : null}
        <div className={styles.interventionActions}>
          <Button type="button" size="sm" onClick={actions.attachPendingEvidence}>
            Attach browser evidence
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={actions.ignorePendingEvidence}
          >
            Ignore browser evidence
          </Button>
        </div>
      </div>
    </div>
  );
}

function renderAttachmentList(attachments: RuntimeBrowserVerificationAttachment[]) {
  if (attachments.length === 0) {
    return null;
  }
  return (
    <ul className={styles.bulletList}>
      {attachments.map((attachment) => {
        const presentation = buildRuntimeBrowserExtractionResultPresentation(attachment.result);
        return (
          <li key={attachment.id} className={styles.bulletItem}>
            <span className={styles.bulletHeadline}>
              {attachment.artifact.label} | {attachment.artifact.kind}
            </span>
            <span className={styles.bulletCopy}>{attachment.summary}</span>
            <span className={styles.bulletCopy}>
              {presentation.statusLabel} | Source {attachment.readinessSourceLabel} | Host{" "}
              {attachment.runtimeHost}
            </span>
            {attachment.result.title ? (
              <span className={styles.bulletCopy}>{attachment.result.title}</span>
            ) : null}
            {attachment.result.sourceUrl ? (
              <span className={styles.bulletCopy}>{attachment.result.sourceUrl}</span>
            ) : null}
            {attachment.artifact.uri ? (
              <span className={styles.bulletCopy}>{attachment.artifact.uri}</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function useReviewPackBrowserVerificationLane(
  detail: ReviewPackBrowserVerificationDetail | null
): ReviewPackBrowserVerificationLane {
  const browserReadiness = readBrowserReadiness();
  const browserExtraction = useRuntimeBrowserExtractionOperator(
    browserReadiness,
    detail
      ? {
          workspaceId: detail.workspaceId,
          eventSource: "review_surface",
        }
      : undefined
  );
  const scope = detail ? resolveScope(detail) : null;
  const { candidate, attachments } = useRuntimeBrowserVerificationEvidence({
    workspaceId: scope?.workspaceId ?? null,
    taskId: scope?.taskId ?? null,
    runId: scope?.runId ?? null,
    reviewPackId: scope?.reviewPackId ?? null,
  });

  const pendingCandidate =
    candidate?.status === "pending" && candidate.workspaceId === scope?.workspaceId
      ? candidate
      : null;

  const displayedArtifacts = useMemo(
    () => (detail ? mergeArtifacts(detail.artifacts, attachments) : []),
    [attachments, detail]
  );
  const displayedReproductionGuidance = useMemo(
    () => (detail ? buildDisplayedReproductionGuidance(detail, attachments) : []),
    [attachments, detail]
  );
  const displayedLimitations = useMemo(
    () => (detail ? buildDisplayedLimitations(detail, pendingCandidate) : []),
    [detail, pendingCandidate]
  );
  const displayedDecisionActionability =
    detail && detail.kind !== "mission_run"
      ? buildDisplayedDecisionActionability(detail, attachments, pendingCandidate)
      : null;

  return {
    attachments,
    pendingCandidate,
    displayedArtifacts,
    displayedReproductionGuidance,
    displayedLimitations,
    displayedDecisionActionability,
    browserReadiness,
    browserExtraction,
    attachPendingEvidence() {
      if (!scope) {
        return;
      }
      attachRuntimeBrowserVerificationEvidence({
        ...scope,
        eventSource: "review_surface",
      });
    },
    ignorePendingEvidence() {
      if (!scope) {
        return;
      }
      ignoreRuntimeBrowserVerificationCandidate({
        ...scope,
        eventSource: "review_surface",
      });
    },
  };
}

export function ReviewPackBrowserVerificationSection(props: {
  detail: ReviewPackBrowserVerificationDetail;
  lane: ReviewPackBrowserVerificationLane;
}) {
  const { detail, lane } = props;
  return (
    <ReviewDetailSection
      title="Browser verification"
      meta={
        lane.attachments.length > 0
          ? `${lane.attachments.length} item${lane.attachments.length === 1 ? "" : "s"}`
          : undefined
      }
    >
      <div className={styles.bodyText}>{lane.browserReadiness.headline}</div>
      <div className={styles.bodyText}>{lane.browserReadiness.detail}</div>
      <div className={styles.bodyText}>{lane.browserReadiness.recommendedAction}</div>
      <div className={styles.interventionGrid}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Preferred page URL</span>
          <Input
            aria-label="Browser verification page URL"
            value={lane.browserExtraction.input.sourceUrl}
            onChange={(event) => lane.browserExtraction.setSourceUrl(event.currentTarget.value)}
            placeholder="Optional: target a specific local browser page"
          />
        </div>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Selector</span>
          <Input
            aria-label="Browser verification selector"
            value={lane.browserExtraction.input.selector}
            onChange={(event) => lane.browserExtraction.setSelector(event.currentTarget.value)}
            placeholder="Optional: extract from a specific element"
          />
        </div>
      </div>
      <div className={styles.interventionActions}>
        <Button
          type="button"
          size="sm"
          onClick={() => void lane.browserExtraction.extract()}
          disabled={!lane.browserExtraction.canExtract || lane.browserExtraction.loading}
        >
          {lane.browserExtraction.extracting ? "Extracting..." : "Extract browser page"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void lane.browserExtraction.reviewLastResult()}
          disabled={!lane.browserExtraction.canReviewLastResult || lane.browserExtraction.loading}
        >
          {lane.browserExtraction.reviewingLastResult ? "Loading..." : "Review last result"}
        </Button>
      </div>
      {lane.browserExtraction.notice ? (
        <div className={styles.bodyText}>{lane.browserExtraction.notice.message}</div>
      ) : null}
      {lane.pendingCandidate
        ? renderCandidateBlock(lane.pendingCandidate, {
            attachPendingEvidence: lane.attachPendingEvidence,
            ignorePendingEvidence: lane.ignorePendingEvidence,
          })
        : null}
      {renderAttachmentList(lane.attachments)}
      {lane.pendingCandidate === null && lane.attachments.length === 0 ? (
        <div className={styles.emptyState}>
          No browser verification evidence is attached to this{" "}
          {detail.kind === "mission_run" ? "mission run" : "review pack"} yet.
        </div>
      ) : null}
    </ReviewDetailSection>
  );
}
