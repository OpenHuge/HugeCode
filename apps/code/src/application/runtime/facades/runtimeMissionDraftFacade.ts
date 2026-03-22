import type {
  AgentTaskMissionBrief,
  AgentTaskMissionRiskLevel,
  AgentTaskPermissionSummary,
  HugeCodeTaskSourceSummary,
  HugeCodeTaskMode,
} from "@ku0/code-runtime-host-contract";
import type { AutoDriveControllerHookDraft } from "../types/autoDrive";
import type { AccessMode } from "../../../types";

export type MissionDraft = {
  objective: string;
  taskSource?: HugeCodeTaskSourceSummary | null;
  mode: HugeCodeTaskMode;
  executionProfileId: string | null;
  preferredBackendIds: string[] | null;
  validationIntent: string | null;
  autoDrive: AutoDriveControllerHookDraft | null;
  constraints: string[];
  avoid: string[];
  doneDefinition: string[];
};

export type BuildAgentTaskMissionBriefInput = {
  objective: string;
  accessMode?: AccessMode | null;
  preferredBackendIds?: string[] | null;
  doneDefinition?: string[] | null;
  constraints?: string[] | null;
  requiredCapabilities?: string[] | null;
  maxSubtasks?: number | null;
  riskLevel?: AgentTaskMissionRiskLevel | null;
  allowNetwork?: boolean | null;
  writableRoots?: string[] | null;
  toolNames?: string[] | null;
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
};

export type AgentTaskLaunchControls = {
  requiredCapabilities: string[] | null;
  maxSubtasks: number | null;
};

type InferMissionDraftModeInput = {
  accessMode?: AccessMode | null;
  collaborationModeId?: string | null;
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalTextList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }
  return items.length > 0 ? items : null;
}

function inferMissionRiskLevel(input: BuildAgentTaskMissionBriefInput): AgentTaskMissionRiskLevel {
  if (input.riskLevel) {
    return input.riskLevel;
  }
  if (input.accessMode === "full-access") {
    return "high";
  }
  if (input.autoDriveDraft?.enabled || input.accessMode === "on-request") {
    return "medium";
  }
  return "low";
}

function inferLaunchRequiredCapabilities(input: BuildAgentTaskMissionBriefInput): string[] | null {
  const explicit = normalizeOptionalTextList(input.requiredCapabilities);
  if (explicit) {
    return explicit;
  }
  if (!input.autoDriveDraft?.enabled) {
    return null;
  }
  const inferred = ["code"];
  const routePreference = input.autoDriveDraft.destination.routePreference;
  const allowValidationCommands = input.autoDriveDraft.riskPolicy.allowValidationCommands;
  if (allowValidationCommands || routePreference === "validation_first") {
    inferred.push("validation");
  }
  if (
    input.accessMode !== "full-access" ||
    routePreference === "validation_first" ||
    input.autoDriveDraft.riskPolicy.minimumConfidence !== "low"
  ) {
    inferred.push("review");
  }
  if (input.autoDriveDraft.riskPolicy.allowNetworkAnalysis) {
    inferred.push("research");
  }
  return inferred;
}

function inferLaunchMaxSubtasks(input: BuildAgentTaskMissionBriefInput): number | null {
  if (typeof input.maxSubtasks === "number" && Number.isFinite(input.maxSubtasks)) {
    return input.maxSubtasks;
  }
  if (!input.autoDriveDraft?.enabled) {
    return null;
  }
  if (input.accessMode === "full-access") {
    return 3;
  }
  return 2;
}

function buildMissionPermissionSummary(
  input: BuildAgentTaskMissionBriefInput
): AgentTaskPermissionSummary | null {
  const writableRoots = normalizeOptionalTextList(input.writableRoots);
  const toolNames = normalizeOptionalTextList(input.toolNames);
  const allowNetwork =
    typeof input.allowNetwork === "boolean"
      ? input.allowNetwork
      : typeof input.autoDriveDraft?.riskPolicy?.allowNetworkAnalysis === "boolean"
        ? input.autoDriveDraft.riskPolicy.allowNetworkAnalysis
        : null;

  if (
    input.accessMode == null &&
    allowNetwork === null &&
    writableRoots === null &&
    toolNames === null
  ) {
    return null;
  }

  return {
    accessMode: input.accessMode ?? null,
    allowNetwork,
    writableRoots,
    toolNames,
  };
}

export function normalizePreferredBackendIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids.length > 0 ? ids : null;
}

export function buildAgentTaskLaunchControls(
  input: BuildAgentTaskMissionBriefInput
): AgentTaskLaunchControls {
  return {
    requiredCapabilities: inferLaunchRequiredCapabilities(input),
    maxSubtasks: inferLaunchMaxSubtasks(input),
  };
}

export function inferMissionDraftMode(input: InferMissionDraftModeInput): HugeCodeTaskMode {
  if (input.autoDriveDraft?.enabled) {
    return "delegate";
  }
  if (readOptionalText(input.collaborationModeId)) {
    return "pair";
  }
  switch (input.accessMode) {
    case "read-only":
      return "ask";
    case "full-access":
      return "delegate";
    case "on-request":
    default:
      return "pair";
  }
}

export function buildMissionDraftFromThreadState(input: {
  objective: string;
  taskSource?: HugeCodeTaskSourceSummary | null;
  accessMode?: AccessMode | null;
  collaborationModeId?: string | null;
  executionProfileId?: string | null;
  preferredBackendIds?: string[] | null;
  autoDriveDraft?: AutoDriveControllerHookDraft | null;
  validationIntent?: string | null;
}): MissionDraft {
  const autoDrive = input.autoDriveDraft ?? null;
  const avoidText = readOptionalText(autoDrive?.destination.avoid) ?? null;
  const doneDefinitionText = readOptionalText(autoDrive?.destination.doneDefinition) ?? null;
  return {
    objective: input.objective,
    taskSource: input.taskSource ?? null,
    mode: inferMissionDraftMode(input),
    executionProfileId: readOptionalText(input.executionProfileId),
    preferredBackendIds: normalizePreferredBackendIds(input.preferredBackendIds),
    validationIntent: readOptionalText(input.validationIntent),
    autoDrive,
    constraints: avoidText ? [avoidText] : [],
    avoid: avoidText ? [avoidText] : [],
    doneDefinition: doneDefinitionText ? [doneDefinitionText] : [],
  };
}

export function buildAgentTaskMissionBrief(
  input: BuildAgentTaskMissionBriefInput
): AgentTaskMissionBrief {
  const autoDriveDoneDefinition = readOptionalText(
    input.autoDriveDraft?.destination.doneDefinition
  );
  const autoDriveConstraint = readOptionalText(input.autoDriveDraft?.destination.avoid);
  const doneDefinition =
    normalizeOptionalTextList(input.doneDefinition) ??
    (autoDriveDoneDefinition ? [autoDriveDoneDefinition] : null);
  const constraints =
    normalizeOptionalTextList(input.constraints) ??
    (autoDriveConstraint ? [autoDriveConstraint] : null);
  const launchControls = buildAgentTaskLaunchControls(input);
  const preferredBackendIds = normalizePreferredBackendIds(input.preferredBackendIds);
  const permissionSummary = buildMissionPermissionSummary(input);

  return {
    objective: input.objective,
    doneDefinition,
    constraints,
    riskLevel: inferMissionRiskLevel(input),
    requiredCapabilities: launchControls.requiredCapabilities,
    maxSubtasks: launchControls.maxSubtasks,
    preferredBackendIds,
    permissionSummary,
  };
}

export function toTurnSendMissionMetadata(draft: MissionDraft): {
  missionMode: HugeCodeTaskMode;
  executionProfileId: string | null;
  preferredBackendIds: string[] | null;
} {
  return {
    missionMode: draft.mode,
    executionProfileId: draft.executionProfileId,
    preferredBackendIds: draft.preferredBackendIds,
  };
}
