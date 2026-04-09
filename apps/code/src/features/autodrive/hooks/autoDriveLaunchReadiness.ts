import type { HugeCodeMissionControlSnapshot } from "@ku0/code-runtime-host-contract";
import type { AutoDriveControllerHookDraft } from "../../../application/runtime/types/autoDrive";

export type AutoDriveLaunchChecklistItem = {
  label: string;
  complete: boolean;
};

export function buildLaunchReadiness(params: {
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
