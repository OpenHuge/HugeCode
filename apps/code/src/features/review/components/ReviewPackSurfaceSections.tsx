import { type ReactNode, useState } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  DiffReviewPanel,
  StatusBadge,
  type StatusBadgeTone,
} from "../../../design-system";
import { ReviewActionRail, ReviewLoopSection } from "./review-loop/ReviewLoopAdapters";
import { getSubAgentTone } from "../../../utils/subAgentStatus";
import { formatRelativeTime } from "../../../utils/time";
import { resolveMissionEntryActionLabel } from "../../missions/utils/missionNavigation";
import type { MissionRunDetailModel, ReviewPackDetailModel } from "../utils/reviewPackSurfaceModel";
import type { ReviewPackDecisionSubmissionState } from "../hooks/useReviewPackDecisionActions";
import * as styles from "./ReviewPackSurface.css";

type DisplayedReviewDecision = ReviewPackDetailModel["reviewDecision"] & {
  warning: string | null;
  locallyRecorded: boolean;
};

export function renderCopyList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <div className={styles.bodyText}>{emptyLabel}</div>;
  }
  return (
    <ul className={styles.bulletList}>
      {items.map((item) => (
        <li key={item} className={styles.bulletItem}>
          <span className={styles.bulletCopy}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function renderControlDeviceHandoff(detail: ReviewPackDetailModel) {
  return (
    <Card className={styles.actionCard} variant="subtle">
      <CardTitle className={styles.actionTitle}>Control-device handoff</CardTitle>
      <CardDescription className={styles.bodyText}>
        Review Pack is the primary completed-run surface. Use the recorded checkpoint, trace, and
        placement evidence to continue supervision from any control device.
      </CardDescription>
      {detail.navigationTarget.kind !== "thread" &&
      detail.navigationTarget.limitation === "thread_unavailable" ? (
        <div className={styles.bodyText}>
          Thread detail is unavailable in this runtime snapshot.
        </div>
      ) : null}
      {detail.checkpoint?.summary ? (
        <div className={styles.bodyText}>{detail.checkpoint.summary}</div>
      ) : null}
      {detail.ledger?.summary ? (
        <div className={styles.bodyText}>{detail.ledger.summary}</div>
      ) : null}
      {detail.placement?.summary ? (
        <div className={styles.bodyText}>{detail.placement.summary}</div>
      ) : null}
      {detail.publishHandoff?.summary ? (
        <div className={styles.bodyText}>{detail.publishHandoff.summary}</div>
      ) : null}
      {detail.continuity?.summary ? (
        <div className={styles.bodyText}>{detail.continuity.summary}</div>
      ) : null}
      {detail.continuity?.truthSourceLabel ? (
        <div className={styles.bodyText}>
          Follow-up source: {detail.continuity.truthSourceLabel}
        </div>
      ) : null}
      {detail.continuity?.blockingReason &&
      detail.continuity.blockingReason !== detail.continuity.summary ? (
        <div className={styles.bodyText}>{detail.continuity.blockingReason}</div>
      ) : null}
      {detail.continuity?.details && detail.continuity.details.length > 0 ? (
        <ul className={styles.publishList}>
          {detail.continuity.details.map((item) => (
            <li key={item} className={styles.publishItem}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {detail.continuity?.recommendedAction ? (
        <div className={styles.bodyText}>{detail.continuity.recommendedAction}</div>
      ) : null}
    </Card>
  );
}

export function getNavigationTargetButtonLabel(target: MissionRunDetailModel["navigationTarget"]) {
  return target?.kind === "thread"
    ? "Open mission thread"
    : resolveMissionEntryActionLabel({
        operatorActionTarget: target ?? null,
      });
}

export function getNavigationTargetCardTitle(target: MissionRunDetailModel["navigationTarget"]) {
  if (target?.kind === "thread") {
    return "Mission thread";
  }
  if (target?.kind === "review") {
    return "Review surface";
  }
  return "Action center";
}

export function getNavigationTargetDescription(target: MissionRunDetailModel["navigationTarget"]) {
  if (target?.kind === "thread") {
    return "Open the linked mission thread after inspecting the cockpit to continue review follow-up.";
  }
  if (target?.kind === "review") {
    return "Open review after inspecting the cockpit to continue review follow-up.";
  }
  return "Open action center after inspecting the cockpit to continue review follow-up.";
}

export function resolveReviewDecisionTone(
  status: ReviewPackDetailModel["reviewDecision"]["status"]
): StatusBadgeTone {
  switch (status) {
    case "accepted":
      return "success";
    case "rejected":
      return "error";
    case "pending":
    default:
      return "default";
  }
}

function resolveSubAgentStatusTone(status: string | null | undefined): StatusBadgeTone {
  switch (getSubAgentTone(status)) {
    case "accent":
      return "progress";
    case "warning":
      return "warning";
    case "success":
      return "success";
    case "danger":
      return "error";
    case "neutral":
    default:
      return "default";
  }
}

export function buildDisplayedReviewDecision(
  detail: ReviewPackDetailModel,
  decisionSubmission: ReviewPackDecisionSubmissionState | null
): DisplayedReviewDecision {
  const baseDecision = {
    ...detail.reviewDecision,
    warning: null,
    locallyRecorded: false,
  } satisfies DisplayedReviewDecision;
  if (
    decisionSubmission?.reviewPackId !== detail.id ||
    decisionSubmission.phase !== "recorded" ||
    detail.reviewDecision.status !== "pending"
  ) {
    return baseDecision;
  }
  if (decisionSubmission.recordedStatus === "approved") {
    return {
      status: "accepted",
      reviewPackId: detail.id,
      label: "Accepted",
      summary:
        "Result accepted. Waiting for runtime mission control to publish the updated review state.",
      decidedAt: decisionSubmission.recordedAt ?? null,
      warning: decisionSubmission.warning ?? null,
      locallyRecorded: true,
    };
  }
  if (decisionSubmission.recordedStatus === "rejected") {
    return {
      status: "rejected",
      reviewPackId: detail.id,
      label: "Rejected",
      summary:
        "Result rejected. Waiting for runtime mission control to publish the updated review state.",
      decidedAt: decisionSubmission.recordedAt ?? null,
      warning: decisionSubmission.warning ?? null,
      locallyRecorded: true,
    };
  }
  return baseDecision;
}

type ReviewDetailSectionProps = {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
};

export function ReviewDetailSection({ title, meta, children }: ReviewDetailSectionProps) {
  return (
    <ReviewLoopSection className={styles.section} title={title} meta={meta} framed={false}>
      {children}
    </ReviewLoopSection>
  );
}

export function renderSubAgentSummary(subAgents?: ReviewPackDetailModel["subAgentSummary"]) {
  if (!subAgents || subAgents.length === 0) {
    return <div className={styles.bodyText}>No sub-agent sessions were published.</div>;
  }
  return (
    <ul className={styles.subAgentList}>
      {subAgents.map((agent) => (
        <li key={agent.sessionId} className={styles.subAgentItem}>
          <div className={styles.subAgentHeader}>
            <span className={styles.subAgentLabel}>{agent.scopeProfile ?? agent.sessionId}</span>
            <StatusBadge tone={resolveSubAgentStatusTone(agent.status)}>{agent.status}</StatusBadge>
          </div>
          <div className={styles.subAgentSummary}>{agent.summary}</div>
          <div className={styles.subAgentMeta}>
            {agent.approvalState ? (
              <span className={styles.subAgentMetaItem}>Approval {agent.approvalState}</span>
            ) : null}
            {agent.checkpointState ? (
              <span className={styles.subAgentMetaItem}>Checkpoint {agent.checkpointState}</span>
            ) : null}
            {agent.timedOutReason ? (
              <span className={styles.subAgentMetaItem}>Timed out: {agent.timedOutReason}</span>
            ) : null}
            {agent.interruptedReason ? (
              <span className={styles.subAgentMetaItem}>
                Interrupted: {agent.interruptedReason}
              </span>
            ) : null}
            {agent.parentRunId ? (
              <span className={styles.subAgentMetaItem}>Parent run {agent.parentRunId}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function renderRelaunchOptions(options?: ReviewPackDetailModel["relaunchOptions"]) {
  const list = options ?? [];
  if (list.length === 0) {
    return <div className={styles.bodyText}>No relaunch options are flagged for this run.</div>;
  }
  return (
    <ul className={styles.optionList}>
      {list.map((option, index) => (
        <li key={`${option.id}-${index}`} className={styles.optionItem}>
          <div className={styles.optionLabelRow}>
            <span className={styles.optionLabel}>{option.label}</span>
            <StatusBadge tone={option.enabled ? "success" : "default"}>
              {option.enabled ? "Available" : "Unavailable"}
            </StatusBadge>
          </div>
          {option.detail ? (
            <div className={styles.optionDetail}>{option.detail}</div>
          ) : (
            <div className={styles.bodyText}>No extra detail was published for this option.</div>
          )}
          {!option.enabled && option.disabledReason ? (
            <div className={styles.optionDisabled}>{option.disabledReason}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function renderPublishHandoff(handoff: ReviewPackDetailModel["publishHandoff"]) {
  if (!handoff) {
    return null;
  }
  const detailRows: string[] = [];
  if (handoff.branchName) {
    detailRows.push(`Branch: ${handoff.branchName}`);
  }
  if (handoff.reviewTitle) {
    detailRows.push(`Review draft: ${handoff.reviewTitle}`);
  }
  if (handoff.details) {
    detailRows.push(...handoff.details);
  }
  return (
    <div className={styles.publishHandoff}>
      <div className={styles.publishHandoffLabel}>
        {handoff.summary ?? "Publish handoff metadata was attached to this run."}
      </div>
      {handoff.reviewBody ? <div className={styles.bodyText}>{handoff.reviewBody}</div> : null}
      {handoff.reviewChecklist && handoff.reviewChecklist.length > 0 ? (
        <ul className={styles.publishList}>
          {handoff.reviewChecklist.map((item) => (
            <li key={item} className={styles.publishItem}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {handoff.operatorCommands && handoff.operatorCommands.length > 0 ? (
        <ul className={styles.publishList}>
          {handoff.operatorCommands.map((command) => (
            <li key={command} className={styles.publishItem}>
              {command}
            </li>
          ))}
        </ul>
      ) : null}
      {detailRows.length > 0 ? (
        <ul className={styles.publishList}>
          {detailRows.map((item) => (
            <li key={item} className={styles.publishItem}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type ReviewIntelligenceDetail =
  | Pick<
      ReviewPackDetailModel,
      | "reviewIntelligence"
      | "reviewProfileId"
      | "reviewGate"
      | "reviewRunId"
      | "autofixCandidate"
      | "reviewFindings"
      | "skillUsage"
    >
  | Pick<
      MissionRunDetailModel,
      | "reviewIntelligence"
      | "reviewProfileId"
      | "reviewGate"
      | "reviewRunId"
      | "autofixCandidate"
      | "reviewFindings"
      | "skillUsage"
    >;

type ReviewIntelligenceActionHandlers = {
  onRunReviewAgent?: (() => void) | null;
  onApplyReviewAutofix?: (() => void) | null;
  onRelaunchWithFindings?: (() => void) | null;
};

export function getReviewFindings(detail: ReviewIntelligenceDetail) {
  return Array.isArray(detail.reviewIntelligence?.reviewFindings)
    ? detail.reviewIntelligence.reviewFindings
    : Array.isArray(detail.reviewFindings)
      ? detail.reviewFindings
      : [];
}

export function getSkillUsage(detail: ReviewIntelligenceDetail) {
  return Array.isArray(detail.reviewIntelligence?.skillUsage)
    ? detail.reviewIntelligence.skillUsage
    : Array.isArray(detail.skillUsage)
      ? detail.skillUsage
      : [];
}

export function renderReviewFindings(detail: ReviewIntelligenceDetail) {
  const reviewFindings = getReviewFindings(detail);
  if (reviewFindings.length === 0) {
    return (
      <div className={styles.bodyText}>The runtime review agent did not publish findings.</div>
    );
  }
  return (
    <ul className={styles.bulletList}>
      {reviewFindings.map((finding) => (
        <li key={finding.id} className={styles.bulletItem}>
          <span className={styles.bulletHeadline}>
            {finding.title} | {finding.severity} | {finding.category}
          </span>
          <span className={styles.bulletCopy}>{finding.summary}</span>
          {finding.suggestedNextAction ? (
            <span className={styles.bulletCopy}>
              Suggested action: {finding.suggestedNextAction}
            </span>
          ) : null}
          {(finding.anchors?.length ?? 0) > 0 ? (
            <span className={styles.bulletCopy}>
              Anchors:{" "}
              {finding.anchors
                ?.map((anchor) => {
                  const path = anchor.path ?? anchor.label ?? "anchor";
                  const line = typeof anchor.startLine === "number" ? `:${anchor.startLine}` : "";
                  return `${path}${line}`;
                })
                .join(", ")}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function renderSkillUsage(detail: ReviewIntelligenceDetail) {
  const skillUsage = getSkillUsage(detail);
  if (skillUsage.length === 0) {
    return (
      <div className={styles.bodyText}>No review-time workspace skill usage was published.</div>
    );
  }
  return (
    <ul className={styles.bulletList}>
      {skillUsage.map((skill) => (
        <li key={skill.skillId} className={styles.bulletItem}>
          <span className={styles.bulletHeadline}>
            {skill.name} | {skill.skillId}
          </span>
          <span className={styles.bulletCopy}>
            {[
              skill.status ? `Status: ${skill.status}` : null,
              (skill.recommendedFor?.length ?? 0) > 0
                ? `Recommended for: ${skill.recommendedFor?.join(", ")}`
                : null,
              skill.summary ?? null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" | ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function renderReviewIntelligenceSummary(
  detail: ReviewIntelligenceDetail,
  options: {
    emptyLabel: string;
    fallbackLabel: string;
  }
) {
  const intelligence = detail.reviewIntelligence ?? null;
  const lines = [
    intelligence?.reviewProfileLabel
      ? `Review profile: ${intelligence.reviewProfileLabel}`
      : detail.reviewProfileId
        ? `Review profile: ${detail.reviewProfileId}`
        : null,
    intelligence?.validationPresetLabel
      ? `Validation preset: ${intelligence.validationPresetLabel}`
      : null,
    intelligence?.allowedSkillIds.length
      ? `Allowed skills: ${intelligence.allowedSkillIds.join(", ")}`
      : null,
    intelligence?.autofixPolicy ? `Autofix policy: ${intelligence.autofixPolicy}` : null,
    intelligence?.githubMirrorPolicy
      ? `GitHub mirror policy: ${intelligence.githubMirrorPolicy}`
      : null,
    intelligence?.reviewRunId ? `Review run: ${intelligence.reviewRunId}` : null,
    intelligence?.reviewGate?.state ? `Review gate: ${intelligence.reviewGate.state}` : null,
    intelligence?.reviewGate?.highestSeverity
      ? `Highest severity: ${intelligence.reviewGate.highestSeverity}`
      : null,
    typeof intelligence?.reviewGate?.findingCount === "number"
      ? `Finding count: ${intelligence.reviewGate.findingCount}`
      : null,
    intelligence?.blockedReason ? `Blocked: ${intelligence.blockedReason}` : null,
    intelligence?.nextRecommendedAction
      ? `Next action: ${intelligence.nextRecommendedAction}`
      : null,
    intelligence?.autofixCandidate
      ? `Autofix: ${intelligence.autofixCandidate.status} · ${intelligence.autofixCandidate.summary}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return (
    <>
      <div className={styles.bodyText}>
        {intelligence?.summary ??
          detail.reviewGate?.summary ??
          (detail.reviewProfileId ? options.fallbackLabel : options.emptyLabel)}
      </div>
      {renderDetailList(lines, options.emptyLabel)}
    </>
  );
}

export function renderReviewIntelligenceActions(
  detail: ReviewIntelligenceDetail,
  options: {
    reviewAgentLabel?: string;
    runReviewAgentEnabled?: boolean;
    runningReviewAgent?: boolean;
    autofixEnabled?: boolean;
    applyingReviewAutofix?: boolean;
    reviewAutomationError?: string | null;
    actionHandlers: ReviewIntelligenceActionHandlers;
  }
) {
  const hasRunReviewAgentAction = typeof options.actionHandlers.onRunReviewAgent === "function";
  const hasAutofixAction =
    typeof options.actionHandlers.onApplyReviewAutofix === "function" &&
    (detail.reviewIntelligence?.autofixCandidate?.status ?? detail.autofixCandidate?.status) ===
      "available";
  const hasRelaunchAction =
    typeof options.actionHandlers.onRelaunchWithFindings === "function" &&
    getReviewFindings(detail).length > 0;

  if (!hasRunReviewAgentAction && !hasAutofixAction && !hasRelaunchAction) {
    return null;
  }

  return (
    <ReviewActionRail className={styles.interventionActions}>
      {hasRunReviewAgentAction ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={options.runReviewAgentEnabled === false || options.runningReviewAgent === true}
          onClick={() => options.actionHandlers.onRunReviewAgent?.()}
        >
          {options.runningReviewAgent
            ? "Launching review..."
            : (options.reviewAgentLabel ?? "Run review agent")}
        </Button>
      ) : null}
      {hasAutofixAction ? (
        <Button
          type="button"
          size="sm"
          disabled={options.autofixEnabled === false || options.applyingReviewAutofix === true}
          onClick={() => options.actionHandlers.onApplyReviewAutofix?.()}
        >
          {options.applyingReviewAutofix ? "Applying autofix..." : "Apply bounded autofix"}
        </Button>
      ) : null}
      {hasRelaunchAction ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => options.actionHandlers.onRelaunchWithFindings?.()}
        >
          Relaunch with findings
        </Button>
      ) : null}
      {options.reviewAutomationError ? (
        <span className={styles.interventionError}>{options.reviewAutomationError}</span>
      ) : null}
    </ReviewActionRail>
  );
}

export function renderReviewIntelligenceBlock(
  detail: ReviewIntelligenceDetail,
  options: {
    emptyLabel: string;
    fallbackLabel: string;
    scopeKey: string;
    runningReviewAgentKey: string | null;
    applyingReviewAutofixKey: string | null;
    reviewAutomationError?: string | null;
    reviewAgentLabel?: string;
    runReviewAgentEnabled?: boolean;
    autofixEnabled?: boolean;
    actionHandlers: ReviewIntelligenceActionHandlers;
  }
) {
  const isActiveScope =
    options.runningReviewAgentKey === options.scopeKey ||
    options.applyingReviewAutofixKey === options.scopeKey;
  return (
    <>
      {renderReviewIntelligenceSummary(detail, {
        emptyLabel: options.emptyLabel,
        fallbackLabel: options.fallbackLabel,
      })}
      {renderReviewIntelligenceActions(detail, {
        reviewAgentLabel: options.reviewAgentLabel,
        runReviewAgentEnabled: options.runReviewAgentEnabled,
        runningReviewAgent: options.runningReviewAgentKey === options.scopeKey,
        autofixEnabled: options.autofixEnabled,
        applyingReviewAutofix: options.applyingReviewAutofixKey === options.scopeKey,
        reviewAutomationError: isActiveScope ? (options.reviewAutomationError ?? null) : null,
        actionHandlers: options.actionHandlers,
      })}
    </>
  );
}

type CockpitSnapshot =
  | ReviewPackDetailModel["operatorSnapshot"]
  | MissionRunDetailModel["operatorSnapshot"];

type CockpitPlacement = ReviewPackDetailModel["placement"] | MissionRunDetailModel["placement"];

type CockpitGovernance = ReviewPackDetailModel["governance"] | MissionRunDetailModel["governance"];

type CockpitEvidence =
  | ReviewPackDetailModel["workspaceEvidence"]
  | MissionRunDetailModel["workspaceEvidence"];

export function renderValidationItems(
  detail: Pick<ReviewPackDetailModel | MissionRunDetailModel, "validations" | "emptySectionLabels">
) {
  const validations = detail.validations ?? [];
  if (validations.length === 0) {
    return <div className={styles.bodyText}>{detail.emptySectionLabels.validations}</div>;
  }
  return (
    <ul className={styles.bulletList}>
      {validations.map((validation) => (
        <li key={validation.id} className={styles.bulletItem}>
          <span className={styles.bulletHeadline}>
            {validation.label} | {validation.outcome}
          </span>
          <span className={styles.bulletCopy}>{validation.summary}</span>
        </li>
      ))}
    </ul>
  );
}

export function renderWarnings(
  detail: Pick<ReviewPackDetailModel | MissionRunDetailModel, "warnings" | "emptySectionLabels">
) {
  if (detail.warnings.length === 0) {
    return <div className={styles.bodyText}>{detail.emptySectionLabels.warnings}</div>;
  }
  return (
    <ul className={styles.bulletList}>
      {detail.warnings.map((warning) => (
        <li key={warning} className={styles.bulletItem}>
          <span className={styles.bulletCopy}>{warning}</span>
        </li>
      ))}
    </ul>
  );
}

export function renderArtifacts(
  detail: Pick<ReviewPackDetailModel | MissionRunDetailModel, "artifacts" | "emptySectionLabels">
) {
  const artifacts = detail.artifacts ?? [];
  if (artifacts.length === 0) {
    return <div className={styles.bodyText}>{detail.emptySectionLabels.artifacts}</div>;
  }
  return (
    <ul className={styles.bulletList}>
      {artifacts.map((artifact) => (
        <li key={artifact.id} className={styles.bulletItem}>
          <span className={styles.bulletHeadline}>
            {artifact.label} | {artifact.kind}
          </span>
          {artifact.uri ? <span className={styles.bulletCopy}>{artifact.uri}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function renderDetailList(items: string[], emptyLabel: string) {
  if (items.length === 0) {
    return <div className={styles.bodyText}>{emptyLabel}</div>;
  }
  return (
    <ul className={styles.publishList}>
      {items.map((item) => (
        <li key={item} className={styles.publishItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function renderTrajectory(snapshot: CockpitSnapshot) {
  if (!snapshot || snapshot.recentEvents.length === 0) {
    return <div className={styles.bodyText}>Runtime did not publish recent trajectory events.</div>;
  }
  return (
    <ul className={styles.trajectoryList}>
      {snapshot.recentEvents.map((event) => (
        <li
          key={`${event.kind ?? "event"}-${event.label}-${event.at ?? "none"}-${event.detail ?? "none"}`}
          className={styles.trajectoryItem}
        >
          <div className={styles.trajectoryHeader}>
            <span className={styles.trajectoryLabel}>{event.label}</span>
            <span className={styles.trajectoryMeta}>
              {event.kind ? event.kind.replaceAll("_", " ") : "event"}
              {event.at ? ` | ${formatRelativeTime(event.at)}` : ""}
            </span>
          </div>
          {event.detail ? <div className={styles.bodyText}>{event.detail}</div> : null}
        </li>
      ))}
    </ul>
  );
}

export function renderOperatorSnapshot(snapshot?: CockpitSnapshot) {
  if (!snapshot) {
    return <div className={styles.bodyText}>Runtime did not publish a run-operator snapshot.</div>;
  }
  return (
    <div className={styles.publishHandoff}>
      <div className={styles.publishHandoffLabel}>{snapshot.summary}</div>
      {snapshot.currentActivity ? (
        <div className={styles.bodyText}>Current activity: {snapshot.currentActivity}</div>
      ) : null}
      {snapshot.blocker ? <div className={styles.bodyText}>Blocker: {snapshot.blocker}</div> : null}
      {snapshot.details.length > 0 ? (
        <ul className={styles.publishList}>
          {snapshot.details.map((item) => (
            <li key={item} className={styles.publishItem}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {snapshot.recentEvents.length > 0 ? (
        <ul className={styles.publishList}>
          {snapshot.recentEvents.map((event) => (
            <li
              key={`${event.label}-${event.at ?? "none"}-${event.detail ?? "none"}`}
              className={styles.publishItem}
            >
              {event.label}
              {event.detail ? `: ${event.detail}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function renderWorkspaceEvidence(
  evidence?: CockpitEvidence,
  options?: {
    focusedBucketKind?: string | null;
    onFocusBucket?: ((kind: string | null) => void) | undefined;
  }
) {
  if (!evidence) {
    return <div className={styles.bodyText}>Runtime did not publish workspace evidence.</div>;
  }
  const focusedBucketKind = options?.focusedBucketKind ?? null;
  const visibleBuckets = focusedBucketKind
    ? evidence.buckets.filter((bucket) => bucket.kind === focusedBucketKind)
    : evidence.buckets;
  return (
    <div className={styles.publishHandoff} data-testid="workspace-evidence-detail">
      <div className={styles.publishHandoffLabel}>Review evidence snapshot</div>
      <div className={styles.publishHandoffLabel}>{evidence.summary}</div>
      <div className={styles.evidenceActionRow}>
        {evidence.buckets.map((bucket) => (
          <Button
            key={bucket.kind}
            type="button"
            size="sm"
            variant={focusedBucketKind === bucket.kind ? "secondary" : "ghost"}
            aria-label={`Focus ${bucket.label} evidence`}
            onClick={() => options?.onFocusBucket?.(bucket.kind)}
          >
            {bucket.label}
          </Button>
        ))}
        {focusedBucketKind ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => options?.onFocusBucket?.(null)}
          >
            Show all evidence
          </Button>
        ) : null}
      </div>
      {visibleBuckets.map((bucket) => (
        <div key={bucket.kind} className={styles.publishHandoff}>
          {bucket.kind === "changedFiles" || bucket.kind === "diffs" ? (
            <ReviewEvidenceDiffBucket bucket={bucket} />
          ) : (
            <>
              <div className={styles.publishHandoffLabel}>{bucket.label}</div>
              <div className={styles.bodyText}>{bucket.summary}</div>
              {bucket.items.length > 0 ? (
                <ul className={styles.publishList}>
                  {bucket.items.map((item) => (
                    <li key={`${bucket.kind}-${item.label}`} className={styles.publishItem}>
                      {item.label}
                      {item.detail ? `: ${item.detail}` : ""}
                      {item.uri ? ` (${item.uri})` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          {bucket.items.length === 0 && bucket.missingReason ? (
            <div className={styles.bodyText}>{bucket.missingReason}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ReviewEvidenceDiffBucket({
  bucket,
}: {
  bucket: NonNullable<CockpitEvidence>["buckets"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <DiffReviewPanel
      title={bucket.label}
      description={bucket.summary}
      summaryLabel={`${bucket.items.length} ${bucket.items.length === 1 ? "item" : "items"}`}
      statusLabel="Recorded"
      statusTone="success"
      showToggleLabel={`Show ${bucket.label.toLowerCase()}`}
      hideToggleLabel={`Hide ${bucket.label.toLowerCase()}`}
      files={bucket.items.map((item) => ({
        path: item.label,
        status:
          item.detail && item.uri
            ? `${item.detail} (${item.uri})`
            : (item.detail ?? item.uri ?? "Recorded"),
      }))}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((value) => !value)}
    >
      <ul className={styles.publishList}>
        {bucket.items.map((item) => (
          <li key={`${bucket.kind}-${item.label}`} className={styles.publishItem}>
            {item.label}
            {item.detail ? `: ${item.detail}` : ""}
            {item.uri ? ` (${item.uri})` : ""}
          </li>
        ))}
      </ul>
    </DiffReviewPanel>
  );
}

export function renderOperatorCockpit(input: {
  operatorSnapshot?: CockpitSnapshot;
  placement?: CockpitPlacement;
  governance?: CockpitGovernance;
  approval?: {
    label: string | null;
    summary: string | null;
  } | null;
  nextAction: {
    label: string;
    detail: string | null;
  };
  workspaceEvidence?: CockpitEvidence;
  focusedEvidenceBucketKind?: string | null;
  onFocusEvidenceBucket?: (kind: string | null) => void;
  actions?: Array<{
    id: string;
    label: string;
    onClick: () => void;
    variant?: "ghost" | "secondary";
  }>;
}) {
  const attentionItems = [
    input.operatorSnapshot?.currentActivity
      ? `Current activity: ${input.operatorSnapshot.currentActivity}`
      : null,
    input.operatorSnapshot?.blocker ?? null,
    input.approval?.label
      ? `${input.approval.label}: ${input.approval.summary ?? "Runtime is waiting for operator review."}`
      : null,
    input.governance?.summary ?? null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className={styles.cockpit} data-testid="operator-cockpit">
      <div className={styles.cockpitHeader}>
        <div className={styles.cockpitEyebrow}>Operator cockpit</div>
        <div className={styles.cockpitSummary}>
          {input.operatorSnapshot?.summary ??
            input.placement?.summary ??
            input.governance?.summary ??
            input.nextAction.label}
        </div>
        {attentionItems.length > 0 ? (
          <div className={styles.attentionList}>
            {attentionItems.map((item) => (
              <span key={item} className={styles.attentionItem}>
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {input.actions && input.actions.length > 0 ? (
          <div className={styles.evidenceActionRow}>
            {input.actions.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant={action.variant ?? "secondary"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={styles.cockpitGrid}>
        <div className={styles.cockpitPanel}>
          <div className={styles.cockpitPanelTitle}>Run operator</div>
          {renderOperatorSnapshot(input.operatorSnapshot)}
        </div>
        <div className={styles.cockpitPanel}>
          <div className={styles.cockpitPanelTitle}>Placement evidence</div>
          <div className={styles.bodyText}>
            {input.placement?.summary ?? "Placement evidence was not published."}
          </div>
          {renderDetailList(
            input.placement?.details ?? [],
            "Placement evidence was not published."
          )}
        </div>
        <div className={styles.cockpitPanel}>
          <div className={styles.cockpitPanelTitle}>Governance and approval</div>
          <div className={styles.bodyText}>
            {input.governance?.summary ??
              input.approval?.summary ??
              "Governance and approval detail was not published."}
          </div>
          {input.approval?.label ? (
            <div className={styles.bodyText}>{input.approval.label}</div>
          ) : null}
          {renderDetailList(
            input.governance?.details ?? [],
            "Governance detail was not published."
          )}
        </div>
        <div className={styles.cockpitPanel}>
          <div className={styles.cockpitPanelTitle}>Next operator action</div>
          <div className={styles.bodyText}>{input.nextAction.label}</div>
          {input.nextAction.detail ? (
            <div className={styles.bodyText}>{input.nextAction.detail}</div>
          ) : (
            <div className={styles.bodyText}>Runtime did not publish next-action detail.</div>
          )}
        </div>
      </div>

      <div className={styles.cockpitPanel}>
        <div className={styles.cockpitPanelTitle}>Execution trajectory</div>
        {renderTrajectory(input.operatorSnapshot)}
      </div>

      <div className={styles.cockpitPanel}>
        <div className={styles.cockpitPanelTitle}>Workspace evidence</div>
        {renderWorkspaceEvidence(input.workspaceEvidence, {
          focusedBucketKind: input.focusedEvidenceBucketKind,
          onFocusBucket: input.onFocusEvidenceBucket,
        })}
      </div>
    </div>
  );
}
