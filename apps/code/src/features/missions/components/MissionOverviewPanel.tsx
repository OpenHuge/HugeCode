import {
  Button,
  ReviewLoopHeader,
  ReviewSignalGroup,
  ReviewSummaryCard,
  StatusBadge,
  type StatusBadgeTone,
} from "../../../design-system";
import { formatRelativeTime } from "../../../utils/time";
import type {
  MissionControlFreshnessState,
  MissionNavigationTarget,
  MissionOverviewCounts,
  MissionOverviewEntry as MissionOverviewItem,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import {
  formatMissionControlFreshnessLabel,
  formatMissionOverviewStateLabel,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import { resolveMissionEntryFallbackSummary } from "../utils/missionNavigation";
import * as styles from "./MissionOverviewPanel.css";

export type { MissionOverviewCounts, MissionOverviewItem };

type MissionOverviewPanelProps = {
  workspaceName: string;
  counts: MissionOverviewCounts;
  items: MissionOverviewItem[];
  onSelectMission: (threadId: string) => void;
  onOpenMissionTarget?: (target: MissionNavigationTarget) => void;
  onOpenReviewMission?: (
    workspaceId: string,
    taskId: string,
    runId?: string | null,
    reviewPackId?: string | null
  ) => void;
  freshness?: MissionControlFreshnessState | null;
  onRefresh?: () => void;
};

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function getMissionStateTone(
  state: MissionOverviewItem["state"],
  isActive: boolean
): StatusBadgeTone {
  if (isActive || state === "running") {
    return "progress";
  }
  if (state === "needsAction") {
    return "warning";
  }
  if (state === "reviewReady") {
    return "success";
  }
  return "default";
}

export function MissionOverviewPanel({
  workspaceName,
  counts,
  items,
  onSelectMission,
  onOpenMissionTarget,
  onOpenReviewMission,
  freshness = null,
  onRefresh,
}: MissionOverviewPanelProps) {
  const freshnessLabel = freshness ? formatMissionControlFreshnessLabel(freshness) : null;

  return (
    <section
      className={styles.panel}
      data-testid="mission-overview-panel"
      data-review-loop-panel="mission-overview"
    >
      <ReviewLoopHeader
        eyebrow="Mission Index"
        title={workspaceName}
        description="Scan active missions, unblock stalled work, and jump directly into the next action center or mission thread that needs supervision."
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
        <ReviewSummaryCard label="Active" value={counts.active} detail="Currently running work." />
        <ReviewSummaryCard
          label="Waiting"
          value={counts.needsAction}
          detail="Waiting for approval, input, or plan follow-up."
          tone={counts.needsAction > 0 ? "attention" : "default"}
        />
        <ReviewSummaryCard
          label="Review Ready"
          value={counts.reviewReady}
          detail="Ready to inspect or accept."
          tone={counts.reviewReady > 0 ? "success" : "default"}
        />
        <ReviewSummaryCard
          label="Ready Queue"
          value={counts.ready}
          detail="Available to resume or continue."
        />
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          No missions yet. Start work from the composer and this surface will track the active queue
          for the current workspace.
        </div>
      ) : (
        <div className={styles.missionList}>
          {items.map((item) => (
            <button
              key={item.threadId}
              type="button"
              className={cx(styles.missionButton, item.isActive && styles.missionButtonActive)}
              onClick={() => {
                const target = item.operatorActionTarget ?? item.navigationTarget;
                if (target.kind !== "thread") {
                  if (onOpenMissionTarget) {
                    onOpenMissionTarget(target);
                    return;
                  }
                  onOpenReviewMission?.(
                    target.workspaceId,
                    target.taskId,
                    target.runId,
                    target.reviewPackId
                  );
                  return;
                }
                onSelectMission(target.threadId);
              }}
              data-testid={`mission-overview-item-${item.threadId}`}
            >
              <div className={styles.missionHeader}>
                <div className={styles.missionTitleBlock}>
                  <span className={styles.missionTitle}>{item.title}</span>
                  <span className={styles.missionMeta}>
                    Updated {formatRelativeTime(item.updatedAt)}
                    {item.secondaryLabel ? ` | ${item.secondaryLabel}` : ""}
                  </span>
                </div>
                <StatusBadge tone={getMissionStateTone(item.state, item.isActive)}>
                  {formatMissionOverviewStateLabel(item.state)}
                </StatusBadge>
              </div>
              <div className={styles.missionSummary}>
                {item.summary ?? resolveMissionEntryFallbackSummary(item.navigationTarget)}
              </div>
              {item.operatorSignal ? (
                <div className={styles.operatorSignal}>{item.operatorSignal}</div>
              ) : null}
              {item.governanceSummary ? (
                <div className={styles.missionDetail}>{item.governanceSummary}</div>
              ) : null}
              {item.routeDetail ? (
                <div className={styles.missionDetail}>{item.routeDetail}</div>
              ) : null}
              {item.operatorActionLabel ? (
                <div className={styles.missionDetail}>
                  Next action: {item.operatorActionLabel}
                  {item.operatorActionDetail ? ` · ${item.operatorActionDetail}` : ""}
                </div>
              ) : null}
              {item.continuationLabel || item.continuePathLabel ? (
                <div className={styles.missionDetail}>
                  {[
                    item.continuationLabel,
                    item.continuePathLabel ? `Continue via ${item.continuePathLabel}.` : null,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" ")}
                </div>
              ) : null}
              {item.attentionSignals.length > 0 ? (
                <ReviewSignalGroup className={styles.attentionSignals}>
                  {item.attentionSignals.map((signal) => (
                    <StatusBadge key={`${item.threadId}-${signal}`} tone="warning">
                      {signal}
                    </StatusBadge>
                  ))}
                </ReviewSignalGroup>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
