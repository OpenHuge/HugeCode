import type {
  HugeCodeEvidenceState,
  HugeCodeFailureClass,
  HugeCodeMissionNavigationTarget as RuntimeMissionNavigationTarget,
  HugeCodeReviewFinding,
  HugeCodeReviewGateSummary,
  HugeCodeRunState,
  HugeCodeReviewDecisionState,
  HugeCodeReviewStatus,
  HugeCodeRuntimeAutofixCandidate,
  HugeCodeRuntimeSkillUsageSummary,
  HugeCodeValidationOutcome,
  RuntimeReviewGetV2Response,
} from "@ku0/code-runtime-host-contract";
import { resolveRuntimeContinuation } from "@ku0/code-runtime-host-contract";
import { type RuntimeContinuityReadinessState } from "./runtimeContinuityReadiness";
import { formatHugeCodeRunStateLabel } from "./runtimeMissionControlRunState";
import {
  formatReviewEvidenceStateLabel,
  formatReviewStatusLabel,
  formatValidationOutcomeLabel,
} from "../../../utils/reviewPackLabels";
import { describeReviewFailureClass } from "../../../utils/reviewFailureClass";
import {
  isRuntimeManagedMissionTaskId,
  type MissionControlProjection,
} from "./runtimeMissionControlFacade";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import { resolveTaskSourceSecondaryLabel } from "./runtimeMissionControlTaskSourceProjector";
import {
  resolveReviewContinuationDefaults,
  resolveRuntimeFollowUpPreferredBackendIds,
} from "./runtimeReviewContinuationFacade";
import {
  buildRuntimeContinuationDescriptor,
  formatRuntimeContinuationTruthSourceLabel,
} from "./runtimeContinuationTruth";
import {
  resolveReviewIntelligenceSummary,
  type ReviewIntelligenceSummary,
} from "./runtimeReviewIntelligenceSummary";
import {
  buildRuntimeReviewPackFollowUpState,
  type RuntimeReviewPackDecisionActionModel,
} from "./runtimeReviewPackDecisionActionsFacade";
import {
  buildMissionReviewEntriesFromProjection,
  type MissionNavigationTarget,
  type MissionReviewEntry,
} from "./runtimeMissionControlSurfaceModel";
import {
  normalizeReviewPackPublishHandoff,
  normalizeReviewPackRelaunchOptions,
} from "./runtimeReviewPackSurfaceNormalization";
import {
  buildExecutionContext,
  buildCheckpointDetail,
  buildGovernanceDetail,
  buildMissionBriefDetail,
  buildMissionLineageDetail,
  buildOperatorSnapshotDetail,
  buildPlacementDetail,
  buildRelaunchContextDetail,
  buildRunLedgerDetail,
  buildWorkspaceEvidenceDetail,
  type OperatorSnapshotSummary,
  type WorkspaceEvidenceSummary,
  pushUnique,
} from "./runtimeReviewPackDetailPresentation";

type RelaunchOption = {
  id: string;
  label: string;
  detail: string | null;
  enabled: boolean;
  disabledReason: string | null;
};

type SubAgentSummary = {
  sessionId: string;
  parentRunId: string | null;
  scopeProfile: string | null;
  status: string;
  approvalState: string | null;
  checkpointState: string | null;
  summary: string;
  timedOutReason: string | null;
  interruptedReason: string | null;
};

type PublishHandoffSummary = {
  summary?: string | null;
  branchName?: string | null;
  reviewTitle?: string | null;
  reviewBody?: string | null;
  reviewChecklist?: string[] | null;
  operatorCommands?: string[] | null;
  details?: string[] | null;
};

type ReviewPackContinuitySummary = {
  state: RuntimeContinuityReadinessState;
  summary: string;
  details: string[];
  recommendedAction: string;
  blockingReason: string | null;
  truthSourceLabel: string;
};

type ReviewPackWithExtras = MissionControlProjection["reviewPacks"][number];

type RunWithExtras = MissionControlProjection["runs"][number] & {
  subAgentSummary?: Array<Record<string, unknown>> | null;
};

function buildMissionSecondaryLabel(input: {
  isRuntimeManaged: boolean;
  taskSource?:
    | MissionControlProjection["tasks"][number]["taskSource"]
    | MissionControlProjection["runs"][number]["taskSource"]
    | MissionControlProjection["reviewPacks"][number]["taskSource"]
    | null
    | undefined;
}) {
  const labels: string[] = [];
  if (input.isRuntimeManaged) {
    labels.push("Runtime-managed mission");
  }
  const taskSourceLabel = resolveTaskSourceSecondaryLabel(input.taskSource ?? null);
  if (taskSourceLabel) {
    labels.push(taskSourceLabel);
  }
  return labels.length > 0 ? labels.join(" | ") : null;
}

export type ReviewPackSelectionSource =
  | "home"
  | "missions"
  | "sidebar"
  | "approval_toast"
  | "review_queue"
  | "review_surface"
  | "system";

export type ReviewPackSelectionRequest = {
  workspaceId: string;
  taskId?: string | null;
  runId?: string | null;
  reviewPackId?: string | null;
  source: ReviewPackSelectionSource;
};

export type ReviewPackSelectionState = {
  request: ReviewPackSelectionRequest | null;
  status: "empty" | "selected" | "fallback";
  detailKind?: "none" | "review_pack" | "mission_run";
  source: MissionControlProjection["source"] | null;
  selectedWorkspaceId: string | null;
  selectedTaskId: string | null;
  selectedRunId: string | null;
  selectedReviewPackId: string | null;
  fallbackReason:
    | null
    | "no_review_packs"
    | "requested_workspace_empty"
    | "requested_review_pack_missing"
    | "requested_task_missing"
    | "requested_run_missing";
};

export type ReviewPackDetailModel = {
  kind?: "review_pack";
  id: string;
  workspaceId: string;
  workspaceName: string;
  taskId: string;
  taskTitle: string;
  runId: string;
  runTitle: string | null;
  summary: string;
  createdAt: number;
  reviewStatus: HugeCodeReviewStatus;
  reviewStatusLabel: string;
  evidenceState: HugeCodeEvidenceState;
  evidenceLabel: string;
  validationOutcome: HugeCodeValidationOutcome;
  validationLabel: string;
  warningCount: number;
  warnings: string[];
  validations: MissionControlProjection["reviewPacks"][number]["validations"];
  artifacts: MissionControlProjection["reviewPacks"][number]["artifacts"];
  checksPerformed: string[];
  recommendedNextAction: string | null;
  navigationTarget: MissionNavigationTarget;
  secondaryLabel: string | null;
  source: MissionControlProjection["source"];
  sourceLabel: string;
  failureClass: HugeCodeFailureClass | null;
  failureClassLabel: string | null;
  failureClassSummary: string | null;
  publishHandoff: PublishHandoffSummary | null;
  continuity?: ReviewPackContinuitySummary | null;
  assumptions: string[];
  reproductionGuidance: string[];
  rollbackGuidance: string[];
  reviewDecision: {
    status: HugeCodeReviewDecisionState;
    reviewPackId: string;
    label: string;
    summary: string;
    decidedAt: number | null;
  };
  reviewIntelligence?: ReviewIntelligenceSummary | null;
  reviewProfileId: string | null;
  reviewGate: HugeCodeReviewGateSummary | null;
  reviewFindings: HugeCodeReviewFinding[];
  reviewRunId: string | null;
  skillUsage: HugeCodeRuntimeSkillUsageSummary[];
  autofixCandidate: HugeCodeRuntimeAutofixCandidate | null;
  backendAudit: {
    summary: string;
    details: string[];
    missingReason: string | null;
  };
  governance?: {
    summary: string;
    details: string[];
  };
  operatorSnapshot?: OperatorSnapshotSummary;
  placement?: {
    summary: string;
    details: string[];
  };
  workspaceEvidence?: WorkspaceEvidenceSummary;
  lineage?: {
    summary: string;
    details: string[];
  };
  ledger?: {
    summary: string;
    details: string[];
  };
  checkpoint?: {
    summary: string;
    details: string[];
  };
  executionContext?: {
    summary: string;
    details: string[];
  };
  missionBrief?: {
    summary: string;
    details: string[];
  };
  relaunchContext?: {
    summary: string;
    details: string[];
  };
  decisionActions: RuntimeReviewPackDecisionActionModel<MissionNavigationTarget>[];
  limitations: string[];
  relaunchOptions: RelaunchOption[];
  subAgentSummary: SubAgentSummary[];
  emptySectionLabels: {
    assumptions: string;
    warnings: string;
    validations: string;
    artifacts: string;
    reproduction: string;
    rollback: string;
  };
};

export type MissionRunDetailModel = {
  kind: "mission_run";
  workspaceId: string;
  workspaceName: string;
  taskId: string;
  taskTitle: string;
  runId: string;
  runTitle: string | null;
  summary: string;
  updatedAt: number;
  runState: HugeCodeRunState;
  runStateLabel: string;
  operatorHealth: "healthy" | "attention" | "blocked";
  operatorHeadline: string;
  operatorDetail: string | null;
  approvalLabel: string | null;
  approvalSummary: string | null;
  nextActionLabel: string;
  nextActionDetail: string | null;
  navigationTarget: MissionNavigationTarget | null;
  secondaryLabel: string | null;
  source: MissionControlProjection["source"];
  sourceLabel: string;
  warnings: string[];
  validations: MissionControlProjection["runs"][number]["validations"];
  artifacts: MissionControlProjection["runs"][number]["artifacts"];
  routeSummary: string;
  routeDetails: string[];
  reviewIntelligence?: ReviewIntelligenceSummary | null;
  reviewProfileId: string | null;
  reviewGate: HugeCodeReviewGateSummary | null;
  reviewFindings: HugeCodeReviewFinding[];
  reviewRunId: string | null;
  skillUsage: HugeCodeRuntimeSkillUsageSummary[];
  autofixCandidate: HugeCodeRuntimeAutofixCandidate | null;
  governance?: {
    summary: string;
    details: string[];
  };
  operatorSnapshot?: OperatorSnapshotSummary;
  placement?: {
    summary: string;
    details: string[];
  };
  workspaceEvidence?: WorkspaceEvidenceSummary;
  lineage?: {
    summary: string;
    details: string[];
  };
  ledger?: {
    summary: string;
    details: string[];
  };
  checkpoint?: {
    summary: string;
    details: string[];
  };
  executionContext?: {
    summary: string;
    details: string[];
  };
  missionBrief?: {
    summary: string;
    details: string[];
  };
  relaunchContext?: {
    summary: string;
    details: string[];
  };
  autoDriveSummary: string[];
  subAgentSummary: SubAgentSummary[];
  limitations: string[];
  emptySectionLabels: {
    warnings: string;
    validations: string;
    artifacts: string;
    autoDrive: string;
  };
};

export type MissionSurfaceDetailModel = ReviewPackDetailModel | MissionRunDetailModel;

function getSourceLabel(source: MissionControlProjection["source"]) {
  return source === "runtime_snapshot_v1"
    ? "Runtime snapshot"
    : "Mission-control snapshot unavailable";
}

function augmentDetailSection(
  section: { summary: string; details: string[] } | undefined,
  additions: Array<string | null | undefined>,
  fallbackSummary: string
) {
  const details = [...(section?.details ?? [])];
  for (const addition of additions) {
    pushUnique(details, addition ?? null);
  }
  if (details.length === 0 && !section) {
    return undefined;
  }
  return {
    summary: section?.summary ?? fallbackSummary,
    details,
  };
}

function formatSourceCitationDetail(
  citation:
    | NonNullable<MissionControlProjection["runs"][number]["sourceCitations"]>[number]
    | NonNullable<MissionControlProjection["reviewPacks"][number]["sourceCitations"]>[number]
) {
  const trustLabel =
    citation.trustLevel === "primary"
      ? "primary"
      : citation.trustLevel === "runtime"
        ? "runtime"
        : "derived";
  return `${citation.label}: ${citation.claimSummary} (${trustLabel})`;
}

function buildMissionRouteAudit(input: {
  routeLabel: string | null | undefined;
  routeHint: string | null | undefined;
  providerLabel: string | null | undefined;
  pool: string | null | undefined;
  health: string | null | undefined;
  backendId: string | null | undefined;
  executionProfileName: string | null | undefined;
  validationPresetId: string | null | undefined;
  profileReadinessSummary: string | null | undefined;
}) {
  const details: string[] = [];
  if (input.executionProfileName) {
    pushUnique(details, `Execution profile: ${input.executionProfileName}`);
  }
  if (input.validationPresetId) {
    pushUnique(details, `Validation preset: ${input.validationPresetId}`);
  }
  if (input.backendId) {
    pushUnique(details, `Backend: ${input.backendId}`);
  }
  if (input.providerLabel) {
    pushUnique(details, `Provider: ${input.providerLabel}`);
  }
  if (input.pool) {
    pushUnique(details, `Pool: ${input.pool}`);
  }
  if (input.health) {
    pushUnique(details, `Routing health: ${input.health}`);
  }
  if (input.routeHint) {
    pushUnique(details, input.routeHint);
  }
  if (input.profileReadinessSummary) {
    pushUnique(details, input.profileReadinessSummary);
  }
  return {
    routeSummary:
      input.routeLabel ??
      (input.executionProfileName
        ? `Executed with ${input.executionProfileName}`
        : "Routing unavailable"),
    routeDetails: details,
  };
}

function buildAutoDriveSummary(
  autoDrive: MissionControlProjection["runs"][number]["autoDrive"]
): string[] {
  const summary: string[] = [];
  if (!autoDrive?.enabled) {
    return summary;
  }
  pushUnique(summary, `Destination: ${autoDrive.destination.title}`);
  if (autoDrive.destination.desiredEndState.length > 0) {
    pushUnique(summary, `Desired end state: ${autoDrive.destination.desiredEndState.join("; ")}`);
  }
  if (autoDrive.destination.routePreference) {
    pushUnique(summary, `Route preference: ${autoDrive.destination.routePreference}`);
  }
  if (autoDrive.navigation?.activeWaypoint) {
    pushUnique(summary, `Active waypoint: ${autoDrive.navigation.activeWaypoint}`);
  }
  if ((autoDrive.navigation?.completedWaypoints?.length ?? 0) > 0) {
    pushUnique(
      summary,
      `Completed waypoints: ${autoDrive.navigation?.completedWaypoints?.join(", ")}`
    );
  }
  if ((autoDrive.navigation?.pendingWaypoints?.length ?? 0) > 0) {
    pushUnique(summary, `Pending waypoints: ${autoDrive.navigation?.pendingWaypoints?.join(", ")}`);
  }
  if (autoDrive.stop?.summary) {
    pushUnique(summary, `Stop summary: ${autoDrive.stop.summary}`);
  } else if (autoDrive.stop?.reason) {
    pushUnique(summary, `Stop reason: ${autoDrive.stop.reason}`);
  }
  return summary;
}

function normalizeSubAgentSummary(
  input:
    | RunWithExtras["subAgents"]
    | ReviewPackWithExtras["subAgentSummary"]
    | Array<Record<string, unknown>>
    | null
    | undefined
) {
  if (!Array.isArray(input)) {
    return [] as SubAgentSummary[];
  }
  return input
    .map((entry) => {
      if (!entry) {
        return null;
      }
      const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : null;
      if (!sessionId) {
        return null;
      }
      const parentRunId = typeof entry.parentRunId === "string" ? entry.parentRunId : null;
      const scopeProfile = typeof entry.scopeProfile === "string" ? entry.scopeProfile : null;
      const status = typeof entry.status === "string" ? entry.status : "unknown";
      const summary =
        typeof entry.summary === "string"
          ? entry.summary
          : "note" in entry && typeof (entry as { note?: unknown }).note === "string"
            ? ((entry as { note: string }).note ?? null)
            : "Sub-agent status snapshot";
      const approvalState =
        typeof entry.approvalState === "string"
          ? entry.approvalState
          : entry.approvalState &&
              typeof entry.approvalState === "object" &&
              typeof (entry.approvalState as { status?: unknown }).status === "string"
            ? ((entry.approvalState as { status: string }).status ?? null)
            : null;
      const checkpointState =
        typeof entry.checkpointState === "string"
          ? entry.checkpointState
          : entry.checkpointState &&
              typeof entry.checkpointState === "object" &&
              typeof (entry.checkpointState as { state?: unknown }).state === "string"
            ? ((entry.checkpointState as { state: string }).state ?? null)
            : null;
      const timedOutReason = typeof entry.timedOutReason === "string" ? entry.timedOutReason : null;
      const interruptedReason =
        typeof entry.interruptedReason === "string" ? entry.interruptedReason : null;
      return {
        sessionId,
        parentRunId,
        scopeProfile,
        status,
        approvalState,
        checkpointState,
        summary,
        timedOutReason,
        interruptedReason,
      };
    })
    .filter((value): value is SubAgentSummary => value !== null);
}

function buildFallbackReason(
  request: ReviewPackSelectionRequest | null,
  workspaceHasMissionDetail: boolean
): ReviewPackSelectionState["fallbackReason"] {
  if (!request) {
    return workspaceHasMissionDetail ? null : "no_review_packs";
  }
  if (!workspaceHasMissionDetail) {
    return "requested_workspace_empty";
  }
  if (request.reviewPackId) {
    return "requested_review_pack_missing";
  }
  if (request.runId) {
    return "requested_run_missing";
  }
  if (request.taskId) {
    return "requested_task_missing";
  }
  return null;
}

export function buildReviewPackListItems(
  projection: MissionControlProjection | null,
  workspaceId: string | null,
  repositoryExecutionContract?: RepositoryExecutionContract | null
): MissionReviewEntry[] {
  if (!projection || !workspaceId) {
    return [];
  }
  return buildMissionReviewEntriesFromProjection(projection, {
    workspaceId,
    limit: 24,
    repositoryExecutionContract: repositoryExecutionContract ?? null,
  });
}

function mapRuntimeNavigationTarget(input: {
  target: RuntimeMissionNavigationTarget;
  reviewPackId?: string | null;
  threadId?: string | null;
}): MissionNavigationTarget {
  const { target, reviewPackId = null, threadId = null } = input;
  if (target.kind === "thread") {
    return {
      kind: "thread",
      workspaceId: target.workspaceId,
      threadId: target.threadId,
    };
  }
  return {
    kind: "mission",
    workspaceId: target.workspaceId,
    taskId: target.taskId,
    runId: target.runId,
    reviewPackId: target.reviewPackId ?? reviewPackId,
    threadId,
    limitation: null,
  };
}

function buildReviewPackContinuity(input: {
  reviewPack: MissionControlProjection["reviewPacks"][number];
  run: MissionControlProjection["runs"][number] | null;
  task: MissionControlProjection["tasks"][number] | null;
  publishHandoff: PublishHandoffSummary | null;
}): ReviewPackContinuitySummary | null {
  const missionLinkage = input.reviewPack.missionLinkage ?? input.run?.missionLinkage ?? null;
  const actionability = input.reviewPack.actionability ?? input.run?.actionability ?? null;
  const checkpoint = input.reviewPack.checkpoint ?? input.run?.checkpoint ?? null;
  const rawPublishHandoff = input.reviewPack.publishHandoff ?? input.run?.publishHandoff ?? null;
  const takeoverBundle = input.reviewPack.takeoverBundle ?? input.run?.takeoverBundle ?? null;
  const descriptor = buildRuntimeContinuationDescriptor({
    runState: input.run?.state ?? "review_ready",
    checkpoint,
    missionLinkage,
    actionability,
    publishHandoff: rawPublishHandoff,
    takeoverBundle,
    reviewPackId: input.reviewPack.id,
  });
  const projectedContinuation =
    input.reviewPack.continuation ??
    input.run?.continuation ??
    resolveRuntimeContinuation({
      workspaceId: input.reviewPack.workspaceId,
      taskId: input.reviewPack.taskId,
      runId: input.reviewPack.runId,
      reviewPackId: input.reviewPack.id,
      state: input.run?.state ?? "review_ready",
      checkpoint,
      missionLinkage,
      actionability,
      publishHandoff: rawPublishHandoff,
      takeoverBundle,
    });

  if (!projectedContinuation && !descriptor) {
    return null;
  }
  if (projectedContinuation) {
    const details: string[] = descriptor ? [...descriptor.details] : [];
    if (projectedContinuation.detail) {
      pushUnique(details, projectedContinuation.detail);
    }
    if (input.publishHandoff?.branchName) {
      pushUnique(details, `Publish branch: ${input.publishHandoff.branchName}`);
    }
    if (checkpoint?.summary) {
      pushUnique(details, checkpoint.summary);
    }
    return {
      state: projectedContinuation.state === "missing" ? "attention" : projectedContinuation.state,
      summary: projectedContinuation.summary,
      details,
      recommendedAction: projectedContinuation.recommendedAction,
      blockingReason:
        projectedContinuation.state === "blocked"
          ? (projectedContinuation.detail ?? projectedContinuation.summary)
          : null,
      truthSourceLabel: formatRuntimeContinuationTruthSourceLabel(projectedContinuation.source),
    };
  }
  if (!descriptor) {
    return null;
  }
  const details: string[] = [...descriptor.details];
  if (input.publishHandoff?.branchName) {
    pushUnique(details, `Publish branch: ${input.publishHandoff.branchName}`);
  }
  if (checkpoint?.summary) {
    pushUnique(details, checkpoint.summary);
  }
  return {
    state: descriptor.state === "missing" ? "attention" : descriptor.state,
    summary: descriptor.summary,
    details,
    recommendedAction: descriptor.recommendedAction,
    blockingReason: descriptor.blockingReason,
    truthSourceLabel: descriptor.truthSourceLabel,
  };
}

export function resolveReviewPackSelection(input: {
  projection: MissionControlProjection | null;
  workspaceId: string | null;
  request: ReviewPackSelectionRequest | null;
}): ReviewPackSelectionState {
  if (!input.projection) {
    return {
      request: input.request,
      status: "empty",
      detailKind: "none",
      source: null,
      selectedWorkspaceId: input.workspaceId ?? input.request?.workspaceId ?? null,
      selectedTaskId: null,
      selectedRunId: null,
      selectedReviewPackId: null,
      fallbackReason: "no_review_packs",
    };
  }

  const preferredWorkspaceId = input.workspaceId ?? input.request?.workspaceId ?? null;
  const workspaceTasks = preferredWorkspaceId
    ? input.projection.tasks.filter((task) => task.workspaceId === preferredWorkspaceId)
    : input.projection.tasks;
  const workspaceRuns = preferredWorkspaceId
    ? input.projection.runs.filter((run) => run.workspaceId === preferredWorkspaceId)
    : input.projection.runs;
  const workspaceReviewPacks = preferredWorkspaceId
    ? input.projection.reviewPacks.filter(
        (reviewPack) => reviewPack.workspaceId === preferredWorkspaceId
      )
    : input.projection.reviewPacks;
  const reviewPacks =
    workspaceReviewPacks.length > 0 || preferredWorkspaceId
      ? workspaceReviewPacks
      : input.projection.reviewPacks;
  const runs =
    workspaceRuns.length > 0 || preferredWorkspaceId ? workspaceRuns : input.projection.runs;
  const tasks =
    workspaceTasks.length > 0 || preferredWorkspaceId ? workspaceTasks : input.projection.tasks;
  const sortedReviewPacks = reviewPacks
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt);
  const sortedRuns = runs.slice().sort((left, right) => right.updatedAt - left.updatedAt);
  const runById = new Map(input.projection.runs.map((run) => [run.id, run]));
  const taskById = new Map(input.projection.tasks.map((task) => [task.id, task]));

  let selected = null as MissionControlProjection["reviewPacks"][number] | null;
  let selectedRun = null as MissionControlProjection["runs"][number] | null;
  let selectedTask = null as MissionControlProjection["tasks"][number] | null;
  if (input.request?.reviewPackId) {
    selected =
      sortedReviewPacks.find((reviewPack) => reviewPack.id === input.request?.reviewPackId) ?? null;
  }
  if (!selected && input.request?.runId) {
    selected =
      sortedReviewPacks.find((reviewPack) => reviewPack.runId === input.request?.runId) ?? null;
    selectedRun = runs.find((run) => run.id === input.request?.runId) ?? null;
  }
  if (!selected && input.request?.taskId) {
    selected =
      sortedReviewPacks.find((reviewPack) => reviewPack.taskId === input.request?.taskId) ?? null;
    selectedTask = tasks.find((task) => task.id === input.request?.taskId) ?? null;
  }
  if (!selectedRun && selected) {
    selectedRun = runById.get(selected.runId) ?? null;
  }
  if (!selectedTask && selected) {
    selectedTask = taskById.get(selected.taskId) ?? null;
  }
  if (!selectedTask && selectedRun) {
    selectedTask = taskById.get(selectedRun.taskId) ?? null;
  }
  if (!selectedRun && selectedTask?.latestRunId) {
    selectedRun = runById.get(selectedTask.latestRunId) ?? null;
  }
  if (!selected) {
    selected = sortedReviewPacks[0] ?? null;
    if (!selected) {
      selectedRun = selectedRun ?? sortedRuns[0] ?? null;
      if (!selectedTask && selectedRun) {
        selectedTask = taskById.get(selectedRun.taskId) ?? null;
      }
    }
  }

  if (!selected && !selectedRun) {
    const workspaceHasMissionDetail =
      workspaceReviewPacks.length > 0 || workspaceRuns.length > 0 || workspaceTasks.length > 0;
    return {
      request: input.request,
      status: "empty",
      source: input.projection.source,
      detailKind: "none",
      selectedWorkspaceId: preferredWorkspaceId,
      selectedTaskId: null,
      selectedRunId: null,
      selectedReviewPackId: null,
      fallbackReason: buildFallbackReason(input.request, workspaceHasMissionDetail),
    };
  }

  if (selected && !selectedRun) {
    selectedRun = runById.get(selected.runId) ?? null;
  }
  if (selected && !selectedTask) {
    selectedTask = taskById.get(selected.taskId) ?? null;
  }
  const selectedWorkspaceId =
    selected?.workspaceId ?? selectedRun?.workspaceId ?? preferredWorkspaceId;
  const selectedTaskId = selected?.taskId ?? selectedTask?.id ?? null;
  const selectedRunId = selected?.runId ?? selectedRun?.id ?? null;
  const detailKind = selected ? "review_pack" : "mission_run";
  const requestedWorkspaceHasMissionDetail =
    workspaceReviewPacks.length > 0 || workspaceRuns.length > 0 || workspaceTasks.length > 0;
  const fallbackReason =
    input.request &&
    ((input.request.reviewPackId && input.request.reviewPackId !== selected?.id) ||
      (input.request.runId && input.request.runId !== selectedRunId) ||
      (input.request.taskId && input.request.taskId !== selectedTaskId) ||
      input.request.workspaceId !== selectedWorkspaceId)
      ? buildFallbackReason(input.request, requestedWorkspaceHasMissionDetail)
      : null;

  return {
    request: input.request,
    status: fallbackReason ? "fallback" : "selected",
    source: input.projection.source,
    detailKind,
    selectedWorkspaceId,
    selectedTaskId,
    selectedRunId,
    selectedReviewPackId: selected?.id ?? null,
    fallbackReason,
  };
}

export function buildReviewPackDetailModel(input: {
  projection: MissionControlProjection | null;
  selection: ReviewPackSelectionState;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  runtimeReviewPack?: RuntimeReviewGetV2Response;
}): MissionSurfaceDetailModel | null {
  const projection = input.projection;
  if (!projection) {
    return null;
  }

  const runId = input.selection.selectedRunId;
  const taskId = input.selection.selectedTaskId;
  const reviewPackId = input.selection.selectedReviewPackId;
  const runtimeReviewPack =
    input.runtimeReviewPack &&
    ((reviewPackId !== null && input.runtimeReviewPack.id === reviewPackId) ||
      (runId !== null && input.runtimeReviewPack.runId === runId) ||
      (taskId !== null && input.runtimeReviewPack.taskId === taskId))
      ? input.runtimeReviewPack
      : null;
  const runtimeAutonomyProfile = runtimeReviewPack?.autonomyProfile ?? null;
  const runtimeWakePolicy = runtimeReviewPack?.wakePolicy ?? null;
  const reviewPack =
    runtimeReviewPack ??
    (reviewPackId === null
      ? null
      : (projection.reviewPacks.find((entry) => entry.id === reviewPackId) ?? null));
  const run =
    (reviewPack
      ? projection.runs.find((entry) => entry.id === reviewPack.runId)
      : runId
        ? projection.runs.find((entry) => entry.id === runId)
        : null) ?? null;
  const task =
    (reviewPack
      ? projection.tasks.find((entry) => entry.id === reviewPack.taskId)
      : taskId
        ? projection.tasks.find((entry) => entry.id === taskId)
        : run
          ? projection.tasks.find((entry) => entry.id === run.taskId)
          : null) ?? null;
  const workspaceId = reviewPack?.workspaceId ?? run?.workspaceId ?? task?.workspaceId ?? null;
  const workspace =
    workspaceId === null
      ? null
      : (projection.workspaces.find((entry) => entry.id === workspaceId) ?? null);

  const reviewPackExtra = reviewPack ? (reviewPack as ReviewPackWithExtras) : null;
  const runExtra = run ? (run as RunWithExtras) : null;

  if (!reviewPack) {
    if (!run || !task || !workspaceId) {
      return null;
    }
    const preferredBackendIds = resolveRuntimeFollowUpPreferredBackendIds(
      run.placement ?? null,
      run.routing?.backendId
    );
    const missionRunContinuationDefaults = resolveReviewContinuationDefaults({
      contract: input.repositoryExecutionContract ?? null,
      taskSource: run.taskSource ?? task.taskSource ?? null,
      runtimeDefaults: {
        sourceTaskId: task.id,
        sourceRunId: run.id,
        sourceReviewPackId: null,
        taskSource: run.taskSource ?? task.taskSource ?? null,
        executionProfileId: run.executionProfile?.id ?? null,
        preferredBackendIds,
        accessMode: run.executionProfile?.accessMode ?? null,
        validationPresetId: run.executionProfile?.validationPresetId ?? null,
        relaunchContext: run.relaunchContext ?? null,
      },
      fallbackProfileId: run.executionProfile?.id ?? null,
    });
    const isRuntimeManaged = isRuntimeManagedMissionTaskId(task.id);
    const navigationTarget =
      task.origin.threadId === null
        ? null
        : {
            kind: "thread" as const,
            workspaceId,
            threadId: task.origin.threadId,
          };
    const routeAudit = buildMissionRouteAudit({
      routeLabel: run.routing?.routeLabel,
      routeHint: run.routing?.routeHint,
      providerLabel: run.routing?.providerLabel,
      pool: run.routing?.pool,
      health: run.routing?.health,
      backendId: run.routing?.backendId,
      executionProfileName: run.executionProfile?.name,
      validationPresetId: run.executionProfile?.validationPresetId,
      profileReadinessSummary: run.profileReadiness?.summary,
    });
    const runtimeContinuation = buildRuntimeContinuationDescriptor({
      runState: run.state,
      checkpoint: run.checkpoint ?? null,
      missionLinkage: run.missionLinkage ?? null,
      actionability: run.actionability ?? null,
      publishHandoff: run.publishHandoff ?? null,
      takeoverBundle: run.takeoverBundle ?? null,
      nextAction: run.nextAction ?? null,
      reviewPackId: run.reviewPackId ?? null,
    });
    const reviewIntelligence = resolveReviewIntelligenceSummary({
      contract: input.repositoryExecutionContract ?? null,
      taskSource: run.taskSource ?? task.taskSource ?? null,
      run,
      recommendedNextAction:
        runtimeContinuation?.recommendedAction ?? run.nextAction?.detail ?? null,
    });
    const limitations: string[] = [];
    if (isRuntimeManaged) {
      limitations.push(
        "This runtime-managed mission now opens in mission detail so route state, validations, and interventions stay in one place."
      );
    }
    if (run.approval?.status === "pending_decision") {
      limitations.push("Operator approval is still pending before this mission can proceed.");
    }
    if (run.state === "failed" || run.state === "cancelled") {
      limitations.push(
        run.completionReason?.trim() ||
          "This run ended before a review pack was produced. Inspect the recorded route state before relaunching."
      );
    }
    const lineage = augmentDetailSection(
      buildMissionLineageDetail({
        lineage: run.lineage ?? task.lineage ?? null,
        taskSource: run.taskSource ?? task.taskSource ?? null,
        fallbackObjective: task.objective,
      }),
      [
        run.selectedOpportunityId ? `Selected opportunity: ${run.selectedOpportunityId}` : null,
        ...(run.sourceCitations ?? []).map(formatSourceCitationDetail),
      ],
      "Runtime published mission direction and selection evidence for this run."
    );
    const relaunchContext = augmentDetailSection(
      buildRelaunchContextDetail(run.relaunchContext ?? null),
      [
        run.wakeReason ? `Wake reason: ${run.wakeReason}` : null,
        run.wakeState ? `Wake state: ${run.wakeState}` : null,
        run.nextEligibleAction ? `Next eligible action: ${run.nextEligibleAction}` : null,
        typeof run.queuePosition === "number" ? `Queue position: ${run.queuePosition}` : null,
      ],
      "Runtime recorded wake-up gates and the next eligible operator action."
    );
    return {
      kind: "mission_run",
      workspaceId,
      workspaceName: workspace?.name ?? "Workspace",
      taskId: task.id,
      taskTitle: task.title,
      runId: run.id,
      runTitle: run.title ?? null,
      summary:
        run.summary?.trim() ||
        task.objective?.trim() ||
        task.nextAction?.detail?.trim() ||
        "Mission detail is available, but the runtime did not publish a textual summary for this run.",
      updatedAt: run.finishedAt ?? run.updatedAt,
      runState: run.state,
      runStateLabel: formatHugeCodeRunStateLabel(run.state),
      operatorHealth: run.operatorState?.health ?? "attention",
      operatorHeadline: run.operatorState?.headline ?? "Inspect runtime route state",
      operatorDetail: run.operatorState?.detail ?? null,
      approvalLabel: run.approval?.label ?? null,
      approvalSummary: run.approval?.summary ?? null,
      nextActionLabel:
        runtimeContinuation?.canonicalNextAction.label ??
        run.nextAction?.label ??
        "Inspect mission detail",
      nextActionDetail:
        runtimeContinuation?.canonicalNextAction.detail ??
        run.nextAction?.detail ??
        "Open the linked mission thread, review validations, or relaunch with a narrower follow-up.",
      navigationTarget,
      secondaryLabel: buildMissionSecondaryLabel({
        isRuntimeManaged,
        taskSource: run.taskSource ?? task.taskSource ?? null,
      }),
      source: projection.source,
      sourceLabel: getSourceLabel(projection.source),
      warnings: run.warnings ?? [],
      validations: run.validations ?? [],
      artifacts: run.artifacts ?? [],
      routeSummary: routeAudit.routeSummary,
      routeDetails: routeAudit.routeDetails,
      reviewIntelligence,
      reviewProfileId: reviewIntelligence?.reviewProfileId ?? null,
      reviewGate: reviewIntelligence?.reviewGate ?? null,
      reviewFindings: reviewIntelligence?.reviewFindings ?? [],
      reviewRunId: reviewIntelligence?.reviewRunId ?? null,
      skillUsage: reviewIntelligence?.skillUsage ?? [],
      autofixCandidate: reviewIntelligence?.autofixCandidate ?? null,
      governance: buildGovernanceDetail(run.governance ?? null),
      operatorSnapshot: buildOperatorSnapshotDetail(run.operatorSnapshot ?? null),
      placement: buildPlacementDetail(run.placement ?? null),
      workspaceEvidence: buildWorkspaceEvidenceDetail(run.workspaceEvidence ?? null),
      lineage,
      ledger: buildRunLedgerDetail({
        ledger: run.ledger ?? null,
        warningCount: run.warnings?.length ?? 0,
        validationCount: run.validations?.length ?? 0,
        artifactCount: run.artifacts?.length ?? 0,
      }),
      checkpoint: buildCheckpointDetail(run.checkpoint ?? null),
      executionContext: buildExecutionContext({
        executionProfileName: run.executionProfile?.name,
        reviewProfileId:
          reviewIntelligence?.reviewProfileId ?? missionRunContinuationDefaults.reviewProfileId,
        validationPresetId:
          reviewIntelligence?.validationPresetId ??
          missionRunContinuationDefaults.validationPresetId,
        backendId: run.routing?.backendId,
        providerLabel: run.routing?.providerLabel,
        autonomyProfile: null,
        wakePolicy: null,
        accessMode: missionRunContinuationDefaults.accessMode,
        sourceMappingKind: missionRunContinuationDefaults.sourceMappingKind,
        fieldOrigins: missionRunContinuationDefaults.fieldOrigins,
        inheritFollowUpDefaults:
          (run.intervention?.actions.some((action) => action.enabled && action.supported) ??
            false) ||
          Boolean(run.nextAction),
      }),
      missionBrief: buildMissionBriefDetail(run.missionBrief ?? null),
      relaunchContext,
      autoDriveSummary: buildAutoDriveSummary(run.autoDrive ?? null),
      subAgentSummary: normalizeSubAgentSummary(
        runExtra?.subAgents ?? runExtra?.subAgentSummary ?? null
      ),
      limitations,
      emptySectionLabels: {
        warnings: "The runtime did not record warnings for this mission run.",
        validations: "No runtime validation details were recorded for this mission run.",
        artifacts: "No runtime artifacts or evidence references were attached to this mission run.",
        autoDrive: "This run did not publish an AutoDrive route snapshot.",
      },
    };
  }

  const taskTitle = task?.title ?? run?.title ?? "Untitled review pack";
  const reviewDecision = reviewPack.reviewDecision ??
    run?.reviewDecision ?? {
      status: "pending" as const,
      reviewPackId: reviewPack.id,
      label: "Decision pending",
      summary: "Accept or reject this result from the review surface.",
      decidedAt: null,
    };
  const isRuntimeManaged = task ? isRuntimeManagedMissionTaskId(task.id) : true;
  const missionLinkage = reviewPackExtra?.missionLinkage ?? run?.missionLinkage ?? null;
  const navigationTarget: MissionNavigationTarget = missionLinkage?.navigationTarget
    ? mapRuntimeNavigationTarget({
        target: missionLinkage.navigationTarget,
        reviewPackId: reviewPack.id,
        threadId: task?.origin.threadId ?? missionLinkage.threadId ?? null,
      })
    : task && task.origin.threadId
      ? {
          kind: "thread",
          workspaceId: reviewPack.workspaceId,
          threadId: task.origin.threadId,
        }
      : {
          kind: "review",
          workspaceId: reviewPack.workspaceId,
          taskId: reviewPack.taskId,
          runId: reviewPack.runId,
          reviewPackId: reviewPack.id,
          limitation: "thread_unavailable",
        };

  const limitations: string[] = [];
  if (isRuntimeManaged && navigationTarget.kind !== "thread") {
    limitations.push(
      "This review pack was produced by a runtime-managed task without a thread detail view yet."
    );
  }
  if (reviewPack.evidenceState === "incomplete") {
    limitations.push(
      "Runtime evidence is incomplete. Review the available checks before accepting the result."
    );
  }
  if (reviewPack.validationOutcome === "unknown") {
    limitations.push(
      "Validation outcome is unavailable because the runtime did not record a validation result."
    );
  }
  const interventionInstruction =
    run?.summary?.trim() || run?.title?.trim() || reviewPack.summary.trim() || taskTitle;
  const followUpState = buildRuntimeReviewPackFollowUpState({
    source: projection.source,
    placement: reviewPack.placement ?? run?.placement ?? null,
    routingBackendId: run?.routing?.backendId,
    contract: input.repositoryExecutionContract ?? null,
    taskSource: reviewPack.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
    runtimeDefaults: run
      ? {
          sourceTaskId: reviewPack.taskId,
          sourceRunId: reviewPack.runId,
          sourceReviewPackId: reviewPack.id,
          taskSource: reviewPack.taskSource ?? run.taskSource ?? task?.taskSource ?? null,
          executionProfileId: run.executionProfile?.id ?? null,
          accessMode: run.executionProfile?.accessMode ?? null,
          validationPresetId: run.executionProfile?.validationPresetId ?? null,
          relaunchContext: run.relaunchContext ?? null,
        }
      : null,
    navigationTarget,
    nextActionDetail: run?.nextAction?.detail,
    title: run?.title ?? taskTitle,
    instruction: interventionInstruction,
    actions: run?.intervention?.actions,
    reviewDecision: {
      status: reviewDecision.status,
      reviewPackId: reviewDecision.reviewPackId,
      summary: reviewDecision.summary,
    },
    evidenceState: reviewPack.evidenceState,
    reviewStatus: reviewPack.reviewStatus,
    fallbackProfileId: run?.executionProfile?.id ?? null,
  });
  if (followUpState.readOnlyReason) {
    limitations.push(followUpState.readOnlyReason);
  }

  const assumptions = Array.isArray(reviewPack.assumptions) ? reviewPack.assumptions : [];
  const reproductionGuidance = Array.isArray(reviewPack.reproductionGuidance)
    ? reviewPack.reproductionGuidance
    : [];
  const rollbackGuidance = Array.isArray(reviewPack.rollbackGuidance)
    ? reviewPack.rollbackGuidance
    : [];
  const backendAudit = reviewPack.backendAudit ?? {
    summary: "Runtime backend audit unavailable",
    details: [],
    missingReason: "The runtime did not publish backend audit details for this review pack.",
  };
  const reviewContinuationDefaults = followUpState.continuationDefaults;
  const decisionActions = followUpState.decisionActions;
  const followUpDefaultsAvailable = followUpState.interventionActions.some(
    (action) => action.enabled
  );
  const lineage = augmentDetailSection(
    buildMissionLineageDetail({
      lineage: reviewPack.lineage ?? run?.lineage ?? task?.lineage ?? null,
      taskSource: reviewPack.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
      fallbackObjective: task?.objective ?? reviewPack.summary,
      fallbackReviewDecisionState: reviewDecision.status,
    }),
    [
      (reviewPack.selectedOpportunityId ?? run?.selectedOpportunityId)
        ? `Selected opportunity: ${reviewPack.selectedOpportunityId ?? run?.selectedOpportunityId}`
        : null,
      ...(
        (reviewPack.sourceCitations ?? run?.sourceCitations ?? []) as Array<
          NonNullable<MissionControlProjection["reviewPacks"][number]["sourceCitations"]>[number]
        >
      ).map(formatSourceCitationDetail),
    ],
    "Runtime published mission direction and evidence citations for this review pack."
  );
  const ledger = buildRunLedgerDetail({
    ledger: reviewPack.ledger ?? run?.ledger ?? null,
    warningCount: reviewPack.warningCount,
    validationCount: reviewPack.validations.length,
    artifactCount: reviewPack.artifacts.length,
  });
  const checkpoint = buildCheckpointDetail(reviewPack.checkpoint ?? run?.checkpoint ?? null);

  const failureMeta = describeReviewFailureClass(reviewPackExtra?.failureClass ?? null);
  const relaunchOptions = normalizeReviewPackRelaunchOptions(
    reviewPackExtra?.relaunchOptions ?? null
  );
  const fallbackSubAgents = normalizeSubAgentSummary(
    runExtra?.subAgents ?? runExtra?.subAgentSummary ?? null
  );
  const extractedSubAgents = normalizeSubAgentSummary(reviewPackExtra?.subAgentSummary ?? null);
  const subAgentSummary = extractedSubAgents.length > 0 ? extractedSubAgents : fallbackSubAgents;
  const publishHandoff = normalizeReviewPackPublishHandoff(
    reviewPackExtra?.publishHandoff ?? run?.publishHandoff ?? null
  );
  const continuity = buildReviewPackContinuity({
    reviewPack,
    run,
    task,
    publishHandoff,
  });
  const relaunchContext = augmentDetailSection(
    buildRelaunchContextDetail(reviewPackExtra?.relaunchOptions ?? run?.relaunchContext ?? null),
    [
      (reviewPack.wakeReason ?? run?.wakeReason)
        ? `Wake reason: ${reviewPack.wakeReason ?? run?.wakeReason}`
        : null,
      (reviewPack.wakeState ?? run?.wakeState)
        ? `Wake state: ${reviewPack.wakeState ?? run?.wakeState}`
        : null,
      (reviewPack.nextEligibleAction ?? run?.nextEligibleAction)
        ? `Next eligible action: ${reviewPack.nextEligibleAction ?? run?.nextEligibleAction}`
        : null,
      typeof (reviewPack.queuePosition ?? run?.queuePosition) === "number"
        ? `Queue position: ${reviewPack.queuePosition ?? run?.queuePosition}`
        : null,
    ],
    "Runtime recorded why this pack woke the operator and what can happen next."
  );
  const reviewRecommendedNextAction =
    reviewPackExtra?.actionability?.summary ??
    run?.actionability?.summary ??
    continuity?.recommendedAction ??
    reviewPack.recommendedNextAction ??
    null;
  const reviewIntelligence = resolveReviewIntelligenceSummary({
    contract: input.repositoryExecutionContract ?? null,
    taskSource: reviewPack.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
    run,
    reviewPack,
    recommendedNextAction: reviewRecommendedNextAction,
  });

  return {
    kind: "review_pack",
    id: reviewPack.id,
    workspaceId: reviewPack.workspaceId,
    workspaceName: workspace?.name ?? "Workspace",
    taskId: reviewPack.taskId,
    taskTitle,
    runId: reviewPack.runId,
    runTitle: run?.title ?? null,
    summary: reviewPack.summary,
    createdAt: reviewPack.createdAt,
    reviewStatus: reviewPack.reviewStatus,
    reviewStatusLabel: formatReviewStatusLabel(reviewPack.reviewStatus, reviewPack.warningCount),
    evidenceState: reviewPack.evidenceState,
    evidenceLabel: formatReviewEvidenceStateLabel(reviewPack.evidenceState),
    validationOutcome: reviewPack.validationOutcome,
    validationLabel: formatValidationOutcomeLabel(reviewPack.validationOutcome),
    warningCount: reviewPack.warningCount,
    warnings: reviewPack.warnings,
    validations: reviewPack.validations,
    artifacts: reviewPack.artifacts,
    checksPerformed: reviewPack.checksPerformed,
    recommendedNextAction: reviewRecommendedNextAction,
    navigationTarget,
    secondaryLabel: buildMissionSecondaryLabel({
      isRuntimeManaged,
      taskSource: reviewPack.taskSource ?? run?.taskSource ?? task?.taskSource ?? null,
    }),
    source: projection.source,
    sourceLabel: getSourceLabel(projection.source),
    failureClass: reviewPackExtra?.failureClass ?? null,
    failureClassLabel: failureMeta.label,
    failureClassSummary: failureMeta.summary,
    publishHandoff,
    continuity,
    assumptions,
    reproductionGuidance,
    rollbackGuidance,
    reviewDecision,
    reviewIntelligence,
    reviewProfileId: reviewIntelligence?.reviewProfileId ?? null,
    reviewGate: reviewIntelligence?.reviewGate ?? null,
    reviewFindings: reviewIntelligence?.reviewFindings ?? [],
    reviewRunId: reviewIntelligence?.reviewRunId ?? null,
    skillUsage: reviewIntelligence?.skillUsage ?? [],
    autofixCandidate: reviewIntelligence?.autofixCandidate ?? null,
    backendAudit,
    governance: buildGovernanceDetail(reviewPack.governance ?? run?.governance ?? null),
    operatorSnapshot: buildOperatorSnapshotDetail(run?.operatorSnapshot ?? null),
    placement: buildPlacementDetail(reviewPack.placement ?? run?.placement ?? null),
    workspaceEvidence: buildWorkspaceEvidenceDetail(
      reviewPackExtra?.workspaceEvidence ?? run?.workspaceEvidence ?? null
    ),
    lineage,
    ledger,
    checkpoint,
    executionContext: buildExecutionContext({
      executionProfileName: run?.executionProfile?.name,
      autonomyProfile: runtimeAutonomyProfile,
      wakePolicy: runtimeWakePolicy,
      reviewProfileId:
        reviewIntelligence?.reviewProfileId ?? reviewContinuationDefaults?.reviewProfileId,
      validationPresetId:
        reviewIntelligence?.validationPresetId ?? reviewContinuationDefaults?.validationPresetId,
      backendId: run?.routing?.backendId,
      providerLabel: run?.routing?.providerLabel,
      accessMode: reviewContinuationDefaults?.accessMode,
      sourceMappingKind: reviewContinuationDefaults?.sourceMappingKind,
      fieldOrigins: reviewContinuationDefaults?.fieldOrigins,
      inheritFollowUpDefaults: followUpDefaultsAvailable,
    }),
    missionBrief: buildMissionBriefDetail(run?.missionBrief ?? null),
    relaunchContext,
    decisionActions,
    relaunchOptions,
    subAgentSummary,
    limitations,
    emptySectionLabels: {
      assumptions: "The runtime did not record explicit review assumptions for this pack.",
      warnings: "The runtime did not record any warnings for this review pack.",
      validations:
        reviewPack.validationOutcome === "unknown"
          ? "Validation evidence was not recorded for this run."
          : "No individual validation checks were recorded for this run.",
      artifacts: "No artifacts or evidence references were attached to this review pack.",
      reproduction:
        "The runtime did not record reproduction guidance for this review pack. Re-run the linked validations or inspect attached evidence.",
      rollback:
        "The runtime did not record rollback guidance for this review pack. Use diff evidence or reopen the mission thread before reverting changes.",
    },
  };
}
