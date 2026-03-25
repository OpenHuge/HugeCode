import type {
  HugeCodeMissionActivityItem as SharedMissionActivityItem,
  HugeCodeMissionControlReadinessSummary as SharedMissionControlReadinessSummary,
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionControlSummary as SharedMissionControlSummary,
  HugeCodeReviewQueueItem as SharedReviewQueueItem,
} from "@ku0/code-runtime-host-contract";
import { buildRuntimeContinuationAggregate } from "@ku0/code-runtime-host-contract";

export type {
  SharedMissionActivityItem,
  SharedMissionControlReadinessSummary,
  SharedMissionControlSummary,
  SharedReviewQueueItem,
};

type ContinuitySignalCounts = {
  readyResumeCount: number;
  readyHandoffCount: number;
  readyReviewCount: number;
  attentionCount: number;
  blockedCount: number;
  reviewPackOnlyCount: number;
};

export const EMPTY_SHARED_MISSION_CONTROL_SUMMARY: SharedMissionControlSummary = {
  workspaceLabel: "No workspace selected",
  tasksCount: 0,
  runsCount: 0,
  approvalCount: 0,
  reviewPacksCount: 0,
  connectedWorkspaceCount: 0,
  launchReadiness: {
    tone: "idle",
    label: "Launch readiness",
    detail: "Select a workspace to inspect runtime launch readiness.",
  },
  continuityReadiness: {
    tone: "idle",
    label: "Continuity readiness",
    detail: "Checkpoint and review continuity signals appear once runs are available.",
  },
  missionItems: [],
  reviewItems: [],
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function countContinuitySignals(
  runs: HugeCodeMissionControlSnapshot["runs"]
): ContinuitySignalCounts {
  const aggregate = buildRuntimeContinuationAggregate({
    candidates: runs.map((run) => ({
      runId: run.id,
      taskId: run.taskId,
      runState: run.state,
      checkpoint: run.checkpoint ?? null,
      missionLinkage: run.missionLinkage ?? null,
      actionability: run.actionability ?? null,
      publishHandoff: run.publishHandoff ?? null,
      takeoverBundle: run.takeoverBundle ?? null,
      nextAction: run.nextAction ?? null,
      reviewPackId: run.reviewPackId ?? null,
    })),
  });
  const reviewPackOnlyRunIds = new Set(
    runs
      .filter(
        (run) =>
          Boolean(run.reviewPackId) &&
          !run.takeoverBundle &&
          !run.actionability &&
          !run.checkpoint &&
          !run.missionLinkage &&
          !run.publishHandoff
      )
      .map((run) => run.id)
  );

  return {
    readyResumeCount: aggregate.recoverableRunCount,
    readyHandoffCount: aggregate.handoffReadyCount,
    readyReviewCount: aggregate.reviewReadyCount,
    attentionCount: aggregate.items.filter(
      (item) => item.state === "attention" && !reviewPackOnlyRunIds.has(item.runId)
    ).length,
    blockedCount: aggregate.blockedCount,
    reviewPackOnlyCount: reviewPackOnlyRunIds.size,
  };
}

function buildLaunchReadiness(
  hasActiveWorkspace: boolean,
  activeWorkspaceConnected: boolean,
  runs: HugeCodeMissionControlSnapshot["runs"]
): SharedMissionControlReadinessSummary {
  if (!hasActiveWorkspace) {
    return EMPTY_SHARED_MISSION_CONTROL_SUMMARY.launchReadiness;
  }
  if (!activeWorkspaceConnected) {
    return {
      tone: "blocked",
      label: "Launch readiness",
      detail: "The selected workspace is not connected to the runtime.",
    };
  }
  if (runs.length === 0) {
    return {
      tone: "attention",
      label: "Launch readiness",
      detail: "The workspace is connected, but no runtime runs have reported placement yet.",
    };
  }
  const blockedCount = runs.filter((run) => run.placement?.readiness === "blocked").length;
  if (blockedCount > 0) {
    return {
      tone: "blocked",
      label: "Launch readiness",
      detail: `${pluralize(blockedCount, "run")} are blocked by routing readiness.`,
    };
  }
  const attentionCount = runs.filter((run) => run.placement?.readiness === "attention").length;
  if (attentionCount > 0) {
    return {
      tone: "attention",
      label: "Launch readiness",
      detail: `${pluralize(attentionCount, "run")} need routing attention before the next launch.`,
    };
  }
  return {
    tone: "ready",
    label: "Launch readiness",
    detail: "Connected routing is healthy for the current workspace slice.",
  };
}

function buildContinuityReadiness(
  hasActiveWorkspace: boolean,
  activeWorkspaceConnected: boolean,
  runs: HugeCodeMissionControlSnapshot["runs"],
  reviewPacks: HugeCodeMissionControlSnapshot["reviewPacks"]
): SharedMissionControlReadinessSummary {
  if (!hasActiveWorkspace) {
    return EMPTY_SHARED_MISSION_CONTROL_SUMMARY.continuityReadiness;
  }
  if (!activeWorkspaceConnected) {
    return {
      tone: "blocked",
      label: "Continuity readiness",
      detail:
        "The selected workspace must connect before checkpoint or review continuity can recover.",
    };
  }

  const counts = countContinuitySignals(runs);
  const readyCount = counts.readyResumeCount + counts.readyHandoffCount + counts.readyReviewCount;
  if (readyCount > 0) {
    const detailParts = [
      counts.readyResumeCount > 0
        ? `${pluralize(counts.readyResumeCount, "resume path")} ready`
        : null,
      counts.readyHandoffCount > 0
        ? `${pluralize(counts.readyHandoffCount, "handoff path")} ready`
        : null,
      counts.readyReviewCount > 0
        ? `${pluralize(counts.readyReviewCount, "review path")} ready`
        : null,
      counts.attentionCount > 0
        ? `${pluralize(counts.attentionCount, "run")} still need continuity attention`
        : null,
      counts.blockedCount > 0 ? `${pluralize(counts.blockedCount, "run")} remain blocked` : null,
      reviewPacks.length > 0 ? `${pluralize(reviewPacks.length, "review pack")} published` : null,
    ].filter((part): part is string => part !== null);

    return {
      tone: counts.blockedCount > 0 || counts.attentionCount > 0 ? "attention" : "ready",
      label: "Continuity readiness",
      detail: detailParts.join("; "),
    };
  }

  if (counts.blockedCount > 0) {
    return {
      tone: "blocked",
      label: "Continuity readiness",
      detail: `${pluralize(counts.blockedCount, "run")} are blocked and do not have a recoverable runtime-published continuation path yet.`,
    };
  }

  if (counts.attentionCount > 0 || counts.reviewPackOnlyCount > 0 || reviewPacks.length > 0) {
    const detailParts = [
      counts.attentionCount > 0
        ? `${pluralize(counts.attentionCount, "run")} published partial continuity signals`
        : null,
      counts.reviewPackOnlyCount > 0
        ? `${pluralize(counts.reviewPackOnlyCount, "run")} only expose review-pack references`
        : null,
      reviewPacks.length > 0 ? `${pluralize(reviewPacks.length, "review pack")} available` : null,
    ].filter((part): part is string => part !== null);

    return {
      tone: "attention",
      label: "Continuity readiness",
      detail:
        detailParts.join("; ") ||
        "Runtime continuity metadata exists, but no canonical resume or handoff path is ready yet.",
    };
  }

  return {
    tone: "attention",
    label: "Continuity readiness",
    detail:
      "No checkpoint, takeover bundle, handoff, or review actionability signals have been published yet.",
  };
}

function getWorkspaceName(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  workspaceId: string
) {
  return workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? workspaceId;
}

function getMissionItemTone(
  run: HugeCodeMissionControlSnapshot["runs"][number]
): SharedMissionActivityItem["tone"] {
  if (run.approval?.status === "pending_decision" || run.state === "needs_input") {
    return "attention";
  }
  if (run.placement?.readiness === "blocked") {
    return "blocked";
  }
  if (run.state === "running") {
    return "active";
  }
  if (run.reviewPackId) {
    return "ready";
  }
  return "neutral";
}

function getMissionStatusLabel(run: HugeCodeMissionControlSnapshot["runs"][number]) {
  if (run.approval?.label) {
    return run.approval.label;
  }
  if (run.state === "running") {
    return "In progress";
  }
  if (run.state === "needs_input") {
    return "Needs input";
  }
  if (run.reviewPackId) {
    return "Review ready";
  }
  return run.state.replace(/_/g, " ");
}

function buildMissionActivityItems(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  runs: HugeCodeMissionControlSnapshot["runs"]
): SharedMissionActivityItem[] {
  return [...runs]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 6)
    .map((run) => ({
      id: run.id,
      title: run.title || "Untitled run",
      workspaceName: getWorkspaceName(workspaces, run.workspaceId),
      statusLabel: getMissionStatusLabel(run),
      tone: getMissionItemTone(run),
      detail:
        run.summary ??
        run.approval?.summary ??
        run.placement?.summary ??
        "Runtime-backed mission status is available for this run.",
      highlights: [
        run.checkpoint?.summary ?? null,
        run.publishHandoff?.summary ?? null,
        run.actionability?.summary ?? null,
      ].filter((value): value is string => typeof value === "string" && value.length > 0),
    }));
}

function formatReviewStatusLabel(reviewStatus: string) {
  if (reviewStatus === "ready") {
    return "Ready";
  }
  return reviewStatus.replace(/_/g, " ");
}

function formatValidationLabel(validationOutcome: string) {
  if (validationOutcome === "passed") {
    return "Passed";
  }
  if (validationOutcome === "failed") {
    return "Failed";
  }
  return validationOutcome.replace(/_/g, " ");
}

function getReviewItemTone(
  reviewStatus: string,
  validationOutcome: string
): SharedReviewQueueItem["tone"] {
  if (validationOutcome === "failed") {
    return "blocked";
  }
  if (reviewStatus === "ready") {
    return "ready";
  }
  if (reviewStatus === "needs_input" || validationOutcome === "warning") {
    return "attention";
  }
  return "neutral";
}

function buildReviewQueueItems(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  reviewPacks: HugeCodeMissionControlSnapshot["reviewPacks"]
): SharedReviewQueueItem[] {
  return [...reviewPacks]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 6)
    .map((reviewPack) => ({
      id: reviewPack.id,
      title: reviewPack.summary,
      workspaceName: getWorkspaceName(workspaces, reviewPack.workspaceId),
      summary:
        reviewPack.recommendedNextAction ??
        reviewPack.summary ??
        "Review-ready evidence is available.",
      reviewStatusLabel: formatReviewStatusLabel(reviewPack.reviewStatus),
      validationLabel: formatValidationLabel(reviewPack.validationOutcome),
      tone: getReviewItemTone(reviewPack.reviewStatus, reviewPack.validationOutcome),
      warningCount: reviewPack.warningCount,
    }));
}

export function buildSharedMissionControlSummary(
  snapshot: HugeCodeMissionControlSnapshot | null,
  activeWorkspaceId: string | null
): SharedMissionControlSummary {
  if (!snapshot) {
    return EMPTY_SHARED_MISSION_CONTROL_SUMMARY;
  }

  const scopedWorkspaces = snapshot.workspaces;
  const connectedWorkspaceCount = scopedWorkspaces.filter(
    (workspace) => workspace.connected
  ).length;
  const activeWorkspace =
    (activeWorkspaceId
      ? (scopedWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null)
      : null) ?? null;
  const scopedTasks = activeWorkspaceId
    ? snapshot.tasks.filter((task) => task.workspaceId === activeWorkspaceId)
    : snapshot.tasks;
  const scopedRuns = activeWorkspaceId
    ? snapshot.runs.filter((run) => run.workspaceId === activeWorkspaceId)
    : snapshot.runs;
  const scopedReviewPacks = activeWorkspaceId
    ? snapshot.reviewPacks.filter((reviewPack) => reviewPack.workspaceId === activeWorkspaceId)
    : snapshot.reviewPacks;
  const approvalCount = scopedRuns.filter(
    (run) => run.approval?.status === "pending_decision" || run.state === "needs_input"
  ).length;
  const hasActiveWorkspace = activeWorkspaceId !== null;
  const workspaceLabel = hasActiveWorkspace
    ? (activeWorkspace?.name ?? "Selected workspace")
    : `${connectedWorkspaceCount}/${scopedWorkspaces.length} connected workspaces`;

  return {
    workspaceLabel,
    tasksCount: scopedTasks.length,
    runsCount: scopedRuns.length,
    approvalCount,
    reviewPacksCount: scopedReviewPacks.length,
    connectedWorkspaceCount,
    launchReadiness: buildLaunchReadiness(
      hasActiveWorkspace,
      activeWorkspace?.connected ?? false,
      scopedRuns
    ),
    continuityReadiness: buildContinuityReadiness(
      hasActiveWorkspace,
      activeWorkspace?.connected ?? false,
      scopedRuns,
      scopedReviewPacks
    ),
    missionItems: buildMissionActivityItems(scopedWorkspaces, scopedRuns),
    reviewItems: buildReviewQueueItems(scopedWorkspaces, scopedReviewPacks),
  };
}
