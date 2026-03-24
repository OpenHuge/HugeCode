import { useEffect, type ReactNode } from "react";
import {
  CardDescription,
  CardTitle,
  EmptySurface,
  StatusBadge,
  type StatusBadgeTone,
  Surface,
} from "../../../design-system";
import type { MissionControlProjection } from "../../../application/runtime/facades/runtimeMissionControlFacade";
import { describeMissionRunRouteDetail } from "../../missions/utils/missionControlPresentation";
import { HomeListRow } from "./HomeScaffold";
import { markFeatureVisible } from "../../shared/featurePerformance";
import * as styles from "./Home.styles.css";
import type { LatestAgentRun } from "./homeTypes";

type HomeRecentMissionsSectionProps = {
  isLoadingLatestAgents: boolean;
  latestAgentRuns: LatestAgentRun[];
  missionControlProjection?: MissionControlProjection | null;
  onOpenMission: (run: LatestAgentRun) => void;
};

type HomeSignalCardProps = {
  title: string;
  count: ReactNode;
  message: ReactNode;
  detail?: ReactNode;
  status: string;
  statusTone?: StatusBadgeTone;
  group?: ReactNode;
};

function HomeSignalCard({
  title,
  count,
  message,
  detail = null,
  status,
  statusTone = "default",
  group,
}: HomeSignalCardProps) {
  return (
    <div className={styles.dashboardCard}>
      <div className={styles.dashboardCardMain}>
        <div className={styles.dashboardCardHeading}>
          <div className={styles.dashboardCardTitleRow}>
            <CardTitle className={styles.dashboardCardTitle}>{title}</CardTitle>
            {group ? (
              <StatusBadge
                className={styles.dashboardCardGroup}
                data-home-dashboard-card-group="true"
              >
                {group}
              </StatusBadge>
            ) : null}
          </div>
          <span className={styles.dashboardCardMeta}>{count}</span>
        </div>
        <CardDescription className={styles.dashboardCardMessage}>{message}</CardDescription>
        {detail ? <div className={styles.dashboardCardDetail}>{detail}</div> : null}
      </div>
      <div className={styles.dashboardCardStatusRow}>
        <StatusBadge
          className={styles.dashboardCardStatus}
          tone={statusTone}
          data-home-dashboard-card-status="true"
        >
          {status}
        </StatusBadge>
      </div>
    </div>
  );
}

function HomeSectionEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Surface className={styles.emptyPanel} padding="md" tone="subtle" depth="card">
      <div className={styles.emptyPanelTitle}>{title}</div>
      <div className={styles.emptyPanelBody}>{body}</div>
    </Surface>
  );
}

function formatMissionTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function resolveRunStatusTone(statusKind: LatestAgentRun["statusKind"]): StatusBadgeTone {
  switch (statusKind) {
    case "review_ready":
      return "success";
    case "needs_input":
    case "attention":
      return "warning";
    case "active":
      return "progress";
    case "recent_activity":
    default:
      return "default";
  }
}

export function HomeRecentMissionsSection({
  isLoadingLatestAgents,
  latestAgentRuns,
  missionControlProjection = null,
  onOpenMission,
}: HomeRecentMissionsSectionProps) {
  useEffect(() => {
    markFeatureVisible("home_recent_missions");
  }, []);

  if (isLoadingLatestAgents && latestAgentRuns.length === 0) {
    return (
      <HomeSectionEmptyState title="Syncing missions" body="Recent missions will appear here." />
    );
  }

  if (latestAgentRuns.length === 0) {
    return <EmptySurface title="No recent missions yet." body="Start one from the composer." />;
  }

  return (
    <div className={styles.dashboardGrid} data-home-dashboard-grid="true">
      {latestAgentRuns.map((run) => (
        <HomeListRow key={run.threadId}>
          <button
            type="button"
            className={styles.dashboardCardButton}
            aria-label={`Open recent mission ${run.message}`}
            onClick={() => onOpenMission(run)}
            data-tauri-drag-region="false"
            data-testid={`home-recent-mission-${run.threadId}`}
          >
            <HomeSignalCard
              title={run.projectName}
              group={run.groupName}
              count={formatMissionTimestamp(run.timestamp)}
              message={run.message}
              detail={describeMissionRunRouteDetail(missionControlProjection, run.runId)}
              status={
                run.secondaryLabel ? `${run.statusLabel} | ${run.secondaryLabel}` : run.statusLabel
              }
              statusTone={resolveRunStatusTone(run.statusKind)}
            />
          </button>
        </HomeListRow>
      ))}
    </div>
  );
}
