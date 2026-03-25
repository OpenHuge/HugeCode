import type {
  HugeCodeFailureClass,
  HugeCodeReviewPackSummary,
  HugeCodeRunState,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import {
  isRuntimeManagedMissionTaskId,
  type MissionControlProjection,
} from "./runtimeMissionControlFacade";
import {
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeTriageSummary,
} from "./runtimeContextTruth";
import { summarizeReviewContinuationActionability } from "./runtimeReviewContinuationFacade";
import { resolveReviewIntelligenceSummary } from "./runtimeReviewIntelligenceSummary";
import { resolveTaskSourceSecondaryLabel } from "./runtimeMissionControlTaskSourceProjector";
import {
  resolveRepositoryExecutionDefaults,
  type RepositoryExecutionContract,
} from "./runtimeRepositoryExecutionContract";
import { formatMissionReviewEvidenceLabel } from "../../../utils/reviewPackLabels";
import { formatReviewFailureClassLabel } from "../../../utils/reviewFailureClass";
import {
  isBlockingSubAgentStatus,
  resolveSubAgentSignalLabel,
} from "../../../utils/subAgentStatus";
import type { ThreadVisualState } from "../../../features/threads/utils/threadExecutionState";

export type MissionOverviewState = "running" | "needsAction" | "reviewReady" | "ready";

export function formatMissionOverviewStateLabel(state: MissionOverviewState): string {
  switch (state) {
    case "running":
      return "Running";
    case "needsAction":
      return "Waiting";
    case "reviewReady":
      return "Review ready";
    case "ready":
      return "Ready";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

export type MissionNavigationTarget =
  | {
      kind: "thread";
      workspaceId: string;
      threadId: string;
    }
  | {
      kind: "mission";
      workspaceId: string;
      taskId: string;
      runId: string | null;
      reviewPackId: string | null;
      threadId: string | null;
      limitation: "thread_unavailable" | null;
    }
  | {
      kind: "review";
      workspaceId: string;
      taskId: string;
      runId: string | null;
      reviewPackId: string | null;
      limitation: "thread_unavailable" | null;
    };

export type MissionOverviewCounts = {
  active: number;
  needsAction: number;
  reviewReady: number;
  ready: number;
};

export type MissionOverviewEntry = {
  threadId: string;
  title: string;
  summary: string | null;
  operatorSignal: string | null;
  governanceSummary?: string | null;
  routeDetail?: string | null;
  operatorActionLabel?: string | null;
  operatorActionDetail?: string | null;
  operatorActionTarget?: MissionNavigationTarget | null;
  attentionSignals: string[];
  updatedAt: number;
  state: MissionOverviewState;
  isActive: boolean;
  navigationTarget: MissionNavigationTarget;
  secondaryLabel: string | null;
};

export type MissionLatestRunEntry = {
  threadId: string;
  runId: string | null;
  taskId: string | null;
  message: string;
  timestamp: number;
  projectName: string;
  groupName?: string | null;
  workspaceId: string;
  statusLabel: string;
  statusKind: "active" | "review_ready" | "needs_input" | "attention" | "recent_activity";
  source: MissionControlProjection["source"];
  warningCount: number;
  operatorActionLabel?: string | null;
  operatorActionDetail?: string | null;
  operatorActionTarget?: MissionNavigationTarget | null;
  navigationTarget: MissionNavigationTarget;
  secondaryLabel: string | null;
};

export type MissionReviewEntry = {
  id: string;
  kind?: "review_pack" | "mission_run";
  taskId: string;
  runId: string;
  reviewPackId?: string | null;
  workspaceId: string;
  title: string;
  summary: string;
  createdAt: number;
  state: MissionOverviewState;
  validationOutcome: HugeCodeReviewPackSummary["validationOutcome"];
  warningCount: number;
  recommendedNextAction: string | null;
  accountabilityLifecycle?: "claimed" | "executing" | "in_review" | "done" | null;
  queueEnteredAt?: number;
  filterTags?: Array<
    "needs_attention" | "incomplete_evidence" | "fallback_routing" | "sub_agent_blocked"
  >;
  operatorSignal?: string | null;
  governanceSummary?: string | null;
  routeDetail?: string | null;
  attentionSignals?: string[];
  failureClassLabel?: string | null;
  subAgentSignal?: string | null;
  publishHandoffLabel?: string | null;
  relaunchLabel?: string | null;
  reviewGateState?: "pass" | "warn" | "fail" | "blocked" | null;
  reviewGateLabel?: string | null;
  highestReviewSeverity?: "info" | "warning" | "error" | "critical" | null;
  reviewFindingCount?: number | null;
  autofixAvailable?: boolean;
  reviewProfileId?: string | null;
  operatorActionLabel?: string | null;
  operatorActionDetail?: string | null;
  operatorActionTarget?: MissionNavigationTarget | null;
  navigationTarget: MissionNavigationTarget;
  secondaryLabel: string | null;
  evidenceLabel: string;
  contextSummary?: string | null;
  triageSummary?: string | null;
  delegationSummary?: string | null;
  continuationState?: "ready" | "degraded" | "blocked" | "missing" | null;
  continuationLabel?: string | null;
  continuePathLabel?: string | null;
};

export type MissionControlFreshnessState = {
  status: "idle" | "loading" | "refreshing" | "ready" | "error";
  isStale: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
};

const ACTIVE_RUN_STATES = new Set<HugeCodeRunState>([
  "queued",
  "preparing",
  "running",
  "validating",
]);
const NEEDS_ACTION_RUN_STATES = new Set<HugeCodeRunState>(["needs_input", "failed", "cancelled"]);

function buildRunIndex(projection: MissionControlProjection) {
  return new Map(projection.runs.map((run) => [run.id, run]));
}

function buildReviewPackIndex(projection: MissionControlProjection) {
  return new Map(projection.reviewPacks.map((reviewPack) => [reviewPack.runId, reviewPack]));
}

function buildWorkspaceIndex(projection: MissionControlProjection) {
  return new Map(projection.workspaces.map((workspace) => [workspace.id, workspace]));
}

function buildTaskIndex(projection: MissionControlProjection) {
  return new Map(projection.tasks.map((task) => [task.id, task]));
}

function resolveTaskTimestamp(
  task: HugeCodeTaskSummary,
  runById: ReadonlyMap<string, MissionControlProjection["runs"][number]>
): number {
  if (task.latestRunId) {
    const run = runById.get(task.latestRunId);
    if (run) {
      return run.updatedAt;
    }
  }
  return task.updatedAt;
}

function buildEntryContextAndDelegationSummary(input: {
  contract: RepositoryExecutionContract | null;
  taskSource:
    | MissionControlProjection["tasks"][number]["taskSource"]
    | MissionControlProjection["runs"][number]["taskSource"]
    | MissionControlProjection["reviewPacks"][number]["taskSource"]
    | null
    | undefined;
  executionProfileId: string | null | undefined;
  reviewProfileId: string | null | undefined;
  validationPresetId: string | null | undefined;
  continuationLabel: string | null;
  continuePathLabel: string | null;
  recommendedNextAction: string | null;
  continuationState: "ready" | "degraded" | "blocked" | "missing" | null;
}): Pick<MissionReviewEntry, "contextSummary" | "triageSummary" | "delegationSummary"> {
  const repositoryDefaults = resolveRepositoryExecutionDefaults({
    contract: input.contract,
    taskSource: input.taskSource ?? null,
    explicitLaunchInput: {
      executionProfileId: input.executionProfileId ?? null,
      reviewProfileId: input.reviewProfileId ?? null,
      validationPresetId: input.validationPresetId ?? null,
    },
  });
  const contextTruth = buildRuntimeContextTruth({
    taskSource: input.taskSource ?? null,
    repositoryDefaults,
    contractLabel: input.contract?.metadata?.label ?? null,
    hasRepoInstructions: true,
  });
  const triageSummary = buildRuntimeTriageSummary({
    taskSource: input.taskSource ?? null,
    repositoryDefaults,
    contractLabel: input.contract?.metadata?.label ?? null,
    hasRepoInstructions: true,
  });
  const delegationContract = buildRuntimeDelegationContract({
    contextTruth,
    triageSummary,
    continuationSummary: input.continuationLabel,
    continuePathLabel: input.continuePathLabel,
    nextOperatorAction: input.recommendedNextAction,
    blocked: input.continuationState === "blocked",
  });
  return {
    contextSummary: contextTruth.canonicalTaskSource
      ? `${contextTruth.canonicalTaskSource.label} · ${contextTruth.reviewIntent}`
      : contextTruth.summary,
    triageSummary: triageSummary.summary,
    delegationSummary: delegationContract.nextOperatorAction,
  };
}

function buildMissionNavigationTarget(
  task: HugeCodeTaskSummary,
  options?: {
    runId?: string | null;
    reviewPackId?: string | null;
  }
): MissionNavigationTarget {
  return {
    kind: "mission",
    workspaceId: task.workspaceId,
    taskId: task.id,
    runId: options?.runId ?? task.latestRunId ?? null,
    reviewPackId: options?.reviewPackId ?? null,
    threadId: task.origin.threadId ?? null,
    limitation: task.origin.threadId ? null : "thread_unavailable",
  };
}

function buildReviewNavigationTarget(
  task: HugeCodeTaskSummary,
  options?: {
    runId?: string | null;
    reviewPackId?: string | null;
  }
): MissionNavigationTarget {
  return {
    kind: "review",
    workspaceId: task.workspaceId,
    taskId: task.id,
    runId: options?.runId ?? task.latestRunId ?? null,
    reviewPackId: options?.reviewPackId ?? null,
    limitation: task.origin.threadId ? null : "thread_unavailable",
  };
}

function resolveMissionSecondaryLabel(task: HugeCodeTaskSummary): string | null {
  const labels: string[] = [];
  if (isRuntimeManagedMissionTaskId(task.id)) {
    labels.push("Runtime-managed mission");
  }
  const taskSourceLabel = resolveTaskSourceSecondaryLabel(task.taskSource ?? null);
  if (taskSourceLabel) {
    labels.push(taskSourceLabel);
  }
  return labels.length > 0 ? labels.join(" | ") : null;
}

function resolveReviewEvidenceLabel(
  reviewPack: HugeCodeReviewPackSummary,
  task: HugeCodeTaskSummary
): string {
  return formatMissionReviewEvidenceLabel(
    reviewPack.validationOutcome,
    reviewPack.warningCount,
    isRuntimeManagedMissionTaskId(task.id)
  );
}

function resolveFailureClassLabel(
  failureClass: HugeCodeFailureClass | null | undefined
): string | null {
  return formatReviewFailureClassLabel(failureClass);
}

function resolveReviewGateLabel(
  state: MissionReviewEntry["reviewGateState"],
  findingCount: number | null | undefined
): string | null {
  if (!state) {
    return null;
  }
  const findingLabel =
    typeof findingCount === "number" && findingCount > 0
      ? ` · ${findingCount} finding${findingCount === 1 ? "" : "s"}`
      : "";
  switch (state) {
    case "pass":
      return `Review gate pass${findingLabel}`;
    case "warn":
      return `Review gate warn${findingLabel}`;
    case "fail":
      return `Review gate fail${findingLabel}`;
    case "blocked":
      return `Review gate blocked${findingLabel}`;
    default:
      return null;
  }
}

function resolveSubAgents(
  reviewPack: HugeCodeReviewPackSummary,
  run: MissionControlProjection["runs"][number] | undefined
) {
  return reviewPack.subAgentSummary ?? run?.subAgents ?? [];
}

function hasBlockedSubAgents(
  reviewPack: HugeCodeReviewPackSummary | null,
  run: MissionControlProjection["runs"][number] | undefined | null
) {
  const subAgents = reviewPack
    ? resolveSubAgents(reviewPack, run ?? undefined)
    : (run?.subAgents ?? []);
  return subAgents.some((subAgent) => isBlockingSubAgentStatus(subAgent.status));
}

function resolveSubAgentSignal(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string | null {
  const subAgents = input.reviewPack
    ? resolveSubAgents(input.reviewPack, input.run ?? undefined)
    : (input.run?.subAgents ?? []);
  return resolveSubAgentSignalLabel(subAgents.map((subAgent) => subAgent.status));
}

function resolveRelaunchLabel(reviewPack: HugeCodeReviewPackSummary | null): string | null {
  if (!reviewPack?.relaunchOptions) {
    return null;
  }
  const hasEnabledAction = (reviewPack.relaunchOptions.availableActions ?? []).some(
    (action) => action.enabled
  );
  return hasEnabledAction ? "Relaunch available" : "Relaunch blocked";
}

function resolvePublishHandoffLabel(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string | null {
  const reviewPackSummary = input.reviewPack?.publishHandoff?.summary?.trim();
  if (reviewPackSummary) {
    return reviewPackSummary;
  }
  const runSummary = input.run?.publishHandoff?.summary?.trim();
  if (runSummary) {
    return runSummary;
  }
  if (input.reviewPack?.publishHandoff || input.run?.publishHandoff) {
    return "Publish handoff ready";
  }
  return null;
}

function resolveCheckpointHandoffLabel(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string | null {
  const checkpointSummary = input.reviewPack?.checkpoint?.summary?.trim();
  if (checkpointSummary) {
    return checkpointSummary;
  }
  const runCheckpointSummary = input.run?.checkpoint?.summary?.trim();
  if (runCheckpointSummary) {
    return runCheckpointSummary;
  }
  const checkpoint = input.reviewPack?.checkpoint ?? input.run?.checkpoint ?? null;
  if (!checkpoint) {
    return null;
  }
  if (checkpoint.resumeReady) {
    return "Resume ready";
  }
  if (checkpoint.recovered) {
    return "Recovered from checkpoint";
  }
  return checkpoint.checkpointId ? "Checkpoint available" : null;
}

function buildMissionOverviewAttentionSignals(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string[] {
  const signals: string[] = [];
  const approvalPending =
    input.run?.approval?.status === "pending_decision" ||
    input.run?.operatorSnapshot?.recentEvents.some((event) => event.kind === "approval_wait");
  if (approvalPending) {
    signals.push("Approval pending");
  }
  const blocked =
    Boolean(input.run?.operatorSnapshot?.blocker) ||
    Boolean(input.run?.state && NEEDS_ACTION_RUN_STATES.has(input.run.state));
  if (blocked) {
    signals.push("Blocked");
  }
  const placement = input.reviewPack?.placement ?? input.run?.placement ?? null;
  if (
    placement?.resolutionSource === "runtime_fallback" ||
    placement?.lifecycleState === "fallback"
  ) {
    signals.push("Fallback route");
  }
  if (input.reviewPack?.reviewDecision?.status === "rejected") {
    signals.push("Changes requested");
  } else if (input.reviewPack?.reviewStatus === "action_required") {
    signals.push("Action required");
  }
  if (placement?.healthSummary === "placement_blocked") {
    signals.push("Route blocked");
  } else if (
    placement?.healthSummary === "placement_attention" &&
    !signals.includes("Fallback route")
  ) {
    signals.push("Route needs attention");
  }
  if (input.reviewPack?.reviewStatus === "incomplete_evidence") {
    signals.push("Evidence incomplete");
  }
  const subAgentSignal = resolveSubAgentSignal(input);
  if (subAgentSignal) {
    signals.push(subAgentSignal);
  }
  const failureClassLabel = resolveFailureClassLabel(input.reviewPack?.failureClass ?? null);
  if (failureClassLabel) {
    signals.push(failureClassLabel);
  }
  const relaunchLabel = resolveRelaunchLabel(input.reviewPack);
  if (relaunchLabel) {
    signals.push(relaunchLabel);
  }
  const publishHandoffLabel = resolvePublishHandoffLabel(input);
  if (publishHandoffLabel) {
    signals.push(publishHandoffLabel);
  }
  const checkpointHandoffLabel = resolveCheckpointHandoffLabel(input);
  if (checkpointHandoffLabel) {
    signals.push(checkpointHandoffLabel);
  }
  return signals;
}

function buildMissionOverviewOperatorSignal(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string | null {
  return (
    input.run?.operatorSnapshot?.currentActivity?.trim() ||
    input.run?.operatorSnapshot?.blocker?.trim() ||
    input.run?.approval?.summary?.trim() ||
    input.run?.nextAction?.detail?.trim() ||
    input.reviewPack?.recommendedNextAction?.trim() ||
    null
  );
}

function buildMissionGovernanceSummary(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string | null {
  return (
    input.reviewPack?.governance?.summary?.trim() ||
    input.run?.governance?.summary?.trim() ||
    input.run?.approval?.summary?.trim() ||
    null
  );
}

function resolveMissionOperatorAction(input: {
  task: HugeCodeTaskSummary;
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): {
  label: string;
  detail: string | null;
  target: MissionNavigationTarget;
} {
  const missionTarget = buildMissionNavigationTarget(input.task, {
    runId: input.run?.id ?? null,
    reviewPackId: input.reviewPack?.id ?? null,
  });
  const reviewTarget = buildReviewNavigationTarget(input.task, {
    runId: input.run?.id ?? null,
    reviewPackId: input.reviewPack?.id ?? null,
  });
  if (
    input.reviewPack &&
    (input.reviewPack.reviewStatus === "ready" ||
      input.reviewPack.reviewStatus === "incomplete_evidence" ||
      input.reviewPack.reviewStatus === "action_required" ||
      input.reviewPack.reviewDecision?.status === "pending")
  ) {
    return {
      label:
        input.reviewPack.reviewStatus === "incomplete_evidence"
          ? "Inspect evidence"
          : input.reviewPack.reviewStatus === "action_required"
            ? "Resolve review"
            : "Open review",
      detail:
        resolveCheckpointHandoffLabel(input) ||
        input.reviewPack.recommendedNextAction?.trim() ||
        input.reviewPack.governance?.summary?.trim() ||
        null,
      target: reviewTarget,
    };
  }
  if (input.run?.approval?.status === "pending_decision") {
    return {
      label: "Open approval",
      detail: input.run.approval.summary?.trim() || null,
      target: missionTarget,
    };
  }
  if (input.run?.state === "failed" || input.run?.state === "cancelled") {
    return {
      label: "View failure",
      detail:
        input.run.relaunchContext?.summary?.trim() ||
        input.run.completionReason?.trim() ||
        input.run.governance?.summary?.trim() ||
        null,
      target: missionTarget,
    };
  }
  if (input.run?.checkpoint?.resumeReady || input.run?.checkpoint?.recovered) {
    return {
      label: "Resume mission",
      detail:
        input.run.checkpoint.summary?.trim() ||
        input.run.nextAction?.detail?.trim() ||
        input.run.governance?.summary?.trim() ||
        null,
      target: missionTarget,
    };
  }
  if (input.run?.state === "needs_input") {
    return {
      label: "Resume mission",
      detail: input.run.nextAction?.detail?.trim() || input.run.governance?.summary?.trim() || null,
      target: missionTarget,
    };
  }
  if (isMissionRunActive(input.run?.state ?? null)) {
    return {
      label: "Open mission",
      detail:
        input.run?.nextAction?.detail?.trim() || input.run?.governance?.summary?.trim() || null,
      target: missionTarget,
    };
  }
  return {
    label: input.task.origin.threadId ? "Open mission" : "Open action center",
    detail:
      input.run?.nextAction?.detail?.trim() ||
      input.reviewPack?.recommendedNextAction?.trim() ||
      input.run?.governance?.summary?.trim() ||
      null,
    target: missionTarget,
  };
}

export function describeMissionRunRouteDetail(
  projection: MissionControlProjection | null | undefined,
  runId: string | null
) {
  if (!projection || !runId) return null;
  const run = projection.runs.find((entry) => entry.id === runId) ?? null;
  if (!run) return null;
  const routeLabel = run.routing?.routeLabel?.trim() || null;
  const resolvedBackendId = run.placement?.resolvedBackendId?.trim() || null;
  const routeHealth = run.routing?.health ?? run.placement?.readiness ?? null;
  const placementHealth = run.placement?.healthSummary ?? null;
  const parts = [routeLabel ?? (resolvedBackendId ? `Backend ${resolvedBackendId}` : null)];
  if (resolvedBackendId && !parts.some((part) => part?.includes(resolvedBackendId))) {
    parts.push(resolvedBackendId);
  }
  if (placementHealth === "placement_attention" || routeHealth === "attention") {
    parts.push("Route needs attention");
  } else if (placementHealth === "placement_blocked" || routeHealth === "blocked") {
    parts.push("Route blocked");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function hasMissionNeedsAction(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): boolean {
  if (!input.run && !input.reviewPack) {
    return false;
  }
  if (input.run?.approval?.status === "pending_decision") {
    return true;
  }
  if (input.run?.operatorSnapshot?.blocker?.trim()) {
    return true;
  }
  if (input.reviewPack?.reviewDecision?.status === "rejected") {
    return true;
  }
  if (input.reviewPack?.reviewStatus === "action_required") {
    return true;
  }
  if (input.reviewPack?.reviewStatus === "incomplete_evidence") {
    return true;
  }
  if (hasBlockedSubAgents(input.reviewPack, input.run)) {
    return true;
  }
  if (
    !input.reviewPack &&
    input.run &&
    ["review_ready", "needs_input", "failed", "cancelled"].includes(input.run.state)
  ) {
    return true;
  }
  return false;
}

function resolveMissionOverviewState(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): MissionOverviewState {
  if (!input.run) {
    return "ready";
  }
  if (hasMissionNeedsAction(input)) {
    return "needsAction";
  }
  if (isMissionRunActive(input.run.state)) {
    return "running";
  }
  if (
    input.reviewPack?.reviewStatus === "ready" ||
    (input.reviewPack && input.run.state === "review_ready")
  ) {
    return "reviewReady";
  }
  return mapRunStateToMissionOverviewState(input.run.state);
}

function buildMissionOverviewSummary(input: {
  task: HugeCodeTaskSummary;
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): string | null {
  return (
    resolvePublishHandoffLabel(input) ||
    resolveCheckpointHandoffLabel(input) ||
    resolveSubAgentSignal(input) ||
    resolveFailureClassLabel(input.reviewPack?.failureClass ?? null) ||
    resolveRelaunchLabel(input.reviewPack) ||
    input.reviewPack?.summary ||
    input.run?.summary ||
    input.run?.title ||
    input.task.nextAction?.detail ||
    null
  );
}

function resolveTriagePriority(input: {
  reviewPack: HugeCodeReviewPackSummary | null;
  run: MissionControlProjection["runs"][number] | null;
}): number {
  if (
    input.run?.approval?.status === "pending_decision" ||
    Boolean(input.run?.operatorSnapshot?.blocker?.trim()) ||
    input.reviewPack?.reviewDecision?.status === "rejected" ||
    input.reviewPack?.reviewStatus === "action_required" ||
    (!input.reviewPack &&
      input.run !== null &&
      ["needs_input", "failed", "cancelled"].includes(input.run.state))
  ) {
    return 2;
  }
  if (
    input.reviewPack?.reviewStatus === "incomplete_evidence" ||
    input.reviewPack?.placement?.resolutionSource === "runtime_fallback" ||
    input.reviewPack?.placement?.lifecycleState === "fallback" ||
    input.reviewPack?.placement?.healthSummary === "placement_attention" ||
    input.reviewPack?.placement?.healthSummary === "placement_blocked" ||
    input.run?.placement?.resolutionSource === "runtime_fallback" ||
    input.run?.placement?.lifecycleState === "fallback" ||
    input.run?.placement?.healthSummary === "placement_attention" ||
    input.run?.placement?.healthSummary === "placement_blocked" ||
    hasBlockedSubAgents(input.reviewPack, input.run)
  ) {
    return 1;
  }
  return 0;
}

export function formatMissionControlFreshnessLabel(
  freshness: MissionControlFreshnessState
): string {
  if (freshness.status === "loading") {
    return "Syncing mission control";
  }
  if (freshness.status === "refreshing") {
    return "Refreshing mission control";
  }
  if (freshness.status === "error") {
    return "Mission control degraded";
  }
  if (freshness.isStale) {
    return "Mission control stale";
  }
  return "Mission control live";
}

export function formatMissionControlFreshnessDetail(
  freshness: MissionControlFreshnessState
): string | null {
  if (freshness.error) {
    return freshness.error;
  }
  if (freshness.lastUpdatedAt === null) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(freshness.lastUpdatedAt);
}

export function isMissionRunActive(state: HugeCodeRunState | null | undefined): boolean {
  return Boolean(state && ACTIVE_RUN_STATES.has(state));
}

export function isMissionRunNeedsAction(state: HugeCodeRunState | null | undefined): boolean {
  return Boolean(state && NEEDS_ACTION_RUN_STATES.has(state));
}

export function mapRunStateToMissionOverviewState(
  state: HugeCodeRunState | null | undefined
): MissionOverviewState {
  if (!state) {
    return "ready";
  }
  if (ACTIVE_RUN_STATES.has(state)) {
    return "running";
  }
  if (state === "review_ready") {
    return "reviewReady";
  }
  if (NEEDS_ACTION_RUN_STATES.has(state)) {
    return "needsAction";
  }
  return "ready";
}

export function mapThreadVisualStateToMissionOverviewState(
  state: ThreadVisualState
): MissionOverviewState {
  switch (state) {
    case "processing":
      return "running";
    case "awaitingApproval":
    case "awaitingInput":
    case "planReady":
    case "needsAttention":
      return "needsAction";
    case "completed":
    case "reviewing":
      return "reviewReady";
    case "unread":
    case "ready":
      return "ready";
    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}

export function summarizeMissionControlSignals(projection: MissionControlProjection) {
  const runById = buildRunIndex(projection);
  const reviewPackByRunId = buildReviewPackIndex(projection);
  return projection.tasks.reduce(
    (summary, task) => {
      const run = task.latestRunId ? (runById.get(task.latestRunId) ?? null) : null;
      const reviewPack = run ? (reviewPackByRunId.get(run.id) ?? null) : null;
      const state = resolveMissionOverviewState({
        reviewPack,
        run,
      });
      if (state === "running") {
        summary.activeCount += 1;
      } else if (state === "reviewReady") {
        summary.reviewReadyCount += 1;
      } else if (state === "needsAction") {
        summary.needsActionCount += 1;
      }
      if (
        run?.placement?.healthSummary === "placement_blocked" ||
        run?.routing?.health === "blocked"
      ) {
        summary.routingBlockedCount += 1;
      } else if (
        run?.placement?.healthSummary === "placement_attention" ||
        run?.placement?.resolutionSource === "runtime_fallback" ||
        run?.routing?.health === "attention"
      ) {
        summary.routingAttentionCount += 1;
      }
      return summary;
    },
    {
      activeCount: 0,
      reviewReadyCount: 0,
      needsActionCount: 0,
      routingAttentionCount: 0,
      routingBlockedCount: 0,
    }
  );
}

export function buildLatestMissionRunsFromProjection(
  projection: MissionControlProjection,
  options: {
    getWorkspaceGroupName: (workspaceId: string) => string | null;
    limit?: number;
  }
): MissionLatestRunEntry[] {
  const runById = buildRunIndex(projection);
  const reviewPackByRunId = buildReviewPackIndex(projection);
  const workspaceById = buildWorkspaceIndex(projection);
  const entries: MissionLatestRunEntry[] = [];
  for (const task of projection.tasks) {
    if (!task.latestRunId) {
      continue;
    }
    const latestRun = runById.get(task.latestRunId);
    if (!latestRun) {
      continue;
    }
    const reviewPack = reviewPackByRunId.get(latestRun.id) ?? null;
    const workspace = workspaceById.get(task.workspaceId);
    const operatorAction = resolveMissionOperatorAction({
      task,
      reviewPack,
      run: latestRun,
    });
    let statusLabel: MissionLatestRunEntry["statusLabel"];
    let statusKind: MissionLatestRunEntry["statusKind"];
    if (isMissionRunActive(task.latestRunState)) {
      statusLabel =
        latestRun.state === "queued" || latestRun.state === "preparing" ? "Queued" : "Running";
      statusKind = "active";
    } else if (task.latestRunState === "needs_input") {
      statusLabel = "Needs input";
      statusKind = "needs_input";
    } else if (task.latestRunState === "review_ready") {
      if (reviewPack?.reviewStatus === "action_required") {
        statusLabel =
          reviewPack.warningCount > 0 ? `Warnings: ${reviewPack.warningCount}` : "Action required";
        statusKind = "attention";
      } else if (reviewPack?.reviewStatus === "incomplete_evidence") {
        statusLabel = "Evidence incomplete";
        statusKind = "attention";
      } else {
        statusLabel = "Review ready";
        statusKind = "review_ready";
      }
    } else {
      statusLabel = "Needs attention";
      statusKind = "attention";
    }
    entries.push({
      threadId: task.origin.threadId ?? task.id,
      runId: latestRun.id,
      taskId: task.id,
      message: reviewPack?.summary ?? latestRun.summary ?? latestRun.title ?? task.title,
      timestamp: reviewPack?.createdAt ?? latestRun.updatedAt,
      projectName: workspace?.name ?? "Workspace",
      groupName: options.getWorkspaceGroupName(task.workspaceId) ?? null,
      workspaceId: task.workspaceId,
      statusLabel,
      statusKind,
      source: projection.source,
      warningCount: reviewPack?.warningCount ?? latestRun.warnings?.length ?? 0,
      operatorActionLabel: operatorAction.label,
      operatorActionDetail: operatorAction.detail,
      operatorActionTarget: operatorAction.target,
      navigationTarget: buildMissionNavigationTarget(task, {
        runId: latestRun.id,
        reviewPackId: reviewPack?.id ?? null,
      }),
      secondaryLabel: resolveMissionSecondaryLabel(task),
    });
  }
  return entries
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, options.limit ?? 3);
}

export function buildMissionOverviewCountsFromProjection(
  projection: MissionControlProjection,
  workspaceId: string
): MissionOverviewCounts {
  const runById = buildRunIndex(projection);
  const reviewPackByRunId = buildReviewPackIndex(projection);
  return projection.tasks
    .filter((task) => task.workspaceId === workspaceId)
    .reduce(
      (counts, task) => {
        const run = task.latestRunId ? (runById.get(task.latestRunId) ?? null) : null;
        const reviewPack = run ? (reviewPackByRunId.get(run.id) ?? null) : null;
        const state = resolveMissionOverviewState({
          reviewPack,
          run,
        });
        if (state === "running") {
          counts.active += 1;
        } else if (state === "needsAction") {
          counts.needsAction += 1;
        } else if (state === "reviewReady") {
          counts.reviewReady += 1;
        } else {
          counts.ready += 1;
        }
        return counts;
      },
      {
        active: 0,
        needsAction: 0,
        reviewReady: 0,
        ready: 0,
      }
    );
}

export function buildMissionOverviewItemsFromProjection(
  projection: MissionControlProjection,
  options: {
    workspaceId: string;
    activeThreadId: string | null;
    limit?: number;
  }
): MissionOverviewEntry[] {
  const runById = buildRunIndex(projection);
  const reviewPackByRunId = buildReviewPackIndex(projection);

  return projection.tasks
    .filter((task) => task.workspaceId === options.workspaceId)
    .slice()
    .sort(
      (left, right) => resolveTaskTimestamp(right, runById) - resolveTaskTimestamp(left, runById)
    )
    .slice(0, options.limit ?? 6)
    .map((task) => {
      const latestRun = task.latestRunId ? (runById.get(task.latestRunId) ?? null) : null;
      const reviewPack = latestRun ? (reviewPackByRunId.get(latestRun.id) ?? null) : null;
      const threadId = task.origin.threadId ?? task.id;
      const operatorAction = resolveMissionOperatorAction({
        task,
        reviewPack,
        run: latestRun,
      });
      return {
        threadId,
        title: task.title,
        summary: buildMissionOverviewSummary({
          task,
          reviewPack,
          run: latestRun,
        }),
        operatorSignal: buildMissionOverviewOperatorSignal({
          reviewPack,
          run: latestRun,
        }),
        governanceSummary: buildMissionGovernanceSummary({
          reviewPack,
          run: latestRun,
        }),
        routeDetail: describeMissionRunRouteDetail(projection, latestRun?.id ?? null),
        operatorActionLabel: operatorAction.label,
        operatorActionDetail: operatorAction.detail,
        operatorActionTarget: operatorAction.target,
        attentionSignals: buildMissionOverviewAttentionSignals({
          reviewPack,
          run: latestRun,
        }),
        updatedAt: reviewPack?.createdAt ?? latestRun?.updatedAt ?? task.updatedAt,
        state: resolveMissionOverviewState({
          reviewPack,
          run: latestRun,
        }),
        isActive: threadId === options.activeThreadId,
        navigationTarget: buildMissionNavigationTarget(task, {
          runId: latestRun?.id ?? null,
          reviewPackId: reviewPack?.id ?? null,
        }),
        secondaryLabel: resolveMissionSecondaryLabel(task),
      } satisfies MissionOverviewEntry;
    });
}

export function buildMissionReviewEntriesFromProjection(
  projection: MissionControlProjection,
  options?: {
    workspaceId?: string | null;
    limit?: number;
    repositoryExecutionContract?: RepositoryExecutionContract | null;
  }
): MissionReviewEntry[] {
  const taskById = buildTaskIndex(projection);
  const runById = buildRunIndex(projection);
  const reviewPackByRunId = buildReviewPackIndex(projection);
  const entries: Array<MissionReviewEntry & { triagePriority: number }> = [];

  for (const reviewPack of projection.reviewPacks
    .filter((entry) => (options?.workspaceId ? entry.workspaceId === options.workspaceId : true))
    .slice()) {
    const task = taskById.get(reviewPack.taskId);
    if (!task) {
      continue;
    }
    if (task.accountability?.lifecycle === "done") {
      continue;
    }
    const run = runById.get(reviewPack.runId) ?? null;
    const filterTags: MissionReviewEntry["filterTags"] = [];
    if (
      reviewPack.reviewStatus === "action_required" ||
      reviewPack.reviewDecision?.status === "rejected" ||
      reviewPack.reviewGate?.state === "fail" ||
      reviewPack.reviewGate?.state === "blocked"
    ) {
      filterTags.push("needs_attention");
    }
    if (reviewPack.reviewStatus === "incomplete_evidence") {
      filterTags.push("incomplete_evidence");
    }
    if (
      reviewPack.placement?.resolutionSource === "runtime_fallback" ||
      reviewPack.placement?.lifecycleState === "fallback"
    ) {
      filterTags.push("fallback_routing");
    }
    if (hasBlockedSubAgents(reviewPack, run)) {
      filterTags.push("sub_agent_blocked");
    }
    const operatorAction = resolveMissionOperatorAction({
      task,
      reviewPack,
      run,
    });
    const continuation = summarizeReviewContinuationActionability({
      takeoverBundle: reviewPack.takeoverBundle ?? run?.takeoverBundle ?? null,
      actionability: reviewPack.actionability ?? run?.actionability ?? null,
      missionLinkage: reviewPack.missionLinkage ?? run?.missionLinkage ?? null,
      publishHandoff: reviewPack.publishHandoff ?? run?.publishHandoff ?? null,
    });
    const reviewIntelligence = resolveReviewIntelligenceSummary({
      contract: options?.repositoryExecutionContract ?? null,
      taskSource: reviewPack.taskSource ?? run?.taskSource ?? task.taskSource ?? null,
      run,
      reviewPack,
      recommendedNextAction:
        continuation.state !== "missing"
          ? continuation.recommendedAction
          : reviewPack.recommendedNextAction,
    });
    const recommendedNextAction =
      reviewIntelligence?.nextRecommendedAction ??
      (continuation.state !== "missing"
        ? continuation.recommendedAction
        : reviewPack.recommendedNextAction);
    const contextAndDelegation = buildEntryContextAndDelegationSummary({
      contract: options?.repositoryExecutionContract ?? null,
      taskSource: reviewPack.taskSource ?? run?.taskSource ?? task.taskSource ?? null,
      executionProfileId: run?.executionProfile?.id ?? null,
      reviewProfileId: reviewIntelligence?.reviewProfileId ?? run?.reviewProfileId ?? null,
      validationPresetId: run?.executionProfile?.validationPresetId ?? null,
      continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
      continuePathLabel: continuation.state !== "missing" ? continuation.continuePathLabel : null,
      recommendedNextAction,
      continuationState: continuation.state,
    });

    entries.push({
      id: reviewPack.id,
      kind: "review_pack",
      taskId: reviewPack.taskId,
      runId: reviewPack.runId,
      reviewPackId: reviewPack.id,
      workspaceId: reviewPack.workspaceId,
      title: task.title,
      summary:
        buildMissionOverviewSummary({
          task,
          reviewPack,
          run,
        }) ?? reviewPack.summary,
      createdAt: reviewPack.createdAt,
      state: resolveMissionOverviewState({
        reviewPack,
        run,
      }),
      validationOutcome: reviewPack.validationOutcome,
      warningCount: reviewPack.warningCount,
      recommendedNextAction,
      accountabilityLifecycle: task.accountability?.lifecycle ?? null,
      queueEnteredAt:
        task.accountability?.lifecycle === "in_review"
          ? (task.accountability.lifecycleUpdatedAt ?? reviewPack.createdAt)
          : reviewPack.createdAt,
      filterTags,
      operatorSignal: buildMissionOverviewOperatorSignal({
        reviewPack,
        run,
      }),
      governanceSummary: buildMissionGovernanceSummary({
        reviewPack,
        run,
      }),
      routeDetail: describeMissionRunRouteDetail(projection, reviewPack.runId),
      attentionSignals: buildMissionOverviewAttentionSignals({
        reviewPack,
        run,
      }),
      failureClassLabel: resolveFailureClassLabel(reviewPack.failureClass ?? null),
      subAgentSignal: resolveSubAgentSignal({
        reviewPack,
        run,
      }),
      publishHandoffLabel: resolvePublishHandoffLabel({
        reviewPack,
        run,
      }),
      relaunchLabel: resolveRelaunchLabel(reviewPack),
      reviewGateState: reviewIntelligence?.reviewGate?.state ?? null,
      reviewGateLabel: resolveReviewGateLabel(
        reviewIntelligence?.reviewGate?.state ?? null,
        reviewIntelligence?.reviewGate?.findingCount ??
          reviewIntelligence?.reviewFindings.length ??
          null
      ),
      highestReviewSeverity:
        reviewIntelligence?.reviewGate?.highestSeverity ??
        reviewIntelligence?.reviewFindings[0]?.severity ??
        null,
      reviewFindingCount:
        reviewIntelligence?.reviewGate?.findingCount ??
        reviewIntelligence?.reviewFindings.length ??
        null,
      autofixAvailable: reviewIntelligence?.autofixCandidate?.status === "available",
      reviewProfileId: reviewIntelligence?.reviewProfileId ?? null,
      operatorActionLabel: operatorAction.label,
      operatorActionDetail: operatorAction.detail,
      operatorActionTarget: operatorAction.target,
      navigationTarget: buildMissionNavigationTarget(task, {
        runId: reviewPack.runId,
        reviewPackId: reviewPack.id,
      }),
      secondaryLabel: resolveMissionSecondaryLabel(task),
      evidenceLabel: resolveReviewEvidenceLabel(reviewPack, task),
      contextSummary: contextAndDelegation.contextSummary,
      triageSummary: contextAndDelegation.triageSummary,
      delegationSummary: contextAndDelegation.delegationSummary,
      continuationState: continuation.state,
      continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
      continuePathLabel: continuation.state !== "missing" ? continuation.continuePathLabel : null,
      triagePriority: resolveTriagePriority({
        reviewPack,
        run,
      }),
    });
  }

  for (const run of projection.runs
    .filter((entry) => (options?.workspaceId ? entry.workspaceId === options.workspaceId : true))
    .slice()) {
    if (reviewPackByRunId.has(run.id)) {
      continue;
    }
    const task = taskById.get(run.taskId);
    if (!task || task.accountability?.lifecycle === "done") {
      continue;
    }
    const includeRunOnlyTriage =
      task.accountability?.lifecycle === "in_review" ||
      ["review_ready", "needs_input", "failed", "cancelled"].includes(run.state);
    if (!includeRunOnlyTriage) {
      continue;
    }
    const filterTags: MissionReviewEntry["filterTags"] = [];
    if (
      run.approval?.status === "pending_decision" ||
      Boolean(run.operatorSnapshot?.blocker?.trim()) ||
      ["needs_input", "failed", "cancelled"].includes(run.state) ||
      run.reviewGate?.state === "fail" ||
      run.reviewGate?.state === "blocked"
    ) {
      filterTags.push("needs_attention");
    }
    if (
      run.placement?.resolutionSource === "runtime_fallback" ||
      run.placement?.lifecycleState === "fallback"
    ) {
      filterTags.push("fallback_routing");
    }
    if (hasBlockedSubAgents(null, run)) {
      filterTags.push("sub_agent_blocked");
    }
    const operatorAction = resolveMissionOperatorAction({
      task,
      reviewPack: null,
      run,
    });
    const continuation = summarizeReviewContinuationActionability({
      takeoverBundle: run.takeoverBundle ?? null,
      actionability: run.actionability ?? null,
      missionLinkage: run.missionLinkage ?? null,
      publishHandoff: run.publishHandoff ?? null,
    });
    const reviewIntelligence = resolveReviewIntelligenceSummary({
      contract: options?.repositoryExecutionContract ?? null,
      taskSource: run.taskSource ?? task.taskSource ?? null,
      run,
      recommendedNextAction:
        continuation.state !== "missing"
          ? continuation.recommendedAction
          : (run.nextAction?.detail ?? null),
    });
    const recommendedNextAction =
      reviewIntelligence?.nextRecommendedAction ??
      (continuation.state !== "missing"
        ? continuation.recommendedAction
        : (run.nextAction?.detail ?? null));
    const contextAndDelegation = buildEntryContextAndDelegationSummary({
      contract: options?.repositoryExecutionContract ?? null,
      taskSource: run.taskSource ?? task.taskSource ?? null,
      executionProfileId: run.executionProfile?.id ?? null,
      reviewProfileId: reviewIntelligence?.reviewProfileId ?? run.reviewProfileId ?? null,
      validationPresetId: run.executionProfile?.validationPresetId ?? null,
      continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
      continuePathLabel: continuation.state !== "missing" ? continuation.continuePathLabel : null,
      recommendedNextAction,
      continuationState: continuation.state,
    });
    entries.push({
      id: run.id,
      kind: "mission_run",
      taskId: run.taskId,
      runId: run.id,
      reviewPackId: null,
      workspaceId: run.workspaceId,
      title: task.title,
      summary:
        buildMissionOverviewSummary({
          task,
          reviewPack: null,
          run,
        }) ??
        run.summary ??
        task.title,
      createdAt: run.finishedAt ?? run.updatedAt,
      state: resolveMissionOverviewState({
        reviewPack: null,
        run,
      }),
      validationOutcome: "unknown",
      warningCount: run.warnings?.length ?? 0,
      recommendedNextAction,
      accountabilityLifecycle: task.accountability?.lifecycle ?? null,
      queueEnteredAt:
        task.accountability?.lifecycle === "in_review"
          ? (task.accountability.lifecycleUpdatedAt ?? run.updatedAt)
          : run.updatedAt,
      filterTags,
      operatorSignal: buildMissionOverviewOperatorSignal({
        reviewPack: null,
        run,
      }),
      governanceSummary: buildMissionGovernanceSummary({
        reviewPack: null,
        run,
      }),
      routeDetail: describeMissionRunRouteDetail(projection, run.id),
      attentionSignals: buildMissionOverviewAttentionSignals({
        reviewPack: null,
        run,
      }),
      failureClassLabel: null,
      subAgentSignal: resolveSubAgentSignal({
        reviewPack: null,
        run,
      }),
      publishHandoffLabel: resolvePublishHandoffLabel({
        reviewPack: null,
        run,
      }),
      relaunchLabel: null,
      reviewGateState: reviewIntelligence?.reviewGate?.state ?? null,
      reviewGateLabel: resolveReviewGateLabel(
        reviewIntelligence?.reviewGate?.state ?? null,
        reviewIntelligence?.reviewGate?.findingCount ??
          reviewIntelligence?.reviewFindings.length ??
          null
      ),
      highestReviewSeverity:
        reviewIntelligence?.reviewGate?.highestSeverity ??
        reviewIntelligence?.reviewFindings[0]?.severity ??
        null,
      reviewFindingCount:
        reviewIntelligence?.reviewGate?.findingCount ??
        reviewIntelligence?.reviewFindings.length ??
        null,
      autofixAvailable: reviewIntelligence?.autofixCandidate?.status === "available",
      reviewProfileId: reviewIntelligence?.reviewProfileId ?? null,
      operatorActionLabel: operatorAction.label,
      operatorActionDetail: operatorAction.detail,
      operatorActionTarget: operatorAction.target,
      navigationTarget: buildMissionNavigationTarget(task, {
        runId: run.id,
        reviewPackId: null,
      }),
      secondaryLabel: resolveMissionSecondaryLabel(task),
      evidenceLabel: "Runtime evidence only",
      contextSummary: contextAndDelegation.contextSummary,
      triageSummary: contextAndDelegation.triageSummary,
      delegationSummary: contextAndDelegation.delegationSummary,
      continuationState: continuation.state,
      continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
      continuePathLabel: continuation.state !== "missing" ? continuation.continuePathLabel : null,
      triagePriority: resolveTriagePriority({
        reviewPack: null,
        run,
      }),
    });
  }

  return entries
    .sort(
      (left, right) =>
        right.triagePriority - left.triagePriority ||
        (right.queueEnteredAt ?? right.createdAt) - (left.queueEnteredAt ?? left.createdAt)
    )
    .slice(0, options?.limit ?? 8)
    .map(({ triagePriority: _triagePriority, ...entry }) => entry);
}
