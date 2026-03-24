import type { HugeCodeReviewDecisionState } from "@ku0/code-runtime-host-contract";
import type { MissionControlProjection } from "./runtimeMissionControlFacade";
import { buildTaskSourceLineageDetails } from "./runtimeMissionControlTaskSourceProjector";
import type {
  ReviewContinuationFieldOrigin,
  ReviewContinuationFieldOrigins,
} from "./runtimeReviewContinuationFacade";

export type OperatorEventSummary = {
  kind?: string | null;
  label: string;
  detail: string | null;
  at: number | null;
};

export type OperatorSnapshotSummary = {
  summary: string;
  details: string[];
  currentActivity: string | null;
  blocker: string | null;
  recentEvents: OperatorEventSummary[];
};

export type WorkspaceEvidenceBucketSummary = {
  kind: string;
  label: string;
  summary: string;
  items: Array<{
    label: string;
    detail: string | null;
    uri: string | null;
  }>;
  missingReason: string | null;
};

export type WorkspaceEvidenceSummary = {
  summary: string;
  buckets: WorkspaceEvidenceBucketSummary[];
};

type MissionLineageInput =
  | MissionControlProjection["tasks"][number]["lineage"]
  | MissionControlProjection["runs"][number]["lineage"]
  | MissionControlProjection["reviewPacks"][number]["lineage"];

type RunLedgerInput =
  | MissionControlProjection["runs"][number]["ledger"]
  | MissionControlProjection["reviewPacks"][number]["ledger"];

type CheckpointInput =
  | MissionControlProjection["runs"][number]["checkpoint"]
  | MissionControlProjection["reviewPacks"][number]["checkpoint"];

type GovernanceInput =
  | MissionControlProjection["runs"][number]["governance"]
  | MissionControlProjection["reviewPacks"][number]["governance"];

export type PlacementInput =
  | MissionControlProjection["runs"][number]["placement"]
  | MissionControlProjection["reviewPacks"][number]["placement"];

export function pushUnique(target: string[], value: string | null | undefined) {
  if (!value) {
    return;
  }
  if (!target.includes(value)) {
    target.push(value);
  }
}

export function buildExecutionContext(input: {
  executionProfileName: string | null | undefined;
  reviewProfileId?: string | null | undefined;
  validationPresetId: string | null | undefined;
  backendId: string | null | undefined;
  providerLabel: string | null | undefined;
  accessMode?: string | null | undefined;
  sourceMappingKind?: string | null | undefined;
  fieldOrigins?: Partial<ReviewContinuationFieldOrigins> | null | undefined;
  inheritFollowUpDefaults: boolean;
}) {
  const profileName = input.executionProfileName?.trim() || null;
  const reviewProfileId = input.reviewProfileId?.trim() || null;
  const validationPresetId = input.validationPresetId?.trim() || null;
  const backendId = input.backendId?.trim() || null;
  const providerLabel = input.providerLabel?.trim() || null;
  const accessMode = input.accessMode?.trim() || null;
  const sourceMappingKind = input.sourceMappingKind?.trim() || null;
  if (
    !profileName &&
    !reviewProfileId &&
    !validationPresetId &&
    !backendId &&
    !providerLabel &&
    !accessMode &&
    !sourceMappingKind
  ) {
    return undefined;
  }

  const routeLabel = backendId ?? providerLabel;
  const summary =
    profileName && routeLabel
      ? `${profileName} via ${routeLabel}`
      : (profileName ?? routeLabel ?? "Execution context available");
  const details: string[] = [];
  if (profileName) {
    pushUnique(details, `Execution profile: ${profileName}`);
  }
  if (validationPresetId) {
    pushUnique(details, `Validation preset: ${validationPresetId}`);
  }
  if (reviewProfileId) {
    pushUnique(details, `Review profile: ${reviewProfileId}`);
  }
  if (accessMode) {
    pushUnique(details, `Access mode: ${accessMode}`);
  }
  if (backendId) {
    pushUnique(details, `Backend route: ${backendId}`);
  } else if (providerLabel) {
    pushUnique(details, `Provider route: ${providerLabel}`);
  }
  if (sourceMappingKind) {
    pushUnique(details, `Repo source mapping: ${sourceMappingKind}`);
  }
  pushUnique(
    details,
    formatContinuationOrigin("Profile source", input.fieldOrigins?.executionProfileId)
  );
  pushUnique(
    details,
    formatContinuationOrigin("Backend source", input.fieldOrigins?.preferredBackendIds)
  );
  pushUnique(
    details,
    formatContinuationOrigin("Validation source", input.fieldOrigins?.validationPresetId)
  );
  pushUnique(
    details,
    formatContinuationOrigin("Review profile source", input.fieldOrigins?.reviewProfileId)
  );
  pushUnique(details, formatContinuationOrigin("Access source", input.fieldOrigins?.accessMode));
  if (input.inheritFollowUpDefaults) {
    pushUnique(
      details,
      "Follow-up relaunches inherit the recorded execution profile and backend route until changed by a control device in Mission Control."
    );
  }
  return {
    summary,
    details,
  };
}

function formatContinuationOrigin(
  label: string,
  origin: ReviewContinuationFieldOrigin | null | undefined
) {
  switch (origin) {
    case "explicit_override":
      return `${label}: explicit operator override.`;
    case "runtime_recorded":
      return `${label}: runtime-recorded default.`;
    case "runtime_relaunch_context":
      return `${label}: runtime relaunch context.`;
    case "repo_source_mapping":
      return `${label}: repo source mapping.`;
    case "repo_defaults":
      return `${label}: repo defaults.`;
    case "runtime_fallback":
      return `${label}: runtime fallback.`;
    default:
      return null;
  }
}

export function buildMissionBriefDetail(
  missionBrief: MissionControlProjection["runs"][number]["missionBrief"] | null | undefined
) {
  if (!missionBrief) {
    return undefined;
  }
  const details: string[] = [];
  pushUnique(details, `Objective: ${missionBrief.objective}`);
  if ((missionBrief.doneDefinition?.length ?? 0) > 0) {
    pushUnique(details, `Done definition: ${missionBrief.doneDefinition?.join("; ")}`);
  }
  if ((missionBrief.constraints?.length ?? 0) > 0) {
    pushUnique(details, `Constraints: ${missionBrief.constraints?.join("; ")}`);
  }
  if (missionBrief.riskLevel) {
    pushUnique(details, `Risk level: ${missionBrief.riskLevel}`);
  }
  if ((missionBrief.requiredCapabilities?.length ?? 0) > 0) {
    pushUnique(details, `Required capabilities: ${missionBrief.requiredCapabilities?.join(", ")}`);
  }
  if (typeof missionBrief.maxSubtasks === "number") {
    pushUnique(details, `Max subtasks: ${missionBrief.maxSubtasks}`);
  }
  if ((missionBrief.preferredBackendIds?.length ?? 0) > 0) {
    pushUnique(details, `Preferred backends: ${missionBrief.preferredBackendIds?.join(", ")}`);
  }
  if (missionBrief.planVersion) {
    pushUnique(details, `Plan version: ${missionBrief.planVersion}`);
  }
  if (missionBrief.planSummary) {
    pushUnique(details, `Plan summary: ${missionBrief.planSummary}`);
  }
  if (missionBrief.currentMilestoneId) {
    pushUnique(details, `Current milestone: ${missionBrief.currentMilestoneId}`);
  }
  if (typeof missionBrief.estimatedWorkerRuns === "number") {
    pushUnique(details, `Estimated worker runs: ${missionBrief.estimatedWorkerRuns}`);
  }
  if (typeof missionBrief.estimatedDurationMinutes === "number") {
    pushUnique(details, `Estimated duration: ${missionBrief.estimatedDurationMinutes} min`);
  }
  if (missionBrief.parallelismHint) {
    pushUnique(details, `Parallelism: ${missionBrief.parallelismHint}`);
  }
  if ((missionBrief.clarificationQuestions?.length ?? 0) > 0) {
    pushUnique(details, `Clarifying questions: ${missionBrief.clarificationQuestions?.join("; ")}`);
  }
  if ((missionBrief.milestones?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Milestones: ${missionBrief.milestones
        ?.map((milestone) => `${milestone.label} [${milestone.status ?? "planned"}]`)
        .join("; ")}`
    );
  }
  if ((missionBrief.validationLanes?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Validation lanes: ${missionBrief.validationLanes
        ?.map((lane) => `${lane.label} (${lane.trigger})`)
        .join("; ")}`
    );
  }
  if ((missionBrief.skillPlan?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Skill plan: ${missionBrief.skillPlan
        ?.map((skill) => `${skill.label} [${skill.state}]`)
        .join("; ")}`
    );
  }
  if (missionBrief.permissionSummary?.accessMode) {
    pushUnique(details, `Access mode: ${missionBrief.permissionSummary.accessMode}`);
  }
  if (typeof missionBrief.permissionSummary?.allowNetwork === "boolean") {
    pushUnique(
      details,
      missionBrief.permissionSummary.allowNetwork
        ? "Network access allowed."
        : "Network access disabled."
    );
  }
  if ((missionBrief.permissionSummary?.writableRoots?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Writable roots: ${missionBrief.permissionSummary?.writableRoots?.join(", ")}`
    );
  }
  if ((missionBrief.permissionSummary?.toolNames?.length ?? 0) > 0) {
    pushUnique(details, `Approved tools: ${missionBrief.permissionSummary?.toolNames?.join(", ")}`);
  }
  if (details.length === 0) {
    return undefined;
  }
  return {
    summary: "Structured mission brief persisted for relaunch, supervision, and review.",
    details,
  };
}

export function buildRelaunchContextDetail(
  relaunchContext:
    | MissionControlProjection["runs"][number]["relaunchContext"]
    | MissionControlProjection["reviewPacks"][number]["relaunchOptions"]
    | null
    | undefined
) {
  if (!relaunchContext) {
    return undefined;
  }
  const details: string[] = [];
  if (relaunchContext.sourceTaskId) {
    pushUnique(details, `Source task: ${relaunchContext.sourceTaskId}`);
  }
  if (relaunchContext.sourceRunId) {
    pushUnique(details, `Source run: ${relaunchContext.sourceRunId}`);
  }
  if (relaunchContext.sourceReviewPackId) {
    pushUnique(details, `Source review pack: ${relaunchContext.sourceReviewPackId}`);
  }
  if (relaunchContext.sourcePlanVersion) {
    pushUnique(details, `Source plan version: ${relaunchContext.sourcePlanVersion}`);
  }
  if (relaunchContext.failureClass) {
    pushUnique(details, `Failure class: ${relaunchContext.failureClass}`);
  }
  if ((relaunchContext.recommendedActions?.length ?? 0) > 0) {
    pushUnique(details, `Recommended actions: ${relaunchContext.recommendedActions?.join(", ")}`);
  }
  if (relaunchContext.planChangeSummary) {
    pushUnique(details, `Plan change: ${relaunchContext.planChangeSummary}`);
  }
  if (details.length === 0 && !relaunchContext.summary) {
    return undefined;
  }
  return {
    summary:
      relaunchContext.summary?.trim() ||
      "Structured relaunch context is attached to this runtime-managed mission.",
    details,
  };
}

function describeTaskMode(taskMode: string | null | undefined) {
  switch (taskMode) {
    case "ask":
      return "Ask mode";
    case "pair":
      return "Pair mode";
    case "delegate":
      return "Delegate mode";
    default:
      return null;
  }
}

function buildRiskPolicySummary(
  riskPolicy: NonNullable<MissionLineageInput>["riskPolicy"] | null | undefined
) {
  if (!riskPolicy) {
    return null;
  }
  const parts: string[] = [];
  if (riskPolicy.pauseOnDestructiveChange) {
    parts.push("pause on destructive change");
  }
  if (riskPolicy.pauseOnDependencyChange) {
    parts.push("pause on dependency change");
  }
  if (riskPolicy.pauseOnLowConfidence) {
    parts.push("pause on low confidence");
  }
  if (riskPolicy.pauseOnHumanCheckpoint) {
    parts.push("pause on human checkpoint");
  }
  if (riskPolicy.allowNetworkAnalysis) {
    parts.push("allow network analysis");
  }
  if (riskPolicy.allowValidationCommands) {
    parts.push("allow validation commands");
  }
  if (riskPolicy.minimumConfidence) {
    parts.push(`minimum confidence ${riskPolicy.minimumConfidence}`);
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildMissionLineageDetail(input: {
  lineage: MissionLineageInput | null | undefined;
  taskSource?:
    | MissionControlProjection["tasks"][number]["taskSource"]
    | MissionControlProjection["runs"][number]["taskSource"]
    | MissionControlProjection["reviewPacks"][number]["taskSource"]
    | null
    | undefined;
  fallbackObjective?: string | null;
  fallbackReviewDecisionState?: HugeCodeReviewDecisionState | null;
}) {
  const lineage = input.lineage;
  const details: string[] = [];
  const objective = lineage?.objective?.trim() || input.fallbackObjective?.trim() || null;
  if (objective) {
    pushUnique(details, `Objective: ${objective}`);
  }
  if ((lineage?.desiredEndState?.length ?? 0) > 0) {
    pushUnique(details, `Desired end state: ${lineage?.desiredEndState?.join("; ")}`);
  }
  if ((lineage?.hardBoundaries?.length ?? 0) > 0) {
    pushUnique(details, `Constraints: ${lineage?.hardBoundaries?.join("; ")}`);
  }
  if ((lineage?.doneDefinition?.arrivalCriteria?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Arrival criteria: ${lineage?.doneDefinition?.arrivalCriteria?.join("; ")}`
    );
  }
  if ((lineage?.doneDefinition?.requiredValidation?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Required validation: ${lineage?.doneDefinition?.requiredValidation?.join("; ")}`
    );
  }
  if ((lineage?.doneDefinition?.waypointIndicators?.length ?? 0) > 0) {
    pushUnique(
      details,
      `Waypoint indicators: ${lineage?.doneDefinition?.waypointIndicators?.join("; ")}`
    );
  }
  const riskPolicySummary = buildRiskPolicySummary(lineage?.riskPolicy);
  if (riskPolicySummary) {
    pushUnique(details, `Risk policy: ${riskPolicySummary}`);
  }
  const taskModeLabel = describeTaskMode(lineage?.taskMode ?? null);
  if (taskModeLabel) {
    pushUnique(details, `Task mode: ${taskModeLabel}`);
  }
  if (lineage?.executionProfileId) {
    pushUnique(details, `Execution profile: ${lineage.executionProfileId}`);
  }
  if (lineage?.taskSource?.label) {
    pushUnique(details, `Task source: ${lineage.taskSource.label}`);
  }
  if (lineage?.taskSource?.externalId) {
    pushUnique(details, `Source ID: ${lineage.taskSource.externalId}`);
  }
  if (lineage?.taskSource?.canonicalUrl) {
    pushUnique(details, `Source URL: ${lineage.taskSource.canonicalUrl}`);
  }
  const reviewDecisionState =
    lineage?.reviewDecisionState ?? input.fallbackReviewDecisionState ?? null;
  if (reviewDecisionState) {
    pushUnique(details, `Review decision: ${reviewDecisionState}`);
  }
  if (lineage?.reviewDecisionSummary) {
    pushUnique(details, `Review summary: ${lineage.reviewDecisionSummary}`);
  }
  for (const detail of buildTaskSourceLineageDetails(input.taskSource)) {
    pushUnique(details, detail);
  }
  if (details.length === 0) {
    return undefined;
  }
  return {
    summary:
      "Objective, guardrails, and review outcome stayed attached to this runtime-managed mission.",
    details,
  };
}

export function buildRunLedgerDetail(input: {
  ledger: RunLedgerInput | null | undefined;
  warningCount?: number;
  validationCount?: number;
  artifactCount?: number;
}) {
  const ledger = input.ledger;
  if (!ledger) {
    return undefined;
  }
  const details: string[] = [];
  if (ledger.traceId) {
    pushUnique(details, `Trace ID: ${ledger.traceId}`);
  }
  if (ledger.checkpointId) {
    pushUnique(details, `Checkpoint: ${ledger.checkpointId}`);
  }
  pushUnique(details, `Steps recorded: ${ledger.completedStepCount}/${ledger.stepCount}`);
  pushUnique(details, `Warnings recorded: ${input.warningCount ?? ledger.warningCount}`);
  pushUnique(details, `Validations recorded: ${input.validationCount ?? ledger.validationCount}`);
  pushUnique(details, `Artifacts recorded: ${input.artifactCount ?? ledger.artifactCount}`);
  if (ledger.backendId) {
    pushUnique(details, `Backend route: ${ledger.backendId}`);
  }
  if (ledger.routeLabel) {
    pushUnique(details, `Route summary: ${ledger.routeLabel}`);
  }
  if (ledger.completionReason) {
    pushUnique(details, `Completion reason: ${ledger.completionReason}`);
  }
  if (ledger.recovered) {
    pushUnique(details, "Recovered from a runtime checkpoint before continuing.");
  }
  if (details.length === 0) {
    return undefined;
  }
  return {
    summary:
      "Trace, checkpoint, and routing facts were recorded for control-device handoff and review.",
    details,
  };
}

export function buildCheckpointDetail(checkpoint: CheckpointInput | null | undefined) {
  if (!checkpoint) {
    return undefined;
  }
  const details: string[] = [];
  pushUnique(details, `Checkpoint state: ${checkpoint.state}`);
  if (checkpoint.lifecycleState) {
    pushUnique(details, `Lifecycle state: ${checkpoint.lifecycleState}`);
  }
  if (checkpoint.checkpointId) {
    pushUnique(details, `Checkpoint ID: ${checkpoint.checkpointId}`);
  }
  if (checkpoint.traceId) {
    pushUnique(details, `Trace ID: ${checkpoint.traceId}`);
  }
  if (checkpoint.recovered) {
    pushUnique(details, "Runtime recovered this run from a checkpoint.");
  }
  if (checkpoint.resumeReady) {
    pushUnique(details, "Resume is ready from another control device.");
  }
  if (details.length === 0) {
    return undefined;
  }
  return {
    summary:
      checkpoint.summary?.trim() ||
      (checkpoint.resumeReady
        ? "Checkpoint is ready for cross-device resume and handoff."
        : checkpoint.recovered
          ? "Runtime recovered this run from a checkpoint."
          : "Checkpoint truth is available for supervision and handoff."),
    details,
  };
}

export function buildGovernanceDetail(governance: GovernanceInput | null | undefined) {
  if (!governance) {
    return undefined;
  }
  const details: string[] = [];
  pushUnique(details, `Governance state: ${governance.state}`);
  pushUnique(
    details,
    governance.blocking
      ? "Execution is blocked on an operator decision."
      : "Execution is not currently blocked by governance."
  );
  if (governance.suggestedAction) {
    pushUnique(details, `Suggested action: ${governance.suggestedAction}`);
  }
  if (governance.availableActions.length > 0) {
    pushUnique(details, `Available actions: ${governance.availableActions.join(", ")}`);
  }
  return {
    summary: `${governance.label}: ${governance.summary}`,
    details,
  };
}

export function buildPlacementDetail(placement: PlacementInput | null | undefined) {
  if (!placement) {
    return undefined;
  }
  const details: string[] = [];
  pushUnique(details, `Placement lifecycle: ${placement.lifecycleState}`);
  pushUnique(details, `Placement source: ${placement.resolutionSource}`);
  if (placement.requestedBackendIds.length > 0) {
    pushUnique(details, `Requested backends: ${placement.requestedBackendIds.join(", ")}`);
  }
  if (placement.resolvedBackendId) {
    pushUnique(details, `Resolved backend: ${placement.resolvedBackendId}`);
  }
  if (placement.readiness) {
    pushUnique(details, `Routing readiness: ${placement.readiness}`);
    if (placement.readiness !== "ready") {
      pushUnique(details, "Routing is degraded or waiting for fuller runtime confirmation.");
    }
  }
  if (placement.healthSummary) {
    pushUnique(details, `Placement health: ${placement.healthSummary}`);
  }
  if ((placement.attentionReasons?.length ?? 0) > 0) {
    pushUnique(details, `Placement attention reasons: ${placement.attentionReasons.join(", ")}`);
  }
  if (placement.fallbackReasonCode) {
    pushUnique(details, `Placement fallback reason: ${placement.fallbackReasonCode}`);
  }
  if (placement.resumeBackendId) {
    pushUnique(details, `Resume backend affinity: ${placement.resumeBackendId}`);
  }
  if ((placement.scoreBreakdown?.length ?? 0) > 0) {
    const breakdown = (placement.scoreBreakdown ?? [])
      .map((entry) => {
        const backendId =
          typeof entry?.backendId === "string" && entry.backendId.trim().length > 0
            ? entry.backendId.trim()
            : null;
        const totalScore = typeof entry?.totalScore === "number" ? entry.totalScore : null;
        return backendId && totalScore !== null ? `${backendId}=${totalScore}` : null;
      })
      .filter((entry): entry is string => entry !== null);
    if (breakdown.length > 0) {
      pushUnique(details, `Placement score breakdown: ${breakdown.join(", ")}`);
    }
  }
  if (placement.tcpOverlay) {
    pushUnique(details, `TCP overlay: ${placement.tcpOverlay}`);
  }
  if (
    placement.lifecycleState === "requested" ||
    placement.lifecycleState === "resolved" ||
    placement.lifecycleState === "unresolved"
  ) {
    pushUnique(details, "Placement confirmation is still incomplete.");
  }
  pushUnique(details, `Placement rationale: ${placement.rationale}`);
  if (placement.backendContract) {
    pushUnique(
      details,
      `Backend contract: ${placement.backendContract.kind} via ${placement.backendContract.origin}`
    );
    if (placement.backendContract.transport) {
      pushUnique(details, `Backend transport: ${placement.backendContract.transport}`);
    }
    pushUnique(details, `Backend health: ${placement.backendContract.health}`);
  }
  return {
    summary: placement.summary,
    details,
  };
}

export function buildOperatorSnapshotDetail(
  snapshot: MissionControlProjection["runs"][number]["operatorSnapshot"] | null | undefined
) {
  if (!snapshot) {
    return undefined;
  }
  const details: string[] = [];
  if (snapshot.runtimeLabel) {
    pushUnique(details, `Runtime: ${snapshot.runtimeLabel}`);
  }
  if (snapshot.modelId) {
    pushUnique(details, `Model: ${snapshot.modelId}`);
  }
  if (snapshot.reasoningEffort) {
    pushUnique(details, `Reasoning effort: ${snapshot.reasoningEffort}`);
  }
  if (snapshot.backendId) {
    pushUnique(details, `Backend: ${snapshot.backendId}`);
  }
  if (snapshot.machineId) {
    pushUnique(details, `Machine: ${snapshot.machineId}`);
  } else if (snapshot.machineSummary) {
    pushUnique(details, snapshot.machineSummary);
  }
  if (snapshot.workspaceRoot) {
    pushUnique(details, `Workspace root: ${snapshot.workspaceRoot}`);
  }
  return {
    summary: snapshot.summary,
    details,
    currentActivity: snapshot.currentActivity ?? null,
    blocker: snapshot.blocker ?? null,
    recentEvents: (snapshot.recentEvents ?? []).map((event) => ({
      kind: event.kind ?? null,
      label: event.label,
      detail: event.detail ?? null,
      at: event.at ?? null,
    })),
  };
}

export function buildWorkspaceEvidenceDetail(
  evidence:
    | MissionControlProjection["runs"][number]["workspaceEvidence"]
    | MissionControlProjection["reviewPacks"][number]["workspaceEvidence"]
    | null
    | undefined
) {
  if (!evidence) {
    return undefined;
  }
  return {
    summary: evidence.summary,
    buckets: (evidence.buckets ?? []).map((bucket) => ({
      kind: bucket.kind,
      label: bucket.label,
      summary: bucket.summary,
      items: (bucket.items ?? []).map((item) => ({
        label: item.label,
        detail: item.detail ?? null,
        uri: item.uri ?? null,
      })),
      missingReason: bucket.missingReason ?? null,
    })),
  };
}
