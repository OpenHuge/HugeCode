import { useMemo, useState } from "react";
import { formatRuntimeContinuationStateLabel } from "@ku0/code-runtime-host-contract";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ReviewActionRail,
  ReviewLoopHeader,
  ReviewSignalGroup,
  ReviewSummaryCard,
  StatusBadge,
  Surface,
} from "../../../design-system";
import { formatRelativeTime } from "../../../utils/time";
import {
  formatMissionControlFreshnessLabel,
  formatMissionOverviewStateLabel,
  type MissionControlFreshnessState,
  type MissionNavigationTarget,
  type MissionReviewEntry,
} from "../../missions/utils/missionControlPresentation";
import { resolveMissionEntryActionLabel } from "../../missions/utils/missionNavigation";
import * as styles from "./ReviewQueuePanel.css";

type ReviewQueueFilter =
  | "all"
  | "critical_review"
  | "needs_attention"
  | "autofix_ready"
  | "blocked_follow_up"
  | "incomplete_evidence"
  | "fallback_routing"
  | "sub_agent_blocked";

type ReviewQueuePanelProps = {
  workspaceName?: string | null;
  items: MissionReviewEntry[];
  selectedReviewPackId?: string | null;
  selectedRunId?: string | null;
  freshness?: MissionControlFreshnessState | null;
  onRefresh?: () => void;
  onSelectReviewPack?: (entry: MissionReviewEntry) => void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
};

function resolveContinuationTone(
  continuationState: MissionReviewEntry["continuationState"]
): "warning" | "progress" | "default" {
  if (continuationState === "blocked" || continuationState === "attention") {
    return "warning";
  }
  if (continuationState && continuationState !== "missing") {
    return "progress";
  }
  return "default";
}

function resolveReviewGateTone(
  reviewGateState: MissionReviewEntry["reviewGateState"]
): "warning" | "success" | "default" {
  if (reviewGateState === "fail" || reviewGateState === "blocked" || reviewGateState === "warn") {
    return "warning";
  }
  if (reviewGateState === "pass") {
    return "success";
  }
  return "default";
}

function resolveEntrySelection(
  entry: MissionReviewEntry,
  selectedReviewPackId: string | null,
  selectedRunId: string | null
) {
  if (entry.reviewPackId) {
    return entry.reviewPackId === selectedReviewPackId;
  }
  return entry.runId === selectedRunId;
}

function getReviewFindingCount(entry: MissionReviewEntry): number {
  return typeof entry.reviewFindingCount === "number" ? entry.reviewFindingCount : 0;
}

function hasFilterTag(entry: MissionReviewEntry, tag: Exclude<ReviewQueueFilter, "all">): boolean {
  return (entry.filterTags ?? []).includes(tag);
}

function isCriticalReviewEntry(entry: MissionReviewEntry): boolean {
  return (
    hasFilterTag(entry, "critical_review") ||
    entry.reviewGateState === "fail" ||
    entry.reviewGateState === "blocked" ||
    entry.highestReviewSeverity === "critical"
  );
}

function isAutofixReadyEntry(entry: MissionReviewEntry): boolean {
  return hasFilterTag(entry, "autofix_ready") || entry.autofixAvailable === true;
}

function isBlockedFollowUpEntry(entry: MissionReviewEntry): boolean {
  return (
    hasFilterTag(entry, "blocked_follow_up") ||
    entry.continuationState === "blocked" ||
    entry.continuationState === "attention" ||
    hasFilterTag(entry, "sub_agent_blocked")
  );
}

function matchesFilter(entry: MissionReviewEntry, filter: ReviewQueueFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "critical_review":
      return isCriticalReviewEntry(entry);
    case "needs_attention":
      return hasFilterTag(entry, "needs_attention");
    case "autofix_ready":
      return isAutofixReadyEntry(entry);
    case "blocked_follow_up":
      return isBlockedFollowUpEntry(entry);
    case "incomplete_evidence":
      return hasFilterTag(entry, "incomplete_evidence");
    case "fallback_routing":
      return hasFilterTag(entry, "fallback_routing");
    case "sub_agent_blocked":
      return hasFilterTag(entry, "sub_agent_blocked");
    default:
      return false;
  }
}

function resolveQueuePriority(entry: MissionReviewEntry): number {
  let score = 0;

  if (isCriticalReviewEntry(entry)) {
    score += 400;
  }
  if (isBlockedFollowUpEntry(entry)) {
    score += 300;
  }
  if (isAutofixReadyEntry(entry)) {
    score += 200;
  }
  if (hasFilterTag(entry, "needs_attention")) {
    score += 100;
  }
  if (hasFilterTag(entry, "incomplete_evidence")) {
    score += 80;
  }
  if (hasFilterTag(entry, "fallback_routing")) {
    score += 60;
  }
  if (hasFilterTag(entry, "sub_agent_blocked")) {
    score += 40;
  }

  score += Math.min(getReviewFindingCount(entry), 9);
  score += Math.min(entry.warningCount, 5);

  return score;
}

function buildPrioritySummary(entry: MissionReviewEntry): string | null {
  const details = [
    isCriticalReviewEntry(entry) ? "Critical review" : null,
    isBlockedFollowUpEntry(entry) ? "Blocked follow-up" : null,
    isAutofixReadyEntry(entry) ? "Autofix ready" : null,
    getReviewFindingCount(entry) > 0 ? `${getReviewFindingCount(entry)} findings` : null,
    entry.highestReviewSeverity ? `Highest severity ${entry.highestReviewSeverity}` : null,
  ].filter((value): value is string => Boolean(value));

  return details.length > 0 ? details.join(" | ") : null;
}

export function ReviewQueuePanel({
  workspaceName = null,
  items,
  selectedReviewPackId = null,
  selectedRunId = null,
  freshness = null,
  onRefresh,
  onSelectReviewPack = () => undefined,
  onOpenMissionTarget = () => undefined,
}: ReviewQueuePanelProps) {
  const [activeFilter, setActiveFilter] = useState<ReviewQueueFilter>("all");
  const freshnessLabel = freshness ? formatMissionControlFreshnessLabel(freshness) : null;
  const title = workspaceName ? `${workspaceName} mission triage` : "Mission triage";
  const filterCounts = useMemo(
    () => ({
      all: items.length,
      critical_review: items.filter((item) => matchesFilter(item, "critical_review")).length,
      needs_attention: items.filter((item) => matchesFilter(item, "needs_attention")).length,
      autofix_ready: items.filter((item) => matchesFilter(item, "autofix_ready")).length,
      blocked_follow_up: items.filter((item) => matchesFilter(item, "blocked_follow_up")).length,
      incomplete_evidence: items.filter((item) => matchesFilter(item, "incomplete_evidence"))
        .length,
      fallback_routing: items.filter((item) => matchesFilter(item, "fallback_routing")).length,
      sub_agent_blocked: items.filter((item) => matchesFilter(item, "sub_agent_blocked")).length,
    }),
    [items]
  );
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => matchesFilter(item, activeFilter))
        .slice()
        .sort((left, right) => {
          const priorityDelta = resolveQueuePriority(right) - resolveQueuePriority(left);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }
          return (
            (right.queueEnteredAt ?? right.createdAt) - (left.queueEnteredAt ?? left.createdAt)
          );
        }),
    [activeFilter, items]
  );

  return (
    <Surface
      className={styles.panel}
      data-testid="review-queue-panel"
      data-review-loop-panel="triage"
      padding="lg"
      tone="translucent"
    >
      <ReviewLoopHeader
        eyebrow="Mission triage"
        title={title}
        description="Runtime review truth, run-only blockers, relaunch signals, and publish handoffs stay visible here before you open detail."
        signals={
          freshnessLabel ? (
            <ReviewSignalGroup>
              <StatusBadge>{freshnessLabel}</StatusBadge>
            </ReviewSignalGroup>
          ) : undefined
        }
        actions={
          onRefresh ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void onRefresh();
              }}
            >
              Refresh
            </Button>
          ) : undefined
        }
      />

      <div className={styles.summaryGrid}>
        <ReviewSummaryCard
          label="All"
          value={filterCounts.all}
          detail="Runtime-backed queue items"
        />
        <ReviewSummaryCard
          label="Critical now"
          value={filterCounts.critical_review}
          detail="Blocked gates or critical review severity"
          tone={filterCounts.critical_review > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Needs attention"
          value={filterCounts.needs_attention}
          detail="Approval, intervention, or degraded review"
          tone={filterCounts.needs_attention > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Autofix ready"
          value={filterCounts.autofix_ready}
          detail="Bounded review fixes can be applied now"
          tone={filterCounts.autofix_ready > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Blocked follow-up"
          value={filterCounts.blocked_follow_up}
          detail="Continuation or delegated recovery is constrained"
          tone={filterCounts.blocked_follow_up > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Fallback routing"
          value={filterCounts.fallback_routing}
          detail="Routing degraded away from the preferred path"
          tone={filterCounts.fallback_routing > 0 ? "attention" : "default"}
        />
      </div>

      <ReviewActionRail className={styles.actionRow}>
        {(
          [
            ["all", "All"],
            ["critical_review", "Critical now"],
            ["needs_attention", "Needs attention"],
            ["autofix_ready", "Autofix ready"],
            ["blocked_follow_up", "Blocked follow-up"],
            ["incomplete_evidence", "Incomplete evidence"],
            ["fallback_routing", "Fallback routing"],
          ] as const
        ).map(([filterId, label]) => (
          <Button
            key={filterId}
            variant={activeFilter === filterId ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveFilter(filterId)}
          >
            {label}
            {filterCounts[filterId] > 0 ? ` (${filterCounts[filterId]})` : ""}
          </Button>
        ))}
      </ReviewActionRail>

      {visibleItems.length === 0 ? (
        <Card className={styles.emptyState} variant="subtle">
          {items.length === 0
            ? "No triage items yet. Runtime review packs and blocked delegated runs will appear here ahead of Git-side inference."
            : "No mission triage items match the active filter."}
        </Card>
      ) : (
        <div className={styles.list}>
          {visibleItems.map((entry) =>
            (() => {
              const isSelected = resolveEntrySelection(entry, selectedReviewPackId, selectedRunId);
              const prioritySummary = buildPrioritySummary(entry);
              const supervisionSignals = [
                entry.subAgentSignal,
                entry.failureClassLabel,
                entry.publishHandoffLabel,
                entry.relaunchLabel,
              ].filter((signal): signal is string => Boolean(signal));

              return (
                <Card
                  key={entry.id}
                  className={styles.itemCard}
                  data-testid={`review-queue-item-${entry.id}`}
                  padding="lg"
                  selected={isSelected}
                  header={
                    <div className={styles.itemHeader}>
                      <div className={styles.itemTitleBlock}>
                        <CardTitle className={styles.itemTitle}>{entry.title}</CardTitle>
                        <span className={styles.itemMeta}>
                          {formatMissionOverviewStateLabel(entry.state)}{" "}
                          {formatRelativeTime(entry.createdAt)}
                          {entry.secondaryLabel ? ` | ${entry.secondaryLabel}` : ""}
                        </span>
                      </div>
                      <ReviewSignalGroup className={styles.chipRow}>
                        {entry.continuationState && entry.continuationState !== "missing" ? (
                          <StatusBadge tone={resolveContinuationTone(entry.continuationState)}>
                            {formatRuntimeContinuationStateLabel(entry.continuationState)}
                          </StatusBadge>
                        ) : null}
                        {entry.accountabilityLifecycle ? (
                          <StatusBadge tone="progress">
                            {entry.accountabilityLifecycle.replace("_", " ")}
                          </StatusBadge>
                        ) : null}
                        {entry.reviewGateLabel ? (
                          <StatusBadge tone={resolveReviewGateTone(entry.reviewGateState)}>
                            {entry.reviewGateLabel}
                          </StatusBadge>
                        ) : null}
                        {isCriticalReviewEntry(entry) ? (
                          <StatusBadge tone="warning">Critical review</StatusBadge>
                        ) : null}
                        <StatusBadge>{entry.evidenceLabel}</StatusBadge>
                        {hasFilterTag(entry, "fallback_routing") ? (
                          <StatusBadge tone="warning">Fallback routing</StatusBadge>
                        ) : null}
                        {isBlockedFollowUpEntry(entry) ? (
                          <StatusBadge tone="warning">Blocked follow-up</StatusBadge>
                        ) : null}
                        {entry.warningCount > 0 ? (
                          <StatusBadge tone="warning">{`${entry.warningCount} warnings`}</StatusBadge>
                        ) : null}
                        {entry.autofixAvailable ? (
                          <StatusBadge tone="progress">Autofix available</StatusBadge>
                        ) : null}
                      </ReviewSignalGroup>
                    </div>
                  }
                  footer={
                    <div className={styles.footer}>
                      <span className={styles.footerCopy}>
                        {entry.recommendedNextAction ??
                          (entry.kind === "mission_run"
                            ? "Inspect runtime state, unblock the run, or relaunch with updated context."
                            : "Inspect runtime evidence, validate the change, then accept or retry.")}
                      </span>
                      {entry.continuationLabel || entry.continuePathLabel ? (
                        <span className={styles.footerCopy}>
                          {[
                            entry.continuationLabel,
                            entry.continuePathLabel
                              ? `Continue via ${entry.continuePathLabel}.`
                              : null,
                          ]
                            .filter((value): value is string => Boolean(value))
                            .join(" ")}
                        </span>
                      ) : null}
                      {entry.continuityOverview ? (
                        <span className={styles.footerCopy}>{entry.continuityOverview}</span>
                      ) : null}
                      {entry.contextSummary || entry.triageSummary || entry.delegationSummary ? (
                        <span className={styles.footerCopy}>
                          {[entry.contextSummary, entry.triageSummary, entry.delegationSummary]
                            .filter((value): value is string => Boolean(value))
                            .join(" | ")}
                        </span>
                      ) : null}
                      {entry.provenanceSummary ? (
                        <span className={styles.footerCopy}>{entry.provenanceSummary}</span>
                      ) : null}
                      <ReviewActionRail className={styles.actionRow}>
                        {(() => {
                          const operatorActionTarget =
                            entry.operatorActionTarget ?? entry.navigationTarget;
                          const operatorActionLabel = resolveMissionEntryActionLabel({
                            operatorActionLabel: entry.operatorActionLabel,
                            operatorActionTarget: entry.operatorActionTarget ?? null,
                            navigationTarget: entry.navigationTarget,
                          });
                          return (
                            <>
                              <Button
                                variant={isSelected ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => onSelectReviewPack(entry)}
                              >
                                {isSelected ? "Selected" : "Inspect detail"}
                              </Button>
                              <Button
                                variant={
                                  operatorActionTarget.kind === "thread" ? "ghost" : "secondary"
                                }
                                size="sm"
                                onClick={() => onOpenMissionTarget(operatorActionTarget)}
                              >
                                {operatorActionLabel}
                              </Button>
                            </>
                          );
                        })()}
                      </ReviewActionRail>
                    </div>
                  }
                >
                  <CardDescription className={styles.summary}>{entry.summary}</CardDescription>
                  {entry.operatorSignal ? (
                    <div className={styles.footerCopy}>{entry.operatorSignal}</div>
                  ) : null}
                  {entry.governanceSummary ? (
                    <div className={styles.footerCopy}>{entry.governanceSummary}</div>
                  ) : null}
                  {entry.routeDetail ? (
                    <div className={styles.footerCopy}>{entry.routeDetail}</div>
                  ) : null}
                  {prioritySummary ? (
                    <div className={styles.footerCopy}>Triage: {prioritySummary}</div>
                  ) : null}
                  {entry.operatorActionLabel ? (
                    <div className={styles.footerCopy}>
                      Next action: {entry.operatorActionLabel}
                      {entry.operatorActionDetail ? ` · ${entry.operatorActionDetail}` : ""}
                    </div>
                  ) : null}
                  {entry.continuationTruthSourceLabel ? (
                    <div className={styles.footerCopy}>
                      Follow-up source: {entry.continuationTruthSourceLabel}
                    </div>
                  ) : null}
                  {entry.reviewProfileId || entry.highestReviewSeverity ? (
                    <div className={styles.footerCopy}>
                      {[
                        entry.reviewProfileId ? `Review profile: ${entry.reviewProfileId}` : null,
                        entry.highestReviewSeverity
                          ? `Highest review severity: ${entry.highestReviewSeverity}`
                          : null,
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(" | ")}
                    </div>
                  ) : null}
                  {supervisionSignals.length > 0 ? (
                    <div className={styles.chipRow}>
                      {supervisionSignals.map((signal) => (
                        <StatusBadge key={`${entry.id}-${signal}`}>{signal}</StatusBadge>
                      ))}
                    </div>
                  ) : null}
                  {(entry.attentionSignals?.length ?? 0) > 0 ? (
                    <div className={styles.chipRow}>
                      {entry.attentionSignals?.map((signal) => (
                        <StatusBadge key={`${entry.id}-attention-${signal}`}>{signal}</StatusBadge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              );
            })()
          )}
        </div>
      )}
    </Surface>
  );
}
