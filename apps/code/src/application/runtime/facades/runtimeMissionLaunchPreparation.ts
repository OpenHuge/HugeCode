import { useEffect, useMemo, useState } from "react";
import type {
  AgentTaskExecutionMode,
  AgentTaskSourceSummary,
  HugeCodeExecutionProfile,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
} from "@ku0/code-runtime-host-contract";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { prepareRuntimeRunV2 } from "../ports/tauriRuntimeJobs";
import {
  buildAgentTaskLaunchControls,
  buildAgentTaskMissionBrief,
} from "./runtimeMissionDraftFacade";
import type { ResolvedRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionContract";
import type { RuntimeTaskLauncherSourceDraft } from "./runtimeTaskInterventionDraftFacade";
import {
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeGuidanceStack,
} from "./runtimeContextTruth";

export type RuntimeMissionLaunchRequestInput = {
  workspaceId: string;
  draftTitle: string;
  draftInstruction: string;
  selectedExecutionProfile: HugeCodeExecutionProfile;
  repositoryLaunchDefaults: ResolvedRepositoryExecutionDefaults;
  runtimeSourceDraft?: RuntimeTaskLauncherSourceDraft | null;
  routedProvider?: string | null;
};

export type RuntimeMissionLaunchPreviewState = {
  request: RuntimeRunPrepareV2Request | null;
  preparation: RuntimeRunPrepareV2Response | null;
  contextTruth: RuntimeRunPrepareV2Response["contextTruth"] | null;
  guidanceStack: RuntimeRunPrepareV2Response["guidanceStack"] | null;
  delegationContract: RuntimeRunPrepareV2Response["delegationContract"] | null;
  truthSourceLabel: string | null;
  loading: boolean;
  error: string | null;
};

function readOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBackendIds(value: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
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
  return ids.length > 0 ? ids : undefined;
}

function buildWorkspaceLaunchTaskSource(input: {
  draftTitle: string;
  draftInstruction: string;
}): AgentTaskSourceSummary {
  return {
    kind: "manual",
    title: input.draftTitle.trim() || input.draftInstruction.trim() || "Mission run",
  };
}

function mapExecutionProfileModeToTaskMode(
  value: HugeCodeExecutionProfile["executionMode"]
): AgentTaskExecutionMode {
  return value === "remote_sandbox" ? "distributed" : "single";
}

export function buildRuntimeMissionLaunchPrepareRequest(
  input: RuntimeMissionLaunchRequestInput
): RuntimeRunPrepareV2Request | null {
  const instruction = input.draftInstruction.trim();
  if (instruction.length === 0) {
    return null;
  }

  const title = readOptionalText(input.draftTitle);
  const accessMode =
    input.runtimeSourceDraft?.accessMode ??
    input.repositoryLaunchDefaults.accessMode ??
    input.selectedExecutionProfile.accessMode;
  const preferredBackendIds =
    normalizeBackendIds(input.runtimeSourceDraft?.preferredBackendIds) ??
    normalizeBackendIds(input.repositoryLaunchDefaults.preferredBackendIds);
  const executionProfileId =
    readOptionalText(input.runtimeSourceDraft?.profileId) ?? input.selectedExecutionProfile.id;
  const validationPresetId =
    readOptionalText(input.runtimeSourceDraft?.validationPresetId) ??
    readOptionalText(input.repositoryLaunchDefaults.validationPresetId) ??
    readOptionalText(input.selectedExecutionProfile.validationPresetId);
  const reviewProfileId =
    readOptionalText(input.runtimeSourceDraft?.reviewProfileId) ??
    readOptionalText(input.repositoryLaunchDefaults.reviewProfileId);
  const objective = title ?? instruction;
  const launchControls = buildAgentTaskLaunchControls({
    objective,
    accessMode,
  });

  return {
    workspaceId: input.workspaceId,
    ...(title ? { title } : {}),
    taskSource:
      input.runtimeSourceDraft?.taskSource ??
      buildWorkspaceLaunchTaskSource({
        draftTitle: input.draftTitle,
        draftInstruction: input.draftInstruction,
      }),
    executionProfileId,
    ...(reviewProfileId ? { reviewProfileId } : {}),
    ...(validationPresetId ? { validationPresetId } : {}),
    ...(readOptionalText(input.routedProvider) ? { provider: input.routedProvider } : {}),
    accessMode,
    executionMode: mapExecutionProfileModeToTaskMode(input.selectedExecutionProfile.executionMode),
    ...(launchControls.requiredCapabilities
      ? { requiredCapabilities: launchControls.requiredCapabilities }
      : {}),
    ...(preferredBackendIds ? { preferredBackendIds } : {}),
    missionBrief: buildAgentTaskMissionBrief({
      objective,
      accessMode,
      preferredBackendIds,
      requiredCapabilities: launchControls.requiredCapabilities,
      maxSubtasks: launchControls.maxSubtasks,
    }),
    ...(input.runtimeSourceDraft?.relaunchContext
      ? { relaunchContext: input.runtimeSourceDraft.relaunchContext }
      : {}),
    steps: [
      {
        kind: "read",
        input: instruction,
      },
    ],
  };
}

export function useRuntimeMissionLaunchPreview(
  input: RuntimeMissionLaunchRequestInput
): RuntimeMissionLaunchPreviewState {
  const request = useMemo(
    () => buildRuntimeMissionLaunchPrepareRequest(input),
    [
      input.draftInstruction,
      input.draftTitle,
      input.repositoryLaunchDefaults,
      input.routedProvider,
      input.runtimeSourceDraft,
      input.selectedExecutionProfile,
      input.workspaceId,
    ]
  );
  const debouncedRequest = useDebouncedValue(request, 250);
  const [preparation, setPreparation] = useState<RuntimeRunPrepareV2Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debouncedRequest) {
      setPreparation(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void prepareRuntimeRunV2(debouncedRequest)
      .then((nextPreparation) => {
        if (cancelled) {
          return;
        }
        setPreparation(nextPreparation);
        setError(null);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setPreparation(null);
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedRequest]);

  const contextTruth = useMemo(() => {
    if (preparation?.contextTruth) {
      return preparation.contextTruth;
    }
    if (!request) {
      return null;
    }
    return buildRuntimeContextTruth({
      taskSource: request.taskSource ?? null,
      repositoryDefaults: input.repositoryLaunchDefaults,
      contractLabel: input.repositoryLaunchDefaults.contract?.metadata?.label ?? null,
      hasRepoInstructions: true,
      explicitInstruction: input.draftInstruction,
    });
  }, [input.draftInstruction, input.repositoryLaunchDefaults, preparation, request]);

  const guidanceStack = useMemo(() => {
    if (preparation?.guidanceStack) {
      return preparation.guidanceStack;
    }
    if (!request) {
      return null;
    }
    return buildRuntimeGuidanceStack({
      taskSource: request.taskSource ?? null,
      repositoryDefaults: input.repositoryLaunchDefaults,
      contractLabel: input.repositoryLaunchDefaults.contract?.metadata?.label ?? null,
      hasRepoInstructions: true,
      explicitInstruction: input.draftInstruction,
    });
  }, [input.draftInstruction, input.repositoryLaunchDefaults, preparation, request]);

  const delegationContract = useMemo(() => {
    if (preparation?.delegationContract) {
      return preparation.delegationContract;
    }
    if (!contextTruth) {
      return null;
    }
    return buildRuntimeDelegationContract({
      contextTruth,
      missingContext:
        preparation?.runIntent.missingContext ?? request?.missionBrief?.constraints ?? [],
      approvalBatchCount: preparation?.approvalBatches.length ?? 0,
    });
  }, [contextTruth, preparation, request]);

  return {
    request,
    preparation,
    contextTruth,
    guidanceStack,
    delegationContract,
    truthSourceLabel: preparation ? "Runtime kernel v2 prepare" : null,
    loading,
    error,
  };
}
