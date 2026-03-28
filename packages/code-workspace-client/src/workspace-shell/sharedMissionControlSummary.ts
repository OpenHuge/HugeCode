import type {
  HugeCodeMissionControlSnapshot,
  HugeCodeMissionActivityItem as SharedMissionActivityItem,
  HugeCodeMissionControlReadinessSummary as SharedMissionControlReadinessSummary,
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

function pushUnique(values: string[], next: string | null | undefined) {
  if (!next) {
    return;
  }
  if (!values.includes(next)) {
    values.push(next);
  }
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
  const blockedRuns = runs.filter((run) => {
    if (run.placement?.healthSummary === "placement_blocked") {
      return true;
    }
    if (run.routing?.backendOperability?.state === "blocked") {
      return true;
    }
    return run.placement?.readiness === "blocked" || run.routing?.health === "blocked";
  });
  const blockedCount = blockedRuns.length;
  if (blockedCount > 0) {
    const firstBlocked = blockedRuns[0];
    const blockedDetail =
      firstBlocked?.placement?.summary ??
      firstBlocked?.routing?.routeHint ??
      firstBlocked?.summary ??
      "Runtime placement is blocked.";
    return {
      tone: "blocked",
      label: "Launch readiness",
      detail: `${pluralize(blockedCount, "run")} are blocked by routing or backend operability. First: ${blockedDetail}`,
    };
  }
  const attentionRuns = runs.filter((run) => {
    if (run.placement?.lifecycleState === "fallback") {
      return true;
    }
    if (run.placement?.healthSummary === "placement_attention") {
      return true;
    }
    if (run.routing?.backendOperability?.state === "attention") {
      return true;
    }
    return run.placement?.readiness === "attention" || run.routing?.health === "attention";
  });
  const attentionCount = attentionRuns.length;
  if (attentionCount > 0) {
    const firstAttention = attentionRuns[0];
    const attentionDetail =
      firstAttention?.placement?.summary ??
      firstAttention?.routing?.routeHint ??
      firstAttention?.summary ??
      "Runtime placement needs operator inspection.";
    return {
      tone: "attention",
      label: "Launch readiness",
      detail: `${pluralize(attentionCount, "run")} need routing review before the next launch. First: ${attentionDetail}`,
    };
  }
  return {
    tone: "ready",
    label: "Launch readiness",
    detail:
      "Connected routing and backend operability are healthy for the current workspace slice.",
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
  if (
    run.placement?.readiness === "blocked" ||
    run.takeoverBundle?.state === "blocked" ||
    run.actionability?.state === "blocked"
  ) {
    return "blocked";
  }
  if (run.approval?.status === "pending_decision" || run.state === "needs_input") {
    return "attention";
  }
  if (run.placement?.readiness === "attention" || run.actionability?.state === "degraded") {
    return "attention";
  }
  if (run.state === "running") {
    return "active";
  }
  if (run.reviewPackId || run.takeoverBundle?.state === "ready") {
    return "ready";
  }
  return "neutral";
}

function getMissionStatusLabel(run: HugeCodeMissionControlSnapshot["runs"][number]) {
  const takeoverBundle = run.takeoverBundle;
  if (run.placement?.readiness === "blocked") {
    return "Routing blocked";
  }
  if (takeoverBundle?.state === "blocked" || run.actionability?.state === "blocked") {
    return "Continuation blocked";
  }
  if (takeoverBundle?.state === "ready") {
    if (takeoverBundle.pathKind === "resume") {
      return "Resume ready";
    }
    if (takeoverBundle.pathKind === "handoff") {
      return "Handoff ready";
    }
    if (takeoverBundle.pathKind === "review") {
      return "Review ready";
    }
  }
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

function resolveMissionItemDetail(run: HugeCodeMissionControlSnapshot["runs"][number]) {
  return (
    run.approval?.summary ??
    run.nextAction?.detail ??
    run.takeoverBundle?.recommendedAction ??
    run.summary ??
    run.placement?.summary ??
    run.actionability?.summary ??
    "Runtime-backed mission status is available for this run."
  );
}

function buildMissionItemHighlights(run: HugeCodeMissionControlSnapshot["runs"][number]) {
  const highlights: string[] = [];
  pushUnique(highlights, run.nextAction?.label ? `Next: ${run.nextAction.label}` : null);
  pushUnique(highlights, run.takeoverBundle?.summary ?? null);
  pushUnique(highlights, run.checkpoint?.summary ?? null);
  pushUnique(highlights, run.publishHandoff?.summary ?? null);
  pushUnique(highlights, run.actionability?.summary ?? null);
  return highlights.slice(0, 3);
}

function getMissionActivityPriority(run: HugeCodeMissionControlSnapshot["runs"][number]) {
  if (
    run.placement?.readiness === "blocked" ||
    run.takeoverBundle?.state === "blocked" ||
    run.actionability?.state === "blocked"
  ) {
    return 600;
  }
  if (run.approval?.status === "pending_decision" || run.state === "needs_input") {
    return 520;
  }
  if (run.placement?.readiness === "attention" || run.actionability?.state === "degraded") {
    return 440;
  }
  if (run.state === "running") {
    return 360;
  }
  if (run.reviewPackId || run.takeoverBundle?.state === "ready") {
    return 280;
  }
  return 120;
}

function buildMissionActivityItems(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  runs: HugeCodeMissionControlSnapshot["runs"]
): SharedMissionActivityItem[] {
  return [...runs]
    .sort(
      (left, right) =>
        getMissionActivityPriority(right) - getMissionActivityPriority(left) ||
        right.updatedAt - left.updatedAt
    )
    .slice(0, 6)
    .map((run) => ({
      id: run.id,
      title: run.title || "Untitled run",
      workspaceName: getWorkspaceName(workspaces, run.workspaceId),
      statusLabel: getMissionStatusLabel(run),
      tone: getMissionItemTone(run),
      detail: resolveMissionItemDetail(run),
      highlights: buildMissionItemHighlights(run),
    }));
}

function formatReviewStatusLabel(reviewStatus: string) {
  if (reviewStatus === "ready") {
    return "Ready";
  }
  return reviewStatus.replace(/_/g, " ");
}

function getHighestReviewSeverity(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return reviewPack.reviewGate?.highestSeverity ?? reviewPack.reviewFindings?.[0]?.severity ?? null;
}

function hasCriticalReviewSignal(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return (
    reviewPack.validationOutcome === "failed" ||
    reviewPack.reviewStatus === "action_required" ||
    reviewPack.reviewDecision?.status === "rejected" ||
    reviewPack.reviewGate?.state === "fail" ||
    reviewPack.reviewGate?.state === "blocked" ||
    getHighestReviewSeverity(reviewPack) === "critical"
  );
}

function getBlockedFollowUpState(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
): "blocked" | "degraded" | null {
  if (
    reviewPack.takeoverBundle?.state === "blocked" ||
    reviewPack.actionability?.state === "blocked" ||
    reviewPack.continuation?.state === "blocked"
  ) {
    return "blocked";
  }
  if (
    reviewPack.actionability?.state === "degraded" ||
    reviewPack.continuation?.state === "degraded"
  ) {
    return "degraded";
  }
  return null;
}

function hasAutofixReadySignal(reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]) {
  return reviewPack.autofixCandidate?.status === "available";
}

function hasNeedsAttentionSignal(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  return (
    reviewPack.reviewStatus === "incomplete_evidence" ||
    reviewPack.validationOutcome === "warning" ||
    reviewPack.placement?.resolutionSource === "runtime_fallback" ||
    reviewPack.placement?.lifecycleState === "fallback"
  );
}

function resolveReviewQueuePriorityBand(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  if (hasCriticalReviewSignal(reviewPack)) {
    return 4;
  }
  if (getBlockedFollowUpState(reviewPack)) {
    return 3;
  }
  if (hasAutofixReadySignal(reviewPack)) {
    return 2;
  }
  if (hasNeedsAttentionSignal(reviewPack)) {
    return 1;
  }
  return 0;
}

function getReviewStatusLabel(reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]) {
  const blockedFollowUpState = getBlockedFollowUpState(reviewPack);
  if (reviewPack.validationOutcome === "failed") {
    return "Validation failed";
  }
  if (hasCriticalReviewSignal(reviewPack)) {
    return "Critical review";
  }
  if (blockedFollowUpState === "blocked") {
    return "Blocked follow-up";
  }
  if (blockedFollowUpState === "degraded") {
    return "Follow-up degraded";
  }
  if (hasAutofixReadySignal(reviewPack)) {
    return "Autofix ready";
  }
  if (hasNeedsAttentionSignal(reviewPack)) {
    return "Needs attention";
  }
  if (reviewPack.takeoverBundle?.state === "ready" && reviewPack.reviewStatus !== "ready") {
    return "Review path ready";
  }
  return formatReviewStatusLabel(reviewPack.reviewStatus);
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
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
): SharedReviewQueueItem["tone"] {
  const blockedFollowUpState = getBlockedFollowUpState(reviewPack);
  if (
    reviewPack.validationOutcome === "failed" ||
    reviewPack.reviewGate?.state === "fail" ||
    reviewPack.reviewGate?.state === "blocked" ||
    reviewPack.reviewDecision?.status === "rejected" ||
    blockedFollowUpState === "blocked"
  ) {
    return "blocked";
  }
  if (
    hasCriticalReviewSignal(reviewPack) ||
    blockedFollowUpState === "degraded" ||
    hasAutofixReadySignal(reviewPack) ||
    hasNeedsAttentionSignal(reviewPack)
  ) {
    return "attention";
  }
  if (reviewPack.reviewStatus === "ready" || reviewPack.takeoverBundle?.state === "ready") {
    return "ready";
  }
  return "neutral";
}

function resolveReviewQueueSummary(
  reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]
) {
  if (reviewPack.validationOutcome === "failed") {
    return (
      reviewPack.reviewGate?.blockingReason ??
      reviewPack.reviewGate?.summary ??
      reviewPack.reviewFindings?.[0]?.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Validation failed and operator review is required."
    );
  }
  if (hasCriticalReviewSignal(reviewPack)) {
    return (
      reviewPack.reviewGate?.blockingReason ??
      reviewPack.reviewGate?.summary ??
      reviewPack.reviewFindings?.[0]?.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Critical review findings need operator action."
    );
  }
  if (getBlockedFollowUpState(reviewPack)) {
    return (
      reviewPack.takeoverBundle?.blockingReason ??
      reviewPack.actionability?.summary ??
      reviewPack.continuation?.detail ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Follow-up is constrained and needs operator attention."
    );
  }
  if (hasAutofixReadySignal(reviewPack)) {
    return (
      reviewPack.autofixCandidate?.summary ??
      reviewPack.recommendedNextAction ??
      reviewPack.summary ??
      "Runtime prepared an autofix candidate for this review."
    );
  }
  return (
    reviewPack.takeoverBundle?.recommendedAction ??
    reviewPack.actionability?.summary ??
    reviewPack.missionLinkage?.summary ??
    reviewPack.publishHandoff?.summary ??
    reviewPack.recommendedNextAction ??
    reviewPack.summary ??
    "Review-ready evidence is available."
  );
}

function getReviewQueuePriority(reviewPack: HugeCodeMissionControlSnapshot["reviewPacks"][number]) {
  const priorityBand = resolveReviewQueuePriorityBand(reviewPack);
  if (priorityBand > 0) {
    return (
      priorityBand * 200 +
      Math.min(reviewPack.warningCount, 9) * 5 +
      Math.min(reviewPack.reviewGate?.findingCount ?? reviewPack.reviewFindings?.length ?? 0, 9)
    );
  }
  if (reviewPack.reviewStatus === "ready" || reviewPack.takeoverBundle?.state === "ready") {
    return 320;
  }
  if (
    reviewPack.takeoverBundle ||
    reviewPack.actionability ||
    reviewPack.missionLinkage ||
    reviewPack.publishHandoff ||
    reviewPack.recommendedNextAction
  ) {
    return 240;
  }
  return 120;
}

function buildReviewQueueItems(
  workspaces: HugeCodeMissionControlSnapshot["workspaces"],
  reviewPacks: HugeCodeMissionControlSnapshot["reviewPacks"]
): SharedReviewQueueItem[] {
  return [...reviewPacks]
    .sort(
      (left, right) =>
        getReviewQueuePriority(right) - getReviewQueuePriority(left) ||
        right.createdAt - left.createdAt
    )
    .slice(0, 6)
    .map((reviewPack) => ({
      id: reviewPack.id,
      title: reviewPack.summary,
      workspaceName: getWorkspaceName(workspaces, reviewPack.workspaceId),
      summary: resolveReviewQueueSummary(reviewPack),
      reviewStatusLabel: getReviewStatusLabel(reviewPack),
      validationLabel: formatValidationLabel(reviewPack.validationOutcome),
      tone: getReviewItemTone(reviewPack),
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
