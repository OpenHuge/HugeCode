import type {
  HugeCodeMissionControlSnapshot as MissionControlProjection,
  HugeCodeFailureClass,
  HugeCodeReviewPackSummary,
  HugeCodeRunState,
  HugeCodeTaskSummary,
} from "@ku0/code-runtime-host-contract";
import {
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeTriageSummary,
} from "./runtimeContextTruth";
import { resolveMissionContinuationActionability } from "./runtimeMissionControlContinuation";
import {
  resolveLegacyReviewPackNextAction,
  resolveMissionReviewContinuationData,
} from "./runtimeMissionControlContinuationSummary";
import { buildMissionProvenanceSummary } from "./runtimeMissionControlProvenance";
import { describeMissionRunRouteDetail } from "./runtimeMissionControlRouteDetail";

export {
  formatMissionControlFreshnessLabel,
  formatMissionOverviewStateLabel,
} from "./runtimeMissionControlFormatting";
export { describeMissionRunRouteDetail };

const RUNTIME_TASK_ENTITY_PREFIX = "runtime-task:";

function isRuntimeManagedMissionTaskId(taskId: string): boolean {
  return taskId.startsWith(RUNTIME_TASK_ENTITY_PREFIX);
}

export type ThreadVisualState =
  | "ready"
  | "processing"
  | "awaitingApproval"
  | "awaitingInput"
  | "planReady"
  | "needsAttention"
  | "reviewing"
  | "completed"
  | "unread";
import { formatReviewFailureClassLabel } from "./reviewFailureClass";
import {
  formatMissionReviewEvidenceLabel,
  formatReviewEvidenceStateLabel,
} from "./reviewPackLabels";
import { isBlockingSubAgentStatus, resolveSubAgentSignalLabel } from "./subAgentStatus";
import {
  buildMissionOverviewOperatorSignal,
  resolveCheckpointHandoffLabel,
  resolveMissionOperatorAction,
} from "./runtimeMissionControlOperatorAction";
import {
  buildTaskSourceProvenanceSummary,
  resolveTaskSourceSecondaryLabel,
} from "./runtimeMissionControlTaskSourceProjector";
import {
  buildMissionNavigationTarget,
  buildReviewNavigationTarget,
} from "./runtimeMissionNavigationTarget";
import type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";
import type { CompactReviewEvidenceInput } from "./runtimeReviewEvidenceModel";
import {
  buildMissionReviewTriageMetadata,
  type MissionReviewFilterTag,
} from "./runtimeMissionReviewTriage";
import { resolveRuntimeRecommendedAction } from "./runtimeOperatorActionPresentation";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { resolveRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionDefaults";
import { resolveReviewIntelligenceSummary } from "./runtimeReviewIntelligenceSummary";

export type MissionOverviewState = "running" | "needsAction" | "reviewReady" | "ready";

export type { MissionNavigationTarget } from "./runtimeMissionNavigationTypes";

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
  continuationLabel?: string | null;
  continuePathLabel?: string | null;
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
  filterTags?: MissionReviewFilterTag[];
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
  provenanceSummary?: string | null;
  triageSummary?: string | null;
  delegationSummary?: string | null;
  continuationState?: "ready" | "attention" | "blocked" | "missing" | null;
  continuationLabel?: string | null;
  continuePathLabel?: string | null;
  continuationTruthSourceLabel?: string | null;
  continuityOverview?: string | null;
  compactEvidenceInput?: CompactReviewEvidenceInput | null;
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
function buildIdIndex<TEntry extends { id: string }>(entries: readonly TEntry[]) {
  return new Map(entries.map((entry) => [entry.id, entry]));
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

type RuntimeContextProjectionLike =
  | {
      workingSetSummary?: string | null;
      knowledgeItems?: Array<{ summary?: string | null }> | null;
      skillCandidates?: Array<{ label?: string | null; state?: string | null }> | null;
    }
  | null
  | undefined;

function summarizeRuntimeContextProjection(
  contextProjection: RuntimeContextProjectionLike
): string | null {
  if (!contextProjection) {
    return null;
  }
  const segments: string[] = [];
  if (contextProjection.workingSetSummary) {
    segments.push(contextProjection.workingSetSummary);
  }
  if (
    Array.isArray(contextProjection.knowledgeItems) &&
    contextProjection.knowledgeItems.length > 0
  ) {
    const knowledgeItems = contextProjection.knowledgeItems
      .map((item) => item.summary?.trim() ?? "")
      .filter((item) => item.length > 0);
    if (knowledgeItems.length > 0) {
      segments.push(`Knowledge projection: ${knowledgeItems.join(" | ")}`);
    }
  }
  if (
    Array.isArray(contextProjection.skillCandidates) &&
    contextProjection.skillCandidates.length > 0
  ) {
    const skillCandidates = contextProjection.skillCandidates
      .map((item) => `${item.label?.trim() ?? ""}${item.state ? ` [${item.state}]` : ""}`)
      .filter((item) => item.trim().length > 0);
    if (skillCandidates.length > 0) {
      segments.push(`Skill candidates: ${skillCandidates.join(" | ")}`);
    }
  }
  return segments.length > 0 ? segments.join(" | ") : null;
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
  continuationState: "ready" | "attention" | "blocked" | "missing" | null;
  contextProjection?: RuntimeContextProjectionLike;
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
  const contextProjectionSummary = summarizeRuntimeContextProjection(
    input.contextProjection ?? null
  );
  return {
    contextSummary: [
      contextTruth.canonicalTaskSource
        ? `${contextTruth.canonicalTaskSource.label} · ${contextTruth.reviewIntent}`
        : contextTruth.summary,
      contextProjectionSummary,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | "),
    triageSummary: triageSummary.summary,
    delegationSummary: [delegationContract.nextOperatorAction, contextProjectionSummary]
      .filter((value): value is string => Boolean(value))
      .join(" | "),
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
  const evidenceSummaryState = reviewPack.evidenceSummary?.state;
  if (evidenceSummaryState === "confirmed" || evidenceSummaryState === "incomplete") {
    return formatReviewEvidenceStateLabel(evidenceSummaryState);
  }
  if (reviewPack.reviewStatus === "incomplete_evidence") {
    return "Evidence incomplete";
  }
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
  if (input.run?.lifecycleSummary?.rerouted) {
    signals.push("Rerouted");
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
    input.reviewPack?.evidenceSummary?.summary?.trim() ||
    input.run?.evidenceSummary?.summary?.trim() ||
    input.reviewPack?.lifecycleSummary?.summary?.trim() ||
    input.run?.lifecycleSummary?.summary?.trim() ||
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
  const workspaceById = buildIdIndex(projection.workspaces);
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
      missionTarget: buildMissionNavigationTarget(task, {
        runId: latestRun.id,
        reviewPackId: reviewPack?.id ?? null,
      }),
      reviewTarget: buildReviewNavigationTarget(task, {
        runId: latestRun.id,
        reviewPackId: reviewPack?.id ?? null,
      }),
      defaultActiveLabel: "Open mission",
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
        missionTarget: buildMissionNavigationTarget(task, {
          runId: latestRun?.id ?? null,
          reviewPackId: reviewPack?.id ?? null,
        }),
        reviewTarget: buildReviewNavigationTarget(task, {
          runId: latestRun?.id ?? null,
          reviewPackId: reviewPack?.id ?? null,
        }),
        defaultActiveLabel: "Open mission",
      });
      const continuation = resolveMissionContinuationActionability({
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
        continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
        continuePathLabel: continuation.state !== "missing" ? continuation.continuePathLabel : null,
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
  const taskById = buildIdIndex(projection.tasks);
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
    const { continuation, canonicalContinuation } = resolveMissionReviewContinuationData({
      reviewPack,
      run,
    });
    const operatorAction = resolveMissionOperatorAction({
      task,
      reviewPack,
      run,
      missionTarget: buildMissionNavigationTarget(task, {
        runId: run?.id ?? reviewPack.runId,
        reviewPackId: reviewPack.id,
      }),
      reviewTarget: buildReviewNavigationTarget(task, {
        runId: run?.id ?? reviewPack.runId,
        reviewPackId: reviewPack.id,
      }),
      defaultActiveLabel: "Open mission",
    });
    const publishedOperatorAction =
      reviewPack.nextOperatorAction ?? run?.nextOperatorAction ?? null;
    const publishedOperatorActionText = resolveRuntimeRecommendedAction({
      operatorAction: publishedOperatorAction,
      fallbacks: [],
    });
    const derivedOperatorActionText = resolveRuntimeRecommendedAction({
      operatorAction,
      fallbacks: [],
    });
    const fallbackRecommendedNextAction =
      publishedOperatorActionText ??
      canonicalContinuation?.recommendedAction ??
      resolveRuntimeRecommendedAction({
        operatorAction,
        fallbacks: [
          continuation.state !== "missing" ? continuation.recommendedAction : null,
          derivedOperatorActionText,
          resolveLegacyReviewPackNextAction(reviewPack),
        ],
      });
    const reviewIntelligence = resolveReviewIntelligenceSummary({
      contract: options?.repositoryExecutionContract ?? null,
      taskSource: reviewPack.taskSource ?? run?.taskSource ?? task.taskSource ?? null,
      run,
      reviewPack,
      recommendedNextAction:
        fallbackRecommendedNextAction ??
        canonicalContinuation?.recommendedAction ??
        resolveLegacyReviewPackNextAction(reviewPack),
    });
    const recommendedNextAction =
      reviewIntelligence?.nextRecommendedAction ?? fallbackRecommendedNextAction;
    const hasBlockedSubAgentsFlag = hasBlockedSubAgents(reviewPack, run);
    const reviewGateState = reviewIntelligence?.reviewGate?.state ?? null;
    const highestReviewSeverity =
      reviewIntelligence?.reviewGate?.highestSeverity ??
      reviewIntelligence?.reviewFindings[0]?.severity ??
      null;
    const autofixAvailable = reviewIntelligence?.autofixCandidate?.status === "available";
    const triageMetadata = buildMissionReviewTriageMetadata({
      reviewPack,
      run,
      reviewGateState,
      highestReviewSeverity,
      autofixAvailable,
      continuationState: continuation.state,
      hasBlockedSubAgents: hasBlockedSubAgentsFlag,
    });
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
      contextProjection: reviewPack.contextProjection ?? run?.contextProjection ?? null,
    });
    const provenanceSummary =
      [
        buildTaskSourceProvenanceSummary({
          source: reviewPack.taskSource ?? run?.taskSource ?? task.taskSource ?? null,
          nextOperatorAction: reviewPack.nextOperatorAction ?? run?.nextOperatorAction ?? null,
        }),
        buildMissionProvenanceSummary(reviewPack.sourceCitations ?? run?.sourceCitations ?? null),
      ]
        .filter((value): value is string => Boolean(value))
        .join(" | ") || null;
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
      filterTags: triageMetadata.filterTags,
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
      reviewGateState,
      reviewGateLabel: resolveReviewGateLabel(
        reviewGateState,
        reviewIntelligence?.reviewGate?.findingCount ??
          reviewIntelligence?.reviewFindings.length ??
          null
      ),
      highestReviewSeverity,
      reviewFindingCount:
        reviewIntelligence?.reviewGate?.findingCount ??
        reviewIntelligence?.reviewFindings.length ??
        null,
      autofixAvailable,
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
      provenanceSummary,
      triageSummary: contextAndDelegation.triageSummary,
      delegationSummary: contextAndDelegation.delegationSummary,
      continuationState: continuation.state,
      continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
      continuePathLabel:
        publishedOperatorActionText || continuation.state === "missing"
          ? null
          : continuation.continuePathLabel,
      continuationTruthSourceLabel:
        continuation.state !== "missing" ? continuation.truthSourceLabel : null,
      continuityOverview: continuation.state !== "missing" ? continuation.continuityOverview : null,
      triagePriority: triageMetadata.triagePriority,
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
    const { continuation, canonicalContinuation } = resolveMissionReviewContinuationData({
      reviewPack: null,
      run,
    });
    const operatorAction = resolveMissionOperatorAction({
      task,
      reviewPack: null,
      run,
      missionTarget: buildMissionNavigationTarget(task, {
        runId: run.id,
        reviewPackId: null,
      }),
      reviewTarget: buildReviewNavigationTarget(task, {
        runId: run.id,
        reviewPackId: null,
      }),
      defaultActiveLabel: "Open mission",
    });
    const publishedOperatorAction = run.nextOperatorAction ?? null;
    const publishedOperatorActionText = resolveRuntimeRecommendedAction({
      operatorAction: publishedOperatorAction,
      fallbacks: [],
    });
    const derivedOperatorActionText = resolveRuntimeRecommendedAction({
      operatorAction,
      fallbacks: [],
    });
    const fallbackRecommendedNextAction =
      publishedOperatorActionText ??
      canonicalContinuation?.recommendedAction ??
      resolveRuntimeRecommendedAction({
        operatorAction,
        fallbacks: [
          continuation.state !== "missing" ? continuation.recommendedAction : null,
          derivedOperatorActionText,
          run.nextAction?.detail ?? null,
        ],
      });
    const reviewIntelligence = resolveReviewIntelligenceSummary({
      contract: options?.repositoryExecutionContract ?? null,
      taskSource: run.taskSource ?? task.taskSource ?? null,
      run,
      recommendedNextAction:
        fallbackRecommendedNextAction ??
        canonicalContinuation?.recommendedAction ??
        run.nextAction?.detail ??
        null,
    });
    const recommendedNextAction =
      reviewIntelligence?.nextRecommendedAction ?? fallbackRecommendedNextAction;
    const hasBlockedSubAgentsFlag = hasBlockedSubAgents(null, run);
    const reviewGateState = reviewIntelligence?.reviewGate?.state ?? null;
    const highestReviewSeverity =
      reviewIntelligence?.reviewGate?.highestSeverity ??
      reviewIntelligence?.reviewFindings[0]?.severity ??
      null;
    const autofixAvailable = reviewIntelligence?.autofixCandidate?.status === "available";
    const triageMetadata = buildMissionReviewTriageMetadata({
      reviewPack: null,
      run,
      reviewGateState,
      highestReviewSeverity,
      autofixAvailable,
      continuationState: continuation.state,
      hasBlockedSubAgents: hasBlockedSubAgentsFlag,
    });
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
      contextProjection: run.contextProjection ?? null,
    });
    const provenanceSummary =
      [
        buildTaskSourceProvenanceSummary({
          source: run.taskSource ?? task.taskSource ?? null,
          nextOperatorAction: run.nextOperatorAction ?? null,
        }),
        buildMissionProvenanceSummary(run.sourceCitations ?? null),
      ]
        .filter((value): value is string => Boolean(value))
        .join(" | ") || null;
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
      filterTags: triageMetadata.filterTags,
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
      reviewGateState,
      reviewGateLabel: resolveReviewGateLabel(
        reviewGateState,
        reviewIntelligence?.reviewGate?.findingCount ??
          reviewIntelligence?.reviewFindings.length ??
          null
      ),
      highestReviewSeverity,
      reviewFindingCount:
        reviewIntelligence?.reviewGate?.findingCount ??
        reviewIntelligence?.reviewFindings.length ??
        null,
      autofixAvailable,
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
      provenanceSummary,
      triageSummary: contextAndDelegation.triageSummary,
      delegationSummary: contextAndDelegation.delegationSummary,
      continuationState: continuation.state,
      continuationLabel: continuation.state !== "missing" ? continuation.summary : null,
      continuePathLabel:
        publishedOperatorActionText || continuation.state === "missing"
          ? null
          : continuation.continuePathLabel,
      continuationTruthSourceLabel:
        continuation.state !== "missing" ? continuation.truthSourceLabel : null,
      continuityOverview: continuation.state !== "missing" ? continuation.continuityOverview : null,
      triagePriority: triageMetadata.triagePriority,
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
