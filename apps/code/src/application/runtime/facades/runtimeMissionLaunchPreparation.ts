import { useEffect, useMemo, useState } from "react";
import type {
  HugeCodeExecutionProfile,
  RuntimeRunPrepareV2Request,
  RuntimeRunPrepareV2Response,
} from "@ku0/code-runtime-host-contract";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { prepareRuntimeRunV2 } from "../ports/runtimeJobs";
import type { ResolvedRepositoryExecutionDefaults } from "./runtimeRepositoryExecutionContract";
import { buildGovernedRuntimeRunRequest } from "./runtimeGovernedRunIngestion";
import { normalizeTaskSourceDraft } from "./runtimeTaskSourceFacade";
import type { RuntimeTaskLauncherSourceDraft } from "./runtimeTaskInterventionDraftFacade";
import {
  buildRuntimeContextPlane,
  buildRuntimeContextTruth,
  buildRuntimeDelegationContract,
  buildRuntimeEvalPlane,
  buildRuntimeGuidanceStack,
  buildRuntimeToolingPlane,
  buildRuntimeTriageSummary,
} from "./runtimeContextTruth";

export type RuntimeMissionLaunchRequestInput = {
  workspaceId: string;
  draftTitle: string;
  draftInstruction: string;
  selectedExecutionProfile: HugeCodeExecutionProfile;
  repositoryLaunchDefaults: ResolvedRepositoryExecutionDefaults;
  runtimeSourceDraft?: RuntimeTaskLauncherSourceDraft | null;
  routedProvider?: string | null;
  preferredBackendIds?: string[] | null;
  defaultBackendId?: string | null;
};

export type RuntimeMissionLaunchPreviewState = {
  request: RuntimeRunPrepareV2Request | null;
  preparation: RuntimeRunPrepareV2Response | null;
  contextTruth: RuntimeRunPrepareV2Response["contextTruth"] | null;
  contextPlane: RuntimeRunPrepareV2Response["contextPlane"] | null;
  toolingPlane: RuntimeRunPrepareV2Response["toolingPlane"] | null;
  evalPlane: RuntimeRunPrepareV2Response["evalPlane"] | null;
  guidanceStack: RuntimeRunPrepareV2Response["guidanceStack"] | null;
  triageSummary: RuntimeRunPrepareV2Response["triageSummary"] | null;
  delegationContract: RuntimeRunPrepareV2Response["delegationContract"] | null;
  repoGuidanceSummary: string | null;
  truthSourceLabel: string | null;
  loading: boolean;
  error: string | null;
};

export { buildRuntimeRunStartRequestFromPreparation } from "./runtimeRunStartRequest";

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

function formatRepoInstructionDetail(detail: string | null | undefined): string | null {
  const normalized = readOptionalText(detail);
  if (!normalized) {
    return null;
  }
  const prefix = "Runtime detected ";
  const suffix = " as hot repo guidance surfaces.";
  if (normalized.startsWith(prefix) && normalized.endsWith(suffix)) {
    return `Repo guidance: ${normalized.slice(prefix.length, normalized.length - suffix.length)}`;
  }
  return normalized;
}

function summarizeLaunchPreparationRepoGuidance(
  preparation: RuntimeRunPrepareV2Response | null,
  guidanceStack: RuntimeRunPrepareV2Response["guidanceStack"] | null
): string | null {
  const workingSetSummary = preparation?.contextWorkingSet.layers
    .flatMap((layer) => layer.entries)
    .find((entry) => entry.id === "repo-instruction-surfaces");
  const detailedSummary = formatRepoInstructionDetail(workingSetSummary?.detail);
  if (detailedSummary) {
    return detailedSummary;
  }

  const repoLayer = guidanceStack?.layers.find((layer) => layer.scope === "repo") ?? null;
  if (!repoLayer) {
    return null;
  }
  const sourceLabel =
    repoLayer.source.trim().length > 0 && repoLayer.source !== "repo_guidance"
      ? repoLayer.source
      : "repository instruction surfaces";
  return `Repo guidance: ${sourceLabel}`;
}

export function buildRuntimeMissionLaunchPrepareRequest(
  input: RuntimeMissionLaunchRequestInput
): RuntimeRunPrepareV2Request | null {
  const title = readOptionalText(input.draftTitle);
  const draftInstructionTitle = input.draftInstruction.trim();
  const fallbackTitle = title ?? (draftInstructionTitle || "Mission run");
  const taskSource = normalizeTaskSourceDraft(input.runtimeSourceDraft?.taskSource, {
    title: fallbackTitle,
    workspaceId: input.workspaceId,
  });
  return buildGovernedRuntimeRunRequest({
    workspaceId: input.workspaceId,
    source: {
      title: fallbackTitle,
      instruction: input.draftInstruction,
      taskSource,
      relaunchContext: input.runtimeSourceDraft?.relaunchContext ?? null,
    },
    repositoryExecutionContract: input.repositoryLaunchDefaults.contract,
    explicitLaunchInput: {
      executionProfileId:
        readOptionalText(input.runtimeSourceDraft?.profileId) ?? input.selectedExecutionProfile.id,
      preferredBackendIds: normalizeBackendIds(
        input.runtimeSourceDraft?.preferredBackendIds ?? input.preferredBackendIds
      ),
      defaultBackendId: readOptionalText(input.defaultBackendId),
      accessMode: input.runtimeSourceDraft?.accessMode ?? null,
      reviewProfileId: readOptionalText(input.runtimeSourceDraft?.reviewProfileId),
      validationPresetId: readOptionalText(input.runtimeSourceDraft?.validationPresetId),
    },
    fallbackExecutionProfileId: input.selectedExecutionProfile.id,
    fallbackValidationPresetId: input.selectedExecutionProfile.validationPresetId,
    fallbackAccessMode: input.selectedExecutionProfile.accessMode,
    provider: input.routedProvider,
  });
}

export function useRuntimeMissionLaunchPreview(
  input: RuntimeMissionLaunchRequestInput
): RuntimeMissionLaunchPreviewState {
  const request = useMemo(
    () => buildRuntimeMissionLaunchPrepareRequest(input),
    [
      input.draftInstruction,
      input.draftTitle,
      input.defaultBackendId,
      input.preferredBackendIds,
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

  const contextPlane = useMemo(() => {
    if (preparation?.contextPlane) {
      return preparation.contextPlane;
    }
    if (!request) {
      return null;
    }
    return buildRuntimeContextPlane({
      taskSource: request.taskSource ?? null,
      repositoryDefaults: input.repositoryLaunchDefaults,
      contractLabel: input.repositoryLaunchDefaults.contract?.metadata?.label ?? null,
      hasRepoInstructions: true,
      explicitInstruction: input.draftInstruction,
    });
  }, [input.draftInstruction, input.repositoryLaunchDefaults, preparation, request]);

  const toolingPlane = useMemo(() => {
    if (preparation?.toolingPlane) {
      return preparation.toolingPlane;
    }
    if (!request) {
      return null;
    }
    return buildRuntimeToolingPlane({
      selectedExecutionProfile: input.selectedExecutionProfile,
      preferredBackendIds: request.preferredBackendIds ?? input.preferredBackendIds ?? null,
      routedProvider: input.routedProvider,
      reviewProfileId: request.reviewProfileId ?? null,
      validationPresetId: request.validationPresetId ?? null,
    });
  }, [
    input.preferredBackendIds,
    input.routedProvider,
    input.selectedExecutionProfile,
    preparation,
    request,
  ]);

  const evalPlane = useMemo(() => {
    if (preparation?.evalPlane) {
      return preparation.evalPlane;
    }
    if (!request) {
      return null;
    }
    return buildRuntimeEvalPlane({
      taskSource: request.taskSource ?? null,
      repositoryDefaults: input.repositoryLaunchDefaults,
      selectedExecutionProfile: input.selectedExecutionProfile,
      reviewProfileId: request.reviewProfileId ?? null,
      validationPresetId: request.validationPresetId ?? null,
    });
  }, [input.repositoryLaunchDefaults, input.selectedExecutionProfile, preparation, request]);

  const triageSummary = useMemo(() => {
    if (preparation?.triageSummary) {
      return preparation.triageSummary;
    }
    if (!request) {
      return null;
    }
    return buildRuntimeTriageSummary({
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
      triageSummary,
      missingContext:
        preparation?.runIntent.missingContext ?? request?.missionBrief?.constraints ?? [],
      approvalBatchCount: preparation?.approvalBatches.length ?? 0,
    });
  }, [contextTruth, preparation, request, triageSummary]);

  const repoGuidanceSummary = useMemo(
    () => summarizeLaunchPreparationRepoGuidance(preparation, guidanceStack),
    [guidanceStack, preparation]
  );

  return {
    request,
    preparation,
    contextTruth,
    contextPlane,
    toolingPlane,
    evalPlane,
    guidanceStack,
    triageSummary,
    delegationContract,
    repoGuidanceSummary,
    truthSourceLabel: preparation ? "Runtime kernel v2 prepare" : null,
    loading,
    error,
  };
}
