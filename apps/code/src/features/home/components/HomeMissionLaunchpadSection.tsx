import { useEffect, type ReactNode } from "react";
import LayoutTemplate from "lucide-react/dist/esm/icons/layout-template";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import ScanSearch from "lucide-react/dist/esm/icons/scan-search";
import { Card, CardTitle, Icon, SectionHeader, Surface } from "../../../design-system";
import { joinClassNames } from "../../../utils/classNames";
import { HomeListRow } from "./HomeScaffold";
import { markFeatureVisible } from "../../shared/featurePerformance";
import * as launchpadStyles from "./HomeLaunchpad.styles.css";
import * as styles from "./Home.styles.css";

const launchpadStarters = [
  {
    id: "audit-ui",
    icon: ScanSearch,
    label: "Audit the UI",
    prompt:
      "Audit the current UI/UX of this project, identify the biggest friction points, and implement the highest-leverage improvements to make it feel like a top-tier product.",
  },
  {
    id: "design-surface",
    icon: LayoutTemplate,
    label: "Design a surface",
    prompt:
      "Design and implement a polished new user-facing surface for this project with strong visual hierarchy, responsive behavior, and production-ready UI details.",
  },
  {
    id: "ship-feature",
    icon: Rocket,
    label: "Ship a feature",
    prompt:
      "Implement the next high-value user-facing feature for this project, cover the edge cases, and verify the result with targeted tests before signoff.",
  },
] as const;

type Tone = "neutral" | "success" | "warning" | "accent";

type MissionSignalTileProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
};

function MissionSignalTile({
  label,
  value,
  detail,
  action,
  tone = "neutral",
  onClick,
  disabled = false,
  ariaLabel,
  testId,
}: MissionSignalTileProps) {
  const content = (
    <>
      <div className={styles.missionTileCopy}>
        <span className={styles.missionTileLabel}>{label}</span>
        {detail ? <div className={styles.missionTileDetail}>{detail}</div> : null}
      </div>
      <div className={styles.missionTileTrailing}>
        <span className={styles.missionTileValue} data-tone={tone}>
          {value}
        </span>
        {action ? (
          <div className={styles.missionTileAction} data-tone={tone}>
            {action}
          </div>
        ) : null}
      </div>
    </>
  );

  if (!onClick) {
    return (
      <HomeListRow className={styles.missionTile} data-testid={testId}>
        {content}
      </HomeListRow>
    );
  }

  return (
    <HomeListRow>
      <button
        type="button"
        className={joinClassNames(styles.missionTile, styles.missionTileButton)}
        onClick={onClick}
        disabled={disabled}
        data-tauri-drag-region="false"
        aria-label={ariaLabel}
        data-testid={testId}
      >
        {content}
      </button>
    </HomeListRow>
  );
}

type HomeMissionLaunchpadSectionProps = {
  isConnectionEntryState: boolean;
  showWorkspaceSummaryPanel: boolean;
  showRuntimeNotice: boolean;
  launchpadSetupHasSinglePanel: boolean;
  workspaceSummaryScope: string;
  workspaceSummaryTitle: ReactNode;
  workspaceSummaryMeta: ReactNode;
  workspaceSummaryDetail: ReactNode;
  resolvedRemotePlacement: {
    summary: string;
    detail: string | null;
    tone: "neutral" | "warning";
  } | null;
  workspacePlacementDetail: ReactNode;
  runtimeNotice: ReactNode;
  awaitingActionCount: ReactNode;
  awaitingActionDetail?: ReactNode;
  awaitingAction?: ReactNode;
  onAwaitingActionClick: () => void;
  awaitingActionDisabled: boolean;
  awaitingActionAriaLabel: string;
  reviewReadyCount: ReactNode;
  reviewReadyDetail?: ReactNode;
  reviewReadyAction?: ReactNode;
  onReviewReadyClick: () => void;
  reviewReadyDisabled: boolean;
  reviewReadyAriaLabel: string;
  routingValue: ReactNode;
  routingDetail?: ReactNode;
  routingAction?: ReactNode;
  routingTone: Tone;
  onRoutingClick: () => void;
  routingAriaLabel: string;
  onSetLaunchpadPrompt: (prompt: string) => void;
  launchpadPrompt: string;
};

export function HomeMissionLaunchpadSection({
  isConnectionEntryState,
  showWorkspaceSummaryPanel,
  showRuntimeNotice,
  launchpadSetupHasSinglePanel,
  workspaceSummaryScope,
  workspaceSummaryTitle,
  workspaceSummaryMeta,
  workspaceSummaryDetail,
  resolvedRemotePlacement,
  workspacePlacementDetail,
  runtimeNotice,
  awaitingActionCount,
  awaitingActionDetail,
  awaitingAction,
  onAwaitingActionClick,
  awaitingActionDisabled,
  awaitingActionAriaLabel,
  reviewReadyCount,
  reviewReadyDetail,
  reviewReadyAction,
  onReviewReadyClick,
  reviewReadyDisabled,
  reviewReadyAriaLabel,
  routingValue,
  routingDetail,
  routingAction,
  routingTone,
  onRoutingClick,
  routingAriaLabel,
  onSetLaunchpadPrompt,
  launchpadPrompt,
}: HomeMissionLaunchpadSectionProps) {
  useEffect(() => {
    markFeatureVisible("home_launchpad");
  }, []);

  return (
    <>
      <div className={styles.launchpadSetupGrid} data-home-launchpad-setup-grid="true">
        {showWorkspaceSummaryPanel ? (
          <div
            className={joinClassNames(
              styles.launchpadSetupItem,
              launchpadSetupHasSinglePanel && styles.launchpadSetupItemFullSpan
            )}
          >
            <Surface
              className={joinClassNames(
                launchpadStyles.heroMetaPanel,
                styles.workspaceSummaryPanel
              )}
              depth="card"
              padding="md"
              tone="elevated"
              data-testid="home-workspace-summary"
              data-workspace-summary-scope={workspaceSummaryScope}
            >
              <SectionHeader
                className={launchpadStyles.heroMetaHeader}
                title={workspaceSummaryTitle}
                meta={workspaceSummaryMeta}
                titleClassName={launchpadStyles.heroMetaValue}
                metaClassName={launchpadStyles.heroMetaEyebrow}
              />
              <div className={launchpadStyles.heroMetaBody}>
                {workspaceSummaryDetail ? (
                  <div className={launchpadStyles.heroMetaDetail}>{workspaceSummaryDetail}</div>
                ) : null}
                {resolvedRemotePlacement ? (
                  <div
                    className={`${launchpadStyles.heroPlacement} ${
                      resolvedRemotePlacement.tone === "warning"
                        ? launchpadStyles.heroPlacementWarning
                        : ""
                    }`}
                    data-tone={resolvedRemotePlacement.tone}
                  >
                    <div className={launchpadStyles.heroPlacementValue}>
                      {resolvedRemotePlacement.summary}
                    </div>
                    {workspacePlacementDetail ? (
                      <div className={launchpadStyles.heroPlacementDetail}>
                        {workspacePlacementDetail}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Surface>
          </div>
        ) : null}
        {showRuntimeNotice ? (
          <div
            className={joinClassNames(
              styles.launchpadSetupItem,
              launchpadSetupHasSinglePanel && styles.launchpadSetupItemFullSpan
            )}
          >
            {runtimeNotice}
          </div>
        ) : null}
      </div>
      {!isConnectionEntryState ? (
        <>
          <div className={styles.missionGrid} data-home-mission-grid="true">
            <MissionSignalTile
              label="Awaiting action"
              value={awaitingActionCount}
              detail={awaitingActionDetail}
              action={awaitingAction}
              tone={awaitingActionDisabled ? "success" : "warning"}
              onClick={onAwaitingActionClick}
              disabled={awaitingActionDisabled}
              ariaLabel={awaitingActionAriaLabel}
              testId="home-mission-signal-awaiting-action"
            />
            <MissionSignalTile
              label="Review-ready"
              value={reviewReadyCount}
              detail={reviewReadyDetail}
              action={reviewReadyAction}
              tone={reviewReadyDisabled ? "neutral" : "success"}
              onClick={onReviewReadyClick}
              disabled={reviewReadyDisabled}
              ariaLabel={reviewReadyAriaLabel}
              testId="home-mission-signal-review-ready"
            />
            <MissionSignalTile
              label="Routing"
              value={routingValue}
              detail={routingDetail}
              action={routingAction}
              tone={routingTone}
              onClick={onRoutingClick}
              ariaLabel={routingAriaLabel}
              testId="home-mission-signal-routing"
            />
          </div>
          <div
            className={launchpadStyles.starterSection}
            data-testid="home-starter-section"
            data-home-launchpad-layout="compact-grid"
          >
            <div className={launchpadStyles.starterGrid}>
              {launchpadStarters.map((starter) => (
                <HomeListRow key={starter.id}>
                  <button
                    type="button"
                    className={launchpadStyles.starterCardButton}
                    onClick={() => onSetLaunchpadPrompt(starter.prompt)}
                    data-tauri-drag-region="false"
                    data-testid={`home-launchpad-starter-${starter.id}`}
                  >
                    <Card
                      className={launchpadStyles.starterCard}
                      variant="subtle"
                      padding="sm"
                      data-selected={launchpadPrompt === starter.prompt ? "true" : "false"}
                    >
                      <div className={launchpadStyles.starterIcon} aria-hidden>
                        <Icon
                          icon={starter.icon}
                          size={18}
                          className={launchpadStyles.starterIconGlyph}
                        />
                      </div>
                      <div className={launchpadStyles.starterCopy}>
                        <div className={launchpadStyles.starterLabel}>
                          <CardTitle className={launchpadStyles.starterTitle}>
                            {starter.label}
                          </CardTitle>
                        </div>
                      </div>
                    </Card>
                  </button>
                </HomeListRow>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
