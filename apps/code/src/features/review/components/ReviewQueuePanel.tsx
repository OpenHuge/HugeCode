import { useMemo, useState } from "react";
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
  | "needs_attention"
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
  if (continuationState === "blocked" || continuationState === "degraded") {
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
      needs_attention: items.filter((item) => (item.filterTags ?? []).includes("needs_attention"))
        .length,
      incomplete_evidence: items.filter((item) =>
        (item.filterTags ?? []).includes("incomplete_evidence")
      ).length,
      fallback_routing: items.filter((item) => (item.filterTags ?? []).includes("fallback_routing"))
        .length,
      sub_agent_blocked: items.filter((item) =>
        (item.filterTags ?? []).includes("sub_agent_blocked")
      ).length,
    }),
    [items]
  );
  const visibleItems = useMemo(
    () =>
      activeFilter === "all"
        ? items
        : items.filter((item) => (item.filterTags ?? []).includes(activeFilter)),
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
          label="Needs attention"
          value={filterCounts.needs_attention}
          detail="Approval, intervention, or degraded review"
          tone={filterCounts.needs_attention > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Fallback routing"
          value={filterCounts.fallback_routing}
          detail="Routing degraded away from the preferred path"
          tone={filterCounts.fallback_routing > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Sub-agent blocked"
          value={filterCounts.sub_agent_blocked}
          detail="Delegated work is waiting for operator recovery"
          tone={filterCounts.sub_agent_blocked > 0 ? "attention" : "default"}
        />
      </div>

      <ReviewActionRail className={styles.actionRow}>
        {(
          [
            ["all", "All"],
            ["needs_attention", "Needs attention"],
            ["incomplete_evidence", "Incomplete evidence"],
            ["fallback_routing", "Fallback routing"],
            ["sub_agent_blocked", "Sub-agent blocked"],
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
                            Follow-up {entry.continuationState}
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
                        <StatusBadge>{entry.evidenceLabel}</StatusBadge>
                        {(entry.filterTags ?? []).includes("fallback_routing") ? (
                          <StatusBadge tone="warning">Fallback routing</StatusBadge>
                        ) : null}
                        {(entry.filterTags ?? []).includes("sub_agent_blocked") ? (
                          <StatusBadge tone="warning">Sub-agent blocked</StatusBadge>
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
                      {entry.contextSummary || entry.triageSummary || entry.delegationSummary ? (
                        <span className={styles.footerCopy}>
                          {[entry.contextSummary, entry.triageSummary, entry.delegationSummary]
                            .filter((value): value is string => Boolean(value))
                            .join(" | ")}
                        </span>
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
                  {entry.operatorActionLabel ? (
                    <div className={styles.footerCopy}>
                      Next action: {entry.operatorActionLabel}
                      {entry.operatorActionDetail ? ` · ${entry.operatorActionDetail}` : ""}
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
