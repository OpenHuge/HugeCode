import type {
  AgentTaskAutoDriveState,
  HugeCodeMissionControlSnapshot,
  RuntimeAutonomyRequestV2,
} from "@ku0/code-runtime-host-contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AutoDriveConfidence,
  AutoDriveControllerHookDraft,
  AutoDriveContinuationPolicy,
  AutoDriveRiskPolicy,
  AutoDriveRoutePreference,
  AutoDriveRunRecord,
} from "../../../application/runtime/types/autoDrive";
import type { RuntimeAgentControl } from "../../../application/runtime/types/webMcpBridge";
import { buildAgentTaskLaunchControls } from "../../../application/runtime/facades/runtimeMissionDraftFacade";
import { launchAutoDriveThread } from "../../../application/runtime/facades/runtimeAutoDriveThreadLaunch";
import type { AccessMode, WorkspaceInfo } from "../../../types";
import { trackProductAnalyticsEvent } from "../../shared/productAnalytics";
import type { ThreadCodexParamsPatch } from "../../threads/hooks/useThreadCodexParams";
import {
  mapDraftToRuntimeAutoDriveState,
  type AutoDriveRuntimeRunRecord,
  selectAutoDriveSnapshot,
} from "./autoDriveRuntimeSnapshotAdapter";

const DEFAULT_RISK_POLICY: AutoDriveRiskPolicy = {
  pauseOnDestructiveChange: true,
  pauseOnDependencyChange: true,
  pauseOnLowConfidence: true,
  pauseOnHumanCheckpoint: true,
  allowNetworkAnalysis: true,
  allowValidationCommands: true,
  allowChatgptDecisionLab: true,
  autoRunChatgptDecisionLab: true,
  chatgptDecisionLabMinConfidence: "medium",
  chatgptDecisionLabMaxScoreGap: 8,
  minimumConfidence: "medium",
};

const DEFAULT_ROUTE_PREFERENCE: AutoDriveRoutePreference = "stability_first";

const DEFAULT_CONTINUATION_POLICY: AutoDriveContinuationPolicy = {
  enabled: true,
  maxAutomaticFollowUps: 2,
  requireValidationSuccessToStop: true,
  minimumConfidenceToStop: "high",
};

const DEFAULT_DRAFT: AutoDriveControllerHookDraft = {
  enabled: false,
  destination: {
    title: "",
    endState: "",
    doneDefinition: "",
    avoid: "",
    routePreference: DEFAULT_ROUTE_PREFERENCE,
  },
  budget: {
    maxTokens: 6000,
    maxIterations: 3,
    maxDurationMinutes: 10,
    maxFilesPerIteration: 6,
    maxNoProgressIterations: 2,
    maxValidationFailures: 2,
    maxReroutes: 2,
  },
  riskPolicy: DEFAULT_RISK_POLICY,
  continuation: DEFAULT_CONTINUATION_POLICY,
};

type RuntimeAutoDriveControl = Pick<RuntimeAgentControl, "startTask" | "interveneTask">;

type UseAutoDriveControllerOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  accessMode: AccessMode;
  selectedModelId: string | null;
  selectedEffort: string | null;
  preferredBackendIds?: string[] | null;
  missionControlProjection: HugeCodeMissionControlSnapshot | null;
  runtimeControl: RuntimeAutoDriveControl | null;
  onRefreshMissionControl?: (() => Promise<void> | void) | null;
  threadCodexParamsVersion: number;
  getThreadCodexParams: (
    workspaceId: string,
    threadId: string
  ) => {
    autoDriveDraft?: AutoDriveControllerHookDraft | null;
  } | null;
  patchThreadCodexParams: (
    workspaceId: string,
    threadId: string,
    patch: ThreadCodexParamsPatch
  ) => void;
  runtimeOverrides?: {
    now?: () => number;
    missionControlProjection?: HugeCodeMissionControlSnapshot | null;
    runtimeControl?: RuntimeAutoDriveControl | null;
    launchTaskThroughRuntimeControl?: boolean;
  };
};

type AutoDriveBusyAction = "starting" | "pausing" | "resuming" | "stopping";
type AutoDriveBudgetField = keyof AutoDriveControllerHookDraft["budget"];
type AutoDrivePresetKey = "safe_default" | "tight_validation" | "fast_explore";
type AutoDriveActivityKind = "control" | "status" | "stage" | "waypoint" | "reroute" | "stop";

export type AutoDriveActivityEntry = {
  id: string;
  kind: AutoDriveActivityKind;
  title: string;
  detail: string;
  iteration: number | null;
  timestamp: number;
};

export type AutoDriveLaunchChecklistItem = {
  label: string;
  complete: boolean;
};

const MAX_ACTIVITY_ENTRIES = 10;

const AUTO_DRIVE_PRESETS: Record<
  AutoDrivePresetKey,
  Pick<AutoDriveControllerHookDraft, "budget" | "riskPolicy"> & {
    routePreference: AutoDriveRoutePreference;
  }
> = {
  safe_default: {
    routePreference: "stability_first",
    budget: {
      maxTokens: 6000,
      maxIterations: 3,
      maxDurationMinutes: 10,
      maxFilesPerIteration: 6,
      maxNoProgressIterations: 2,
      maxValidationFailures: 2,
      maxReroutes: 2,
    },
    riskPolicy: DEFAULT_RISK_POLICY,
  },
  tight_validation: {
    routePreference: "validation_first",
    budget: {
      maxTokens: 2500,
      maxIterations: 2,
      maxDurationMinutes: 5,
      maxFilesPerIteration: 4,
      maxNoProgressIterations: 1,
      maxValidationFailures: 1,
      maxReroutes: 1,
    },
    riskPolicy: {
      ...DEFAULT_RISK_POLICY,
      allowNetworkAnalysis: false,
      allowValidationCommands: true,
    },
  },
  fast_explore: {
    routePreference: "speed_first",
    budget: {
      maxTokens: 4000,
      maxIterations: 2,
      maxDurationMinutes: 5,
      maxFilesPerIteration: 6,
      maxNoProgressIterations: 1,
      maxValidationFailures: 1,
      maxReroutes: 1,
    },
    riskPolicy: {
      ...DEFAULT_RISK_POLICY,
      allowNetworkAnalysis: true,
      allowValidationCommands: true,
    },
  },
};

function normalizeConfidence(value: string | null | undefined): AutoDriveConfidence {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return DEFAULT_RISK_POLICY.minimumConfidence;
}

function normalizeContinuationConfidence(value: string | null | undefined): AutoDriveConfidence {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return DEFAULT_CONTINUATION_POLICY.minimumConfidenceToStop;
}

type PersistedAutoDriveDraft = AutoDriveControllerHookDraft & {
  goal?: string;
  constraints?: string;
};

function migratePersistedDraftShape(
  value: PersistedAutoDriveDraft
): AutoDriveControllerHookDraft["destination"] {
  const migratedGoal = value.goal ?? "";
  const migratedConstraints = value.constraints ?? "";
  return {
    title: value.destination?.title ?? migratedGoal,
    endState: value.destination?.endState ?? "",
    doneDefinition: value.destination?.doneDefinition ?? "",
    avoid: value.destination?.avoid ?? migratedConstraints,
    routePreference: value.destination?.routePreference ?? DEFAULT_ROUTE_PREFERENCE,
  };
}

function normalizeDraft(
  value: PersistedAutoDriveDraft | null | undefined
): AutoDriveControllerHookDraft {
  if (!value) {
    return DEFAULT_DRAFT;
  }
  return {
    enabled: value.enabled === true,
    destination: migratePersistedDraftShape(value),
    budget: {
      maxTokens: value.budget?.maxTokens ?? DEFAULT_DRAFT.budget.maxTokens,
      maxIterations: value.budget?.maxIterations ?? DEFAULT_DRAFT.budget.maxIterations,
      maxDurationMinutes:
        value.budget?.maxDurationMinutes ?? DEFAULT_DRAFT.budget.maxDurationMinutes,
      maxFilesPerIteration:
        value.budget?.maxFilesPerIteration ?? DEFAULT_DRAFT.budget.maxFilesPerIteration,
      maxNoProgressIterations:
        value.budget?.maxNoProgressIterations ?? DEFAULT_DRAFT.budget.maxNoProgressIterations,
      maxValidationFailures:
        value.budget?.maxValidationFailures ?? DEFAULT_DRAFT.budget.maxValidationFailures,
      maxReroutes: value.budget?.maxReroutes ?? DEFAULT_DRAFT.budget.maxReroutes,
    },
    riskPolicy: {
      ...DEFAULT_RISK_POLICY,
      ...(value.riskPolicy ?? {}),
      minimumConfidence: normalizeConfidence(value.riskPolicy?.minimumConfidence),
    },
    continuation: {
      ...DEFAULT_CONTINUATION_POLICY,
      ...(value.continuation ?? {}),
      minimumConfidenceToStop: normalizeContinuationConfidence(
        value.continuation?.minimumConfidenceToStop
      ),
    },
  };
}

function clampInteger(value: number, minimum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.max(minimum, Math.round(value));
}

function sanitizeBudgetValue(key: AutoDriveBudgetField, value: number): number {
  const minimums: Record<AutoDriveBudgetField, number> = {
    maxTokens: 100,
    maxIterations: 1,
    maxDurationMinutes: 1,
    maxFilesPerIteration: 1,
    maxNoProgressIterations: 1,
    maxValidationFailures: 1,
    maxReroutes: 1,
  };
  return clampInteger(value, minimums[key]);
}

function normalizeBudgetDraftValue(current: number, next: number): number {
  if (!Number.isFinite(next)) {
    return current;
  }
  const rounded = Math.round(next);
  if (rounded <= 0) {
    return current;
  }
  return rounded;
}

function buildLaunchReadiness(params: {
  draft: AutoDriveControllerHookDraft;
  hasWorkspace: boolean;
  source: HugeCodeMissionControlSnapshot["source"] | null;
}): {
  readyToLaunch: boolean;
  issues: string[];
  warnings: string[];
  checklist: AutoDriveLaunchChecklistItem[];
  setupProgress: number;
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const checklist: AutoDriveLaunchChecklistItem[] = [
    {
      label: "Destination title set",
      complete: params.draft.destination.title.trim().length > 0,
    },
    {
      label: "Desired end state mapped",
      complete: params.draft.destination.endState.trim().length > 0,
    },
    {
      label: "Done definition captured",
      complete: params.draft.destination.doneDefinition.trim().length > 0,
    },
  ];

  if (!params.hasWorkspace) {
    issues.push("Connect a workspace before launching AutoDrive.");
  }
  if (params.source !== "runtime_snapshot_v1") {
    warnings.push(
      "Runtime-managed AutoDrive is unavailable right now. Controls stay blocked until the mission-control snapshot returns."
    );
  }
  if (!checklist[0]?.complete) {
    issues.push("Define a destination before launch.");
  }
  if (!checklist[1]?.complete) {
    issues.push("Describe the desired end state so AutoDrive knows what arrival looks like.");
  }
  if (!checklist[2]?.complete) {
    issues.push("Add a done definition so route completion is auditable.");
  }

  if (params.draft.destination.avoid.trim().length === 0) {
    warnings.push(
      "No forbidden routes defined yet. AutoDrive will still respect built-in policy boundaries."
    );
  }
  if (!params.draft.riskPolicy.allowValidationCommands) {
    warnings.push("Validation commands are disabled, so arrival confidence may stay lower.");
  }
  if (!params.draft.riskPolicy.allowNetworkAnalysis) {
    warnings.push(
      "Network analysis is disabled, so AutoDrive cannot benchmark against current external guidance and ecosystem changes."
    );
  }
  if (params.draft.budget.maxIterations <= 1) {
    warnings.push(
      "Only one iteration is allowed. AutoDrive may stop before a reroute or validation pass."
    );
  }
  if (params.draft.budget.maxTokens < 1000) {
    warnings.push("Token budget is tight. Expect early safety stops.");
  }

  return {
    readyToLaunch: issues.length === 0,
    issues,
    warnings,
    checklist,
    setupProgress: Math.round(
      (checklist.filter((item) => item.complete).length / checklist.length) * 100
    ),
  };
}

function resolveActivePresetKey(
  draft: AutoDriveControllerHookDraft
): AutoDrivePresetKey | "custom" {
  const entries = Object.entries(AUTO_DRIVE_PRESETS) as Array<
    [AutoDrivePresetKey, (typeof AUTO_DRIVE_PRESETS)[AutoDrivePresetKey]]
  >;
  for (const [key, preset] of entries) {
    const sameRoutePreference = draft.destination.routePreference === preset.routePreference;
    const sameBudget = Object.entries(preset.budget).every(([budgetKey, value]) => {
      const typedKey = budgetKey as keyof AutoDriveControllerHookDraft["budget"];
      return draft.budget[typedKey] === value;
    });
    const sameRiskPolicy = Object.entries(preset.riskPolicy).every(([policyKey, value]) => {
      const typedKey = policyKey as keyof AutoDriveRiskPolicy;
      return draft.riskPolicy[typedKey] === value;
    });
    if (sameRoutePreference && sameBudget && sameRiskPolicy) {
      return key;
    }
  }
  return "custom";
}

function formatRunStatusLabel(status: AutoDriveRuntimeRunRecord["status"]): string {
  switch (status) {
    case "created":
      return "Route created";
    case "running":
      return "Route running";
    case "paused":
      return "Route paused";
    case "review_ready":
      return "Review ready";
    case "cancelled":
      return "Route cancelled";
    case "failed":
      return "Route failed";
    case "completed":
      return "Destination reached";
    case "stopped":
      return "Route stopped";
    default:
      return "Route updated";
  }
}

function formatRunStageLabel(stage: AutoDriveRunRecord["stage"]): string {
  return stage.replaceAll("_", " ");
}

function appendActivityEntries(
  current: AutoDriveActivityEntry[],
  entries: AutoDriveActivityEntry[]
): AutoDriveActivityEntry[] {
  let next = current;
  for (const entry of entries) {
    const lastEntry = next[0] ?? null;
    if (
      lastEntry &&
      lastEntry.kind === entry.kind &&
      lastEntry.title === entry.title &&
      lastEntry.detail === entry.detail &&
      lastEntry.iteration === entry.iteration
    ) {
      continue;
    }
    next = [entry, ...next].slice(0, MAX_ACTIVITY_ENTRIES);
  }
  return next;
}

function buildRunActivityEntries(params: {
  previousRun: AutoDriveRuntimeRunRecord | null;
  nextRun: AutoDriveRuntimeRunRecord;
  now: number;
}): AutoDriveActivityEntry[] {
  const { previousRun, nextRun, now } = params;
  const entries: AutoDriveActivityEntry[] = [];

  if (!previousRun || previousRun.runId !== nextRun.runId) {
    entries.push({
      id: `${nextRun.runId}:status:${now}`,
      kind: "status",
      title: formatRunStatusLabel(nextRun.status),
      detail: `Run ${nextRun.runId} is now ${nextRun.status} in ${formatRunStageLabel(nextRun.stage)}.`,
      iteration: nextRun.iteration,
      timestamp: now,
    });
    return entries;
  }

  if (previousRun.status !== nextRun.status) {
    entries.push({
      id: `${nextRun.runId}:status:${nextRun.status}:${now}`,
      kind: "status",
      title: formatRunStatusLabel(nextRun.status),
      detail: `Route changed from ${previousRun.status} to ${nextRun.status}.`,
      iteration: nextRun.iteration,
      timestamp: now,
    });
  }

  if (previousRun.stage !== nextRun.stage && nextRun.status === "running") {
    entries.push({
      id: `${nextRun.runId}:stage:${nextRun.stage}:${now}`,
      kind: "stage",
      title: `Stage: ${formatRunStageLabel(nextRun.stage)}`,
      detail: `AutoDrive advanced into ${formatRunStageLabel(nextRun.stage)}.`,
      iteration: nextRun.iteration,
      timestamp: now,
    });
  }

  if (previousRun.navigation.currentWaypointTitle !== nextRun.navigation.currentWaypointTitle) {
    const nextWaypointTitle = nextRun.navigation.currentWaypointTitle;
    if (nextWaypointTitle) {
      entries.push({
        id: `${nextRun.runId}:waypoint:${nextWaypointTitle}:${now}`,
        kind: "waypoint",
        title: `Waypoint: ${nextWaypointTitle}`,
        detail:
          nextRun.navigation.currentWaypointObjective ??
          "AutoDrive selected a new waypoint for the active route.",
        iteration: nextRun.iteration,
        timestamp: now,
      });
    }
  }

  if (
    previousRun.latestReroute?.createdAt !== nextRun.latestReroute?.createdAt &&
    nextRun.latestReroute
  ) {
    entries.push({
      id: `${nextRun.runId}:reroute:${nextRun.latestReroute.createdAt}`,
      kind: "reroute",
      title: "Route rerouted",
      detail: `${nextRun.latestReroute.reason} Trigger: ${nextRun.latestReroute.trigger}`,
      iteration: nextRun.iteration,
      timestamp: nextRun.latestReroute.createdAt,
    });
  }

  if (
    previousRun.lastStopReason?.detail !== nextRun.lastStopReason?.detail &&
    nextRun.lastStopReason?.detail
  ) {
    entries.push({
      id: `${nextRun.runId}:stop:${nextRun.lastStopReason.code}:${now}`,
      kind: "stop",
      title:
        nextRun.lastStopReason.code === "goal_reached" ? "Arrival confirmed" : "Route decision",
      detail: nextRun.lastStopReason.detail,
      iteration: nextRun.iteration,
      timestamp: now,
    });
  }

  return entries;
}

function buildAutoDriveInstruction(
  draft: AutoDriveControllerHookDraft,
  launchControls: {
    requiredCapabilities: string[] | null;
    maxSubtasks: number | null;
  }
): string {
  const destination = draft.destination.title.trim();
  const endState = draft.destination.endState.trim();
  const doneDefinition = draft.destination.doneDefinition.trim();
  const avoid = draft.destination.avoid.trim();
  const continuationPolicy = draft.continuation ?? DEFAULT_CONTINUATION_POLICY;
  return [
    "AutoDrive launch capsule",
    `Objective: ${destination || "Untitled destination"}`,
    endState ? `Desired end state: ${endState}` : null,
    doneDefinition ? `Done definition: ${doneDefinition}` : null,
    avoid ? `Hard boundaries: ${avoid}` : null,
    "Mission shape: Treat this as an independent AutoDrive mission, not a thread-bound continuation.",
    "Context scope: Inspect the current workspace and the app-wide workspace graph before choosing the first route.",
    launchControls.requiredCapabilities?.length
      ? `Launch capabilities: ${launchControls.requiredCapabilities.join(", ")}`
      : null,
    launchControls.maxSubtasks ? `Bounded subtasks: ${launchControls.maxSubtasks}` : null,
    continuationPolicy.enabled
      ? `Continuation policy: Keep autonomously issuing focused follow-up prompts until the route is validated and confidence reaches ${continuationPolicy.minimumConfidenceToStop}, capped at ${continuationPolicy.maxAutomaticFollowUps} automatic follow-ups.`
      : "Continuation policy: Do not auto-append follow-up prompts after the first route pass.",
    continuationPolicy.requireValidationSuccessToStop
      ? "Stopping rule: Do not declare the route final while required validation is still missing or failing."
      : "Stopping rule: Validation is advisory for route completion.",
    draft.riskPolicy.allowNetworkAnalysis
      ? "Research posture: Use network analysis when it materially improves architecture, implementation choices, or validation strategy."
      : "Research posture: Network analysis is disabled, so rely on local repository truth only.",
    "Runtime must synthesize repo-grounded execution context, validation posture, app-level workspace signals, and the first safe waypoint before making changes.",
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join("\n\n");
}

function canStartAutoDriveRun(params: {
  enabled: boolean;
  hasWorkspace: boolean;
  hasThread: boolean;
  readyToLaunch: boolean;
  source: HugeCodeMissionControlSnapshot["source"] | null;
  runStatus: AutoDriveRuntimeRunRecord["status"] | null;
  busyAction: AutoDriveBusyAction | null;
}): boolean {
  if (
    !params.enabled ||
    !params.hasWorkspace ||
    !params.hasThread ||
    !params.readyToLaunch ||
    params.source !== "runtime_snapshot_v1" ||
    params.busyAction !== null
  ) {
    return false;
  }
  if (params.runStatus === "running" || params.runStatus === "paused") {
    return false;
  }
  return true;
}

function normalizeReasonEffort(value: string | null): "low" | "medium" | "high" | "xhigh" | null {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return null;
}

function buildNightOperatorAutonomyRequest(
  draft: AutoDriveControllerHookDraft
): RuntimeAutonomyRequestV2 {
  const maxAutomaticFollowUps =
    draft.continuation?.maxAutomaticFollowUps ?? DEFAULT_CONTINUATION_POLICY.maxAutomaticFollowUps;
  const maxRuntimeMinutes = sanitizeBudgetValue(
    "maxDurationMinutes",
    draft.budget.maxDurationMinutes
  );
  return {
    autonomyProfile: "night_operator",
    wakePolicy: {
      mode: "auto_queue",
      safeFollowUp: true,
      allowAutomaticContinuation:
        draft.continuation?.enabled ?? DEFAULT_CONTINUATION_POLICY.enabled,
      allowedActions: ["continue", "approve", "clarify", "reroute", "pair", "hold"],
      stopGates: [
        "destructive_change_requires_review",
        "dependency_change_requires_review",
        "validation_failure_requires_review",
        "low_confidence_reroute_requires_review",
        "approval_or_permission_change_required",
      ],
      queueBudget: {
        maxQueuedActions: maxAutomaticFollowUps,
        maxRuntimeMinutes,
        maxAutoContinuations: maxAutomaticFollowUps,
      },
    },
    sourceScope: draft.riskPolicy.allowNetworkAnalysis
      ? "workspace_graph_and_public_web"
      : "workspace_graph",
    researchPolicy: {
      mode: draft.riskPolicy.allowNetworkAnalysis ? "staged" : "repository_only",
      allowNetworkAnalysis: draft.riskPolicy.allowNetworkAnalysis,
      requireCitations: true,
      allowPrivateContextStage: draft.riskPolicy.allowNetworkAnalysis,
    },
    queueBudget: {
      maxQueuedActions: maxAutomaticFollowUps,
      maxRuntimeMinutes,
      maxAutoContinuations: maxAutomaticFollowUps,
    },
  };
}

export function useAutoDriveController({
  activeWorkspace,
  activeThreadId,
  accessMode,
  selectedModelId,
  selectedEffort,
  preferredBackendIds,
  missionControlProjection,
  runtimeControl,
  onRefreshMissionControl,
  threadCodexParamsVersion,
  getThreadCodexParams,
  patchThreadCodexParams,
  runtimeOverrides,
}: UseAutoDriveControllerOptions) {
  const now = useMemo(() => runtimeOverrides?.now ?? Date.now, [runtimeOverrides?.now]);
  const runtimeProjection = runtimeOverrides?.missionControlProjection ?? missionControlProjection;
  const runtimeControlSource = runtimeOverrides?.runtimeControl ?? runtimeControl;
  const launchTaskThroughRuntimeControl =
    runtimeOverrides?.launchTaskThroughRuntimeControl === true;
  const [draft, setDraft] = useState<AutoDriveControllerHookDraft>(DEFAULT_DRAFT);
  const [busyAction, setBusyAction] = useState<AutoDriveBusyAction | null>(null);
  const [activity, setActivity] = useState<AutoDriveActivityEntry[]>([]);
  const previousRunRef = useRef<AutoDriveRuntimeRunRecord | null>(null);

  const appendActivity = useCallback(
    (nextEntries: AutoDriveActivityEntry | AutoDriveActivityEntry[] | null | undefined) => {
      if (!nextEntries) {
        return;
      }
      const entries = Array.isArray(nextEntries) ? nextEntries : [nextEntries];
      if (entries.length === 0) {
        return;
      }
      setActivity((current) => appendActivityEntries(current, entries));
    },
    []
  );

  const persistDraft = useCallback(
    (next: AutoDriveControllerHookDraft) => {
      if (!activeWorkspace?.id || !activeThreadId) {
        return;
      }
      patchThreadCodexParams(activeWorkspace.id, activeThreadId, { autoDriveDraft: next });
    },
    [activeThreadId, activeWorkspace?.id, patchThreadCodexParams]
  );

  const updateDraft = useCallback(
    (updater: (current: AutoDriveControllerHookDraft) => AutoDriveControllerHookDraft) => {
      setDraft((current) => {
        const next = updater(current);
        persistDraft(next);
        return next;
      });
    },
    [persistDraft]
  );

  useEffect(() => {
    if (!activeWorkspace?.id || !activeThreadId) {
      setDraft(DEFAULT_DRAFT);
      setActivity([]);
      previousRunRef.current = null;
      return;
    }
    void threadCodexParamsVersion;
    const stored = getThreadCodexParams(activeWorkspace.id, activeThreadId)?.autoDriveDraft ?? null;
    setDraft(normalizeDraft(stored));
  }, [activeThreadId, activeWorkspace?.id, getThreadCodexParams, threadCodexParamsVersion]);

  const snapshot = useMemo(
    () =>
      selectAutoDriveSnapshot({
        missionControlProjection: runtimeProjection,
        workspaceId: activeWorkspace?.id ?? null,
        threadId: activeThreadId,
      }),
    [activeThreadId, activeWorkspace?.id, runtimeProjection]
  );

  const run = snapshot.adaptedRun;

  useEffect(() => {
    if (!run) {
      previousRunRef.current = null;
      return;
    }
    const entries = buildRunActivityEntries({
      previousRun: previousRunRef.current,
      nextRun: run,
      now: now(),
    });
    previousRunRef.current = run;
    if (entries.length > 0) {
      setActivity((current) => appendActivityEntries(current, entries));
    }
  }, [now, run]);

  useEffect(() => {
    if (!busyAction) {
      return;
    }
    const status = run?.status ?? null;
    if (!status) {
      return;
    }
    if (
      (busyAction === "starting" && (status === "running" || status === "review_ready")) ||
      (busyAction === "pausing" && (status === "paused" || status === "review_ready")) ||
      (busyAction === "resuming" && (status === "running" || status === "review_ready")) ||
      (busyAction === "stopping" && (status === "cancelled" || status === "review_ready"))
    ) {
      setBusyAction(null);
    }
  }, [busyAction, run?.status]);

  const readiness = useMemo(
    () =>
      buildLaunchReadiness({
        draft,
        hasWorkspace: Boolean(activeWorkspace?.id),
        source: snapshot.source,
      }),
    [activeWorkspace?.id, draft, snapshot.source]
  );
  const activePreset = useMemo(() => resolveActivePresetKey(draft), [draft]);

  const supportsIntervention = typeof runtimeControlSource?.interveneTask === "function";
  const runtimeOnlyControlsEnabled = snapshot.source === "runtime_snapshot_v1";

  const handleStart = useCallback(async () => {
    if (!activeWorkspace?.id || !activeThreadId || !runtimeOnlyControlsEnabled) {
      return;
    }
    if (!readiness.readyToLaunch || !draft.enabled) {
      return;
    }
    const launchControls = buildAgentTaskLaunchControls({
      objective: draft.destination.title.trim() || "AutoDrive mission",
      accessMode,
      preferredBackendIds: preferredBackendIds ?? null,
      autoDriveDraft: draft,
    });

    const autoDrivePayload: AgentTaskAutoDriveState = mapDraftToRuntimeAutoDriveState({
      ...draft,
      budget: {
        maxTokens: sanitizeBudgetValue("maxTokens", draft.budget.maxTokens),
        maxIterations: sanitizeBudgetValue("maxIterations", draft.budget.maxIterations),
        maxDurationMinutes: sanitizeBudgetValue(
          "maxDurationMinutes",
          draft.budget.maxDurationMinutes
        ),
        maxFilesPerIteration: sanitizeBudgetValue(
          "maxFilesPerIteration",
          draft.budget.maxFilesPerIteration
        ),
        maxNoProgressIterations: sanitizeBudgetValue(
          "maxNoProgressIterations",
          draft.budget.maxNoProgressIterations
        ),
        maxValidationFailures: sanitizeBudgetValue(
          "maxValidationFailures",
          draft.budget.maxValidationFailures
        ),
        maxReroutes: sanitizeBudgetValue("maxReroutes", draft.budget.maxReroutes),
      },
    });
    autoDrivePayload.contextPolicy = {
      scope: "workspace_graph",
      authoritySources: ["repo_authority", "workspace_graph"],
    };
    autoDrivePayload.decisionPolicy = {
      independentThread: true,
      autonomyPriority: "operator",
      promptStrategy: "workspace_graph_first",
      researchMode: draft.riskPolicy.allowNetworkAnalysis ? "live_when_allowed" : "repository_only",
    };
    autoDrivePayload.continuationPolicy = {
      enabled: draft.continuation?.enabled ?? DEFAULT_CONTINUATION_POLICY.enabled,
      maxAutomaticFollowUps:
        draft.continuation?.maxAutomaticFollowUps ??
        DEFAULT_CONTINUATION_POLICY.maxAutomaticFollowUps,
      requireValidationSuccessToStop:
        draft.continuation?.requireValidationSuccessToStop ??
        DEFAULT_CONTINUATION_POLICY.requireValidationSuccessToStop,
      minimumConfidenceToStop:
        draft.continuation?.minimumConfidenceToStop ??
        DEFAULT_CONTINUATION_POLICY.minimumConfidenceToStop,
    };
    const autonomyRequest = buildNightOperatorAutonomyRequest(draft);
    const launchInstruction = buildAutoDriveInstruction(draft, launchControls);

    setBusyAction("starting");
    appendActivity({
      id: `control:start:${now()}`,
      kind: "control",
      title: "Start requested",
      detail: `Dispatching an AutoDrive route through the active thread toward ${draft.destination.title.trim() || "the destination"}.`,
      iteration: run?.iteration ?? 0,
      timestamp: now(),
    });

    try {
      void trackProductAnalyticsEvent("delegate_started", {
        workspaceId: activeWorkspace.id,
        threadId: activeThreadId,
        executionProfileId: snapshot.run?.executionProfile?.id ?? null,
        backendId: preferredBackendIds?.[0] ?? null,
        runState: run?.status ?? null,
        requestMode: "start",
        eventSource: "auto_drive",
      });
      if (launchTaskThroughRuntimeControl && runtimeControlSource?.startTask) {
        await runtimeControlSource.startTask({
          workspaceId: activeWorkspace.id,
          threadId: activeThreadId,
          title: draft.destination.title.trim() || "AutoDrive mission",
          instruction: launchInstruction,
          accessMode,
          executionMode: "runtime",
          reasonEffort: normalizeReasonEffort(selectedEffort),
          modelId: selectedModelId,
          preferredBackendIds: preferredBackendIds ?? null,
          autoDrive: autoDrivePayload,
        });
      } else {
        await launchAutoDriveThread({
          workspaceId: activeWorkspace.id,
          threadId: activeThreadId,
          instruction: launchInstruction,
          accessMode,
          modelId: selectedModelId,
          reasonEffort: normalizeReasonEffort(selectedEffort),
          preferredBackendIds: preferredBackendIds ?? null,
          autoDrive: autoDrivePayload,
          autonomyRequest,
        });
      }
      await onRefreshMissionControl?.();
    } finally {
      setBusyAction(null);
    }
  }, [
    accessMode,
    activeThreadId,
    activeWorkspace?.id,
    appendActivity,
    draft,
    now,
    onRefreshMissionControl,
    preferredBackendIds,
    readiness.readyToLaunch,
    run?.iteration,
    runtimeControlSource,
    launchTaskThroughRuntimeControl,
    runtimeOnlyControlsEnabled,
    selectedEffort,
    selectedModelId,
  ]);

  const runTaskId = snapshot.runtimeTaskId;

  const handleIntervene = useCallback(
    async (action: "pause" | "resume" | "cancel", busy: AutoDriveBusyAction, detail: string) => {
      if (!runTaskId || !runtimeOnlyControlsEnabled || !supportsIntervention) {
        return;
      }
      setBusyAction(busy);
      appendActivity({
        id: `control:${action}:${now()}`,
        kind: "control",
        title: `${action.charAt(0).toUpperCase()}${action.slice(1)} requested`,
        detail,
        iteration: run?.iteration ?? null,
        timestamp: now(),
      });
      try {
        void trackProductAnalyticsEvent("manual_rescue_invoked", {
          workspaceId: activeWorkspace?.id ?? null,
          threadId: activeThreadId,
          runId: runTaskId,
          interventionKind: action,
          runState: run?.status ?? null,
          eventSource: "auto_drive",
        });
        await runtimeControlSource.interveneTask?.({
          taskId: runTaskId,
          action,
          reason: `auto_drive_${action}`,
        });
        await onRefreshMissionControl?.();
      } finally {
        setBusyAction(null);
      }
    },
    [
      appendActivity,
      now,
      onRefreshMissionControl,
      run?.iteration,
      runTaskId,
      runtimeControlSource,
      runtimeOnlyControlsEnabled,
      supportsIntervention,
    ]
  );

  const handlePause = useCallback(
    async () =>
      handleIntervene(
        "pause",
        "pausing",
        "Operator asked AutoDrive to yield control after the active waypoint handoff."
      ),
    [handleIntervene]
  );

  const handleResume = useCallback(
    async () =>
      handleIntervene(
        "resume",
        "resuming",
        "Operator asked AutoDrive to continue from the current route state."
      ),
    [handleIntervene]
  );

  const handleStop = useCallback(
    async () =>
      handleIntervene(
        "cancel",
        "stopping",
        "Operator asked AutoDrive to cancel the active route safely."
      ),
    [handleIntervene]
  );

  return {
    enabled: draft.enabled,
    draft,
    activity,
    recovering: snapshot.recovering,
    recoverySummary: snapshot.recoverySummary,
    run,
    setEnabled: (enabled: boolean) =>
      updateDraft((current) => ({
        ...current,
        enabled,
      })),
    setDestinationValue: (
      key: keyof AutoDriveControllerHookDraft["destination"],
      value: string | AutoDriveRoutePreference
    ) =>
      updateDraft((current) => ({
        ...current,
        destination: {
          ...current.destination,
          [key]: value,
        },
      })),
    setBudgetValue: (key: keyof AutoDriveControllerHookDraft["budget"], value: number) =>
      updateDraft((current) => ({
        ...current,
        budget: {
          ...current.budget,
          [key]: normalizeBudgetDraftValue(current.budget[key], value),
        },
      })),
    setRiskPolicyValue: (key: keyof AutoDriveRiskPolicy, value: boolean | AutoDriveConfidence) =>
      updateDraft((current) => ({
        ...current,
        riskPolicy: {
          ...current.riskPolicy,
          [key]: value,
        },
      })),
    preset: {
      active: activePreset,
      apply: (key: AutoDrivePresetKey) =>
        updateDraft((current) => {
          const preset = AUTO_DRIVE_PRESETS[key];
          return {
            ...current,
            destination: {
              ...current.destination,
              routePreference: preset.routePreference,
            },
            budget: preset.budget,
            riskPolicy: preset.riskPolicy,
          };
        }),
    },
    controls: {
      canStart: canStartAutoDriveRun({
        enabled: draft.enabled,
        hasWorkspace: Boolean(activeWorkspace?.id),
        hasThread: Boolean(activeThreadId),
        readyToLaunch: readiness.readyToLaunch,
        source: snapshot.source,
        runStatus: run?.status ?? null,
        busyAction,
      }),
      canPause:
        runtimeOnlyControlsEnabled &&
        supportsIntervention &&
        run?.status === "running" &&
        busyAction === null,
      canResume:
        runtimeOnlyControlsEnabled &&
        supportsIntervention &&
        run?.status === "paused" &&
        busyAction === null,
      canStop:
        runtimeOnlyControlsEnabled &&
        supportsIntervention &&
        (run?.status === "running" || run?.status === "paused") &&
        busyAction === null,
      busyAction,
      onStart: handleStart,
      onPause: handlePause,
      onResume: handleResume,
      onStop: handleStop,
    },
    readiness: {
      ...readiness,
      warnings: readiness.warnings,
    },
  };
}
