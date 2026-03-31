import type {
  AccessMode,
  AgentTaskRelaunchContext,
  AgentTaskSourceSummary,
  HugeCodeExecutionProfile,
  RuntimeAutonomyRequestV2,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
  RuntimeRunStartV2Response,
} from "@ku0/code-runtime-host-contract";
import { prepareRuntimeRunV2, startRuntimeRunV2 } from "../ports/runtimeJobs";
import {
  buildAgentTaskLaunchControls,
  buildAgentTaskMissionBrief,
} from "./runtimeMissionDraftFacade";
import { listRunExecutionProfiles } from "./runtimeMissionControlExecutionProfiles";
import {
  type RepositoryExecutionContract,
  type RepositoryExecutionExplicitLaunchInput,
} from "./runtimeRepositoryExecutionContract";
import { resolveRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionDefaults";

export type GovernedRuntimeSourceSummary = {
  title: string;
  instruction: string;
  taskSource: AgentTaskSourceSummary;
  autonomyRequest?: RuntimeAutonomyRequestV2 | null;
  missionConstraints?: string[] | null;
  relaunchContext?: AgentTaskRelaunchContext | null;
};

export type BuildGovernedRuntimeRunRequestInput = {
  workspaceId: string;
  source: GovernedRuntimeSourceSummary;
  repositoryExecutionContract?: RepositoryExecutionContract | null;
  explicitLaunchInput?: RepositoryExecutionExplicitLaunchInput;
  fallbackExecutionProfileId?: string | null;
  fallbackValidationPresetId?: string | null;
  fallbackAccessMode?: AccessMode | null;
  provider?: string | null;
};

export type GovernedRuntimeRunLaunchAck = {
  preparation: RuntimeRunPrepareV2Response;
  response: RuntimeRunStartV2Response;
  request: RuntimeRunPrepareV2Request;
};

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTextList(value: readonly string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of value) {
    const normalized = readOptionalText(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    values.push(normalized);
  }
  return values.length > 0 ? values : undefined;
}

function resolveExecutionProfile(profileId: string | null | undefined): HugeCodeExecutionProfile {
  const normalizedProfileId = readOptionalText(profileId);
  return (
    listRunExecutionProfiles().find((profile) => profile.id === normalizedProfileId) ??
    listRunExecutionProfiles().find((profile) => profile.id === "balanced-delegate") ??
    listRunExecutionProfiles()[0]
  );
}

function mapExecutionProfileModeToTaskMode(
  value: HugeCodeExecutionProfile["executionMode"]
): "single" | "distributed" {
  return value === "remote_sandbox" ? "distributed" : "single";
}

export function buildGovernedRuntimeRunRequest(
  input: BuildGovernedRuntimeRunRequestInput
): RuntimeRunPrepareV2Request | null {
  const instruction = input.source.instruction.trim();
  if (instruction.length === 0) {
    return null;
  }

  const resolvedDefaults = resolveRepositoryExecutionDefaults({
    contract: input.repositoryExecutionContract ?? null,
    taskSource: input.source.taskSource,
    explicitLaunchInput: input.explicitLaunchInput,
  });
  const selectedExecutionProfile = resolveExecutionProfile(
    resolvedDefaults.executionProfileId ?? input.fallbackExecutionProfileId
  );
  const accessMode =
    resolvedDefaults.accessMode ?? input.fallbackAccessMode ?? selectedExecutionProfile.accessMode;
  const preferredBackendIds = normalizeTextList(resolvedDefaults.preferredBackendIds);
  const validationPresetId =
    resolvedDefaults.validationPresetId ?? readOptionalText(input.fallbackValidationPresetId);
  const objective = readOptionalText(input.source.title) ?? instruction;
  const missionConstraints = normalizeTextList(input.source.missionConstraints);
  const launchControls = buildAgentTaskLaunchControls({
    objective,
    accessMode,
    preferredBackendIds,
    constraints: missionConstraints ?? null,
  });

  return {
    workspaceId: input.workspaceId,
    ...(readOptionalText(input.source.title) ? { title: objective } : {}),
    taskSource: input.source.taskSource,
    executionProfileId: selectedExecutionProfile.id,
    ...(resolvedDefaults.reviewProfileId
      ? { reviewProfileId: resolvedDefaults.reviewProfileId }
      : {}),
    ...(validationPresetId ? { validationPresetId } : {}),
    ...(readOptionalText(input.provider) ? { provider: readOptionalText(input.provider) } : {}),
    accessMode,
    executionMode: mapExecutionProfileModeToTaskMode(selectedExecutionProfile.executionMode),
    ...(launchControls.requiredCapabilities
      ? { requiredCapabilities: launchControls.requiredCapabilities }
      : {}),
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    ...(readOptionalText(resolvedDefaults.defaultBackendId)
      ? { defaultBackendId: readOptionalText(resolvedDefaults.defaultBackendId) }
      : {}),
    missionBrief: buildAgentTaskMissionBrief({
      objective,
      accessMode,
      preferredBackendIds,
      constraints: missionConstraints ?? null,
      requiredCapabilities: launchControls.requiredCapabilities,
      maxSubtasks: launchControls.maxSubtasks,
      allowNetwork: input.source.autonomyRequest?.researchPolicy.allowNetworkAnalysis ?? null,
    }),
    ...(input.source.autonomyRequest ? { autonomyRequest: input.source.autonomyRequest } : {}),
    ...(input.source.relaunchContext ? { relaunchContext: input.source.relaunchContext } : {}),
    steps: [
      {
        kind: "read",
        input: instruction,
      },
    ],
  };
}

export async function launchGovernedRuntimeRun(input: {
  request: RuntimeRunPrepareV2Request;
  onRefresh?: (() => void | Promise<void>) | null;
}): Promise<GovernedRuntimeRunLaunchAck> {
  const preparation = await prepareRuntimeRunV2(input.request);
  const response = await startRuntimeRunV2(input.request);
  await input.onRefresh?.();
  return {
    preparation,
    response,
    request: input.request,
  };
}
