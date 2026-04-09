import type {
  HugeCodeMissionControlSnapshot,
  RuntimeAutonomyRequestV2,
} from "@ku0/code-runtime-host-contract";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";
import type { AutoDriveRuntimeRunRecord } from "./autoDriveRuntimeSnapshotAdapter";
import { DEFAULT_CONTINUATION_POLICY, sanitizeBudgetValue } from "./autoDriveDraftState";

export type AutoDriveBusyAction = "starting" | "pausing" | "resuming" | "stopping";

export function buildAutoDriveInstruction(
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

export function canStartAutoDriveRun(params: {
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

export function normalizeReasonEffort(
  value: string | null
): "low" | "medium" | "high" | "xhigh" | null {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return null;
}

export function buildNightOperatorAutonomyRequest(
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
