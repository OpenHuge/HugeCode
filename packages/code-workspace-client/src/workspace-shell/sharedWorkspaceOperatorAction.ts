import type { MissionControlLoadState } from "./missionControlSnapshotStore";
import type { SharedMissionControlSummary } from "./sharedMissionControlSummary";
import type { SharedWorkspaceShellSection } from "./workspaceNavigation";

export type SharedWorkspaceOperatorAction = {
  tone: "ready" | "attention" | "blocked" | "idle";
  label: string;
  detail: string;
  targetSection: SharedWorkspaceShellSection;
  targetItemId: string | null;
  ctaLabel: string | null;
};

function formatMissionDetail(summary: SharedMissionControlSummary) {
  const item = summary.missionItems[0];
  if (item) {
    return `${item.title}: ${item.detail}`;
  }
  if (summary.runsCount > 0) {
    return `${summary.runsCount} runtime run${summary.runsCount === 1 ? "" : "s"} are active in the current shell scope.`;
  }
  return "No runtime runs have been published yet for this workspace slice.";
}

function formatReviewDetail(summary: SharedMissionControlSummary) {
  const item = summary.reviewItems[0];
  if (item) {
    return `${item.title}: ${item.summary}`;
  }
  if (summary.reviewPacksCount > 0) {
    return `${summary.reviewPacksCount} review pack${summary.reviewPacksCount === 1 ? "" : "s"} are available for inspection.`;
  }
  return "No review packs are waiting in the current shell scope.";
}

function formatMissionItemDetail(item: SharedMissionControlSummary["missionItems"][number]) {
  return `${item.title}: ${item.detail}`;
}

function findApprovalMissionItem(summary: SharedMissionControlSummary) {
  return summary.missionItems.find(
    (item) =>
      item.tone === "attention" &&
      (item.statusLabel === "Needs input" || /approval/iu.test(item.statusLabel))
  );
}

function buildSectionCtaLabel(section: SharedWorkspaceShellSection) {
  if (section === "workspaces") {
    return "Open workspaces";
  }
  if (section === "missions") {
    return "Open missions";
  }
  if (section === "review") {
    return "Open review";
  }
  if (section === "settings") {
    return "Open settings";
  }
  return null;
}

export function deriveSharedWorkspaceOperatorAction(input: {
  loadState: MissionControlLoadState;
  summary: SharedMissionControlSummary;
}): SharedWorkspaceOperatorAction {
  const { loadState, summary } = input;

  if (loadState === "idle" || loadState === "loading") {
    return {
      tone: "idle",
      label: "Loading runtime next action",
      detail: "Mission, review, and routing signals are still hydrating in the background.",
      targetSection: "home",
      targetItemId: null,
      ctaLabel: null,
    };
  }

  if (summary.launchReadiness.tone === "blocked") {
    return {
      tone: "blocked",
      label: "Fix launch routing",
      detail: summary.launchReadiness.detail,
      targetSection: "workspaces",
      targetItemId: null,
      ctaLabel: buildSectionCtaLabel("workspaces"),
    };
  }

  if (summary.approvalCount > 0) {
    const approvalMissionItem = findApprovalMissionItem(summary);
    return {
      tone: "attention",
      label: "Review pending approval",
      detail: approvalMissionItem
        ? formatMissionItemDetail(approvalMissionItem)
        : formatMissionDetail(summary),
      targetSection: "missions",
      targetItemId: approvalMissionItem?.id ?? summary.missionItems[0]?.id ?? null,
      ctaLabel: buildSectionCtaLabel("missions"),
    };
  }

  const blockedReviewItem = summary.reviewItems.find((item) => item.tone === "blocked");
  if (blockedReviewItem) {
    return {
      tone: "blocked",
      label: "Inspect failed review pack",
      detail: `${blockedReviewItem.title}: ${blockedReviewItem.summary}`,
      targetSection: "review",
      targetItemId: blockedReviewItem.id,
      ctaLabel: buildSectionCtaLabel("review"),
    };
  }

  if (summary.continuityReadiness.tone === "blocked") {
    return {
      tone: "blocked",
      label: "Recover blocked continuity",
      detail: summary.continuityReadiness.detail,
      targetSection: "review",
      targetItemId: null,
      ctaLabel: buildSectionCtaLabel("review"),
    };
  }

  if (summary.launchReadiness.tone === "attention") {
    return {
      tone: "attention",
      label: "Resolve routing attention",
      detail: summary.launchReadiness.detail,
      targetSection: "missions",
      targetItemId: summary.missionItems[0]?.id ?? null,
      ctaLabel: buildSectionCtaLabel("missions"),
    };
  }

  if (summary.runsCount === 0) {
    return {
      tone: summary.connectedWorkspaceCount > 0 ? "attention" : "blocked",
      label:
        summary.connectedWorkspaceCount > 0 ? "Launch the first mission" : "Connect a workspace",
      detail:
        summary.connectedWorkspaceCount > 0
          ? "Runtime is reachable, but no runs have been published yet for the current shell scope."
          : "Connect a workspace to inspect launch readiness, continuity truth, and review evidence.",
      targetSection: "workspaces",
      targetItemId: null,
      ctaLabel: buildSectionCtaLabel("workspaces"),
    };
  }

  if (summary.continuityReadiness.tone === "attention" && summary.reviewPacksCount === 0) {
    return {
      tone: "attention",
      label: "Inspect continuity attention",
      detail: summary.continuityReadiness.detail,
      targetSection: "review",
      targetItemId: summary.reviewItems[0]?.id ?? null,
      ctaLabel: buildSectionCtaLabel("review"),
    };
  }

  const readyReviewItem = summary.reviewItems.find((item) => item.tone === "ready");
  if (readyReviewItem) {
    return {
      tone: "ready",
      label: "Open ready review pack",
      detail: `${readyReviewItem.title}: ${readyReviewItem.summary}`,
      targetSection: "review",
      targetItemId: readyReviewItem.id,
      ctaLabel: buildSectionCtaLabel("review"),
    };
  }

  const attentionMissionItem = summary.missionItems.find(
    (item) => item.tone === "attention" || item.tone === "blocked"
  );
  if (attentionMissionItem) {
    return {
      tone: attentionMissionItem.tone === "blocked" ? "blocked" : "attention",
      label: "Resolve mission attention",
      detail: `${attentionMissionItem.title}: ${attentionMissionItem.detail}`,
      targetSection: "missions",
      targetItemId: attentionMissionItem.id,
      ctaLabel: buildSectionCtaLabel("missions"),
    };
  }

  const activeMissionItem = summary.missionItems.find((item) => item.tone === "active");
  if (activeMissionItem) {
    return {
      tone: "ready",
      label: "Supervise active mission",
      detail: `${activeMissionItem.title}: ${activeMissionItem.detail}`,
      targetSection: "missions",
      targetItemId: activeMissionItem.id,
      ctaLabel: buildSectionCtaLabel("missions"),
    };
  }

  if (summary.reviewPacksCount > 0) {
    return {
      tone: "ready",
      label: "Review published evidence",
      detail: formatReviewDetail(summary),
      targetSection: "review",
      targetItemId: summary.reviewItems[0]?.id ?? null,
      ctaLabel: buildSectionCtaLabel("review"),
    };
  }

  return {
    tone: "ready",
    label: "Monitor mission activity",
    detail: formatMissionDetail(summary),
    targetSection: "missions",
    targetItemId: summary.missionItems[0]?.id ?? null,
    ctaLabel: buildSectionCtaLabel("missions"),
  };
}
