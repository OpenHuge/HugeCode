import type { ReactNode } from "react";
import type {
  MissionNavigationTarget,
  MissionOverviewEntry,
  MissionOverviewState,
} from "@ku0/code-application/runtimeMissionControlSurfaceModel";
import type { ThreadVisualState } from "../../threads/utils/threadExecutionState";
import { SidebarRow, SidebarSection } from "./SidebarScaffold";

type SidebarMissionQueueProps = {
  items: MissionOverviewEntry[];
  renderMissionTitle?: (title: string) => ReactNode;
  onOpenMissionTarget: (target: MissionNavigationTarget) => void;
};

function mapMissionStateToThreadVisualState(state: MissionOverviewState): ThreadVisualState {
  switch (state) {
    case "running":
      return "processing";
    case "needsAction":
      return "needsAttention";
    case "reviewReady":
      return "reviewing";
    case "ready":
    default:
      return "ready";
  }
}

function buildMissionSubline(item: MissionOverviewEntry) {
  const seenValues = new Set<string>();
  const parts = [
    { slot: "operatorAction", value: item.operatorActionLabel },
    { slot: "routeDetail", value: item.routeDetail },
    { slot: "governanceSummary", value: item.governanceSummary },
    { slot: "operatorSignal", value: item.operatorSignal },
    { slot: "attentionSignal", value: item.attentionSignals[0] ?? null },
  ].filter((part): part is { slot: string; value: string } => {
    const normalizedValue = part.value?.trim();
    if (!normalizedValue) {
      return false;
    }
    const dedupeKey = normalizedValue.toLowerCase();
    if (seenValues.has(dedupeKey)) {
      return false;
    }
    seenValues.add(dedupeKey);
    return true;
  });

  if (parts.length === 0) {
    return null;
  }

  return parts.map((part, index) => (
    <span key={`${item.threadId}-${part.slot}-${part.value}`}>
      {index > 0 ? (
        <span className="thread-secondary-separator" aria-hidden>
          {" "}
          ·{" "}
        </span>
      ) : null}
      <span className="thread-secondary-meta">{part.value}</span>
    </span>
  ));
}

export function SidebarMissionQueue({
  items,
  renderMissionTitle,
  onOpenMissionTarget,
}: SidebarMissionQueueProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarSection
      className="pinned-section"
      data-testid="sidebar-mission-queue"
      section="mission-queue"
    >
      <div className="workspace-group-header">
        <div className="workspace-group-label">Mission queue</div>
      </div>
      <div className="thread-list">
        {items.map((item) => {
          const statusClass = mapMissionStateToThreadVisualState(item.state);
          const target = item.operatorActionTarget ?? item.navigationTarget;
          const subline = buildMissionSubline(item);

          return (
            <SidebarRow
              key={item.threadId}
              className={`thread-row${item.isActive ? " active" : ""}`}
              data-thread-state={statusClass}
              title={item.title}
            >
              <span className="thread-leading" aria-hidden>
                <span className={`thread-status ${statusClass}`} aria-hidden />
              </span>
              <button
                type="button"
                className="thread-row-main"
                onClick={() => onOpenMissionTarget(target)}
              >
                <div className="thread-content">
                  <div className="thread-mainline">
                    <span className="thread-name">
                      {renderMissionTitle?.(item.title) ?? item.title}
                    </span>
                  </div>
                  {subline ? <div className="thread-subline">{subline}</div> : null}
                </div>
              </button>
            </SidebarRow>
          );
        })}
      </div>
    </SidebarSection>
  );
}
