import { useEffect, useMemo, useState } from "react";
import type { HugeCodeExecutionProfile } from "@ku0/code-runtime-host-contract";
import type { RepositoryExecutionContract } from "./runtimeRepositoryExecutionContract";
import {
  prepareRuntimeTaskLauncherDraft,
  type RuntimeTaskLauncherInterventionIntent,
  type RuntimeTaskLauncherSourceDraft,
} from "./runtimeTaskInterventionDraftFacade";
import { normalizeRuntimeTaskForProjection } from "./runtimeMissionControlProjectionNormalization";
import type { RuntimeAgentTaskSummary } from "../types/webMcpBridge";

export function resolveMissionControlDraftProfileId(input: {
  currentProfileId: string;
  repositoryExecutionProfileId: string | null | undefined;
  sourceDraft: RuntimeTaskLauncherSourceDraft | null;
  draftProfileTouched: boolean;
}) {
  if (
    input.sourceDraft ||
    input.draftProfileTouched ||
    !input.repositoryExecutionProfileId ||
    input.repositoryExecutionProfileId === input.currentProfileId
  ) {
    return input.currentProfileId;
  }
  return input.repositoryExecutionProfileId;
}

export function useRuntimeMissionControlDraftState(input: {
  workspaceId: string;
  executionProfiles: HugeCodeExecutionProfile[];
  repositoryExecutionProfileId: string | null | undefined;
  normalizedProviderRoute?: string | null;
}) {
  const [runtimeDraftTitle, setRuntimeDraftTitle] = useState("");
  const [runtimeDraftInstruction, setRuntimeDraftInstruction] = useState("");
  const [runtimeDraftProfileId, setRuntimeDraftProfileId] = useState("balanced-delegate");
  const [runtimeDraftProfileTouched, setRuntimeDraftProfileTouched] = useState(false);
  const [runtimeDraftProviderRoute, setRuntimeDraftProviderRoute] = useState("auto");
  const [runtimeSourceDraft, setRuntimeSourceDraft] =
    useState<RuntimeTaskLauncherSourceDraft | null>(null);

  const selectedExecutionProfile = useMemo<HugeCodeExecutionProfile>(
    () =>
      input.executionProfiles.find((profile) => profile.id === runtimeDraftProfileId) ??
      input.executionProfiles[1] ??
      input.executionProfiles[0],
    [input.executionProfiles, runtimeDraftProfileId]
  );

  useEffect(() => {
    setRuntimeDraftProfileTouched(false);
  }, [input.workspaceId]);

  useEffect(() => {
    const nextProfileId = resolveMissionControlDraftProfileId({
      currentProfileId: runtimeDraftProfileId,
      repositoryExecutionProfileId: input.repositoryExecutionProfileId,
      sourceDraft: runtimeSourceDraft,
      draftProfileTouched: runtimeDraftProfileTouched,
    });
    if (nextProfileId !== runtimeDraftProfileId) {
      setRuntimeDraftProfileId(nextProfileId);
    }
  }, [
    input.repositoryExecutionProfileId,
    runtimeDraftProfileId,
    runtimeDraftProfileTouched,
    runtimeSourceDraft,
  ]);

  useEffect(() => {
    if (
      input.normalizedProviderRoute &&
      input.normalizedProviderRoute !== runtimeDraftProviderRoute
    ) {
      setRuntimeDraftProviderRoute(input.normalizedProviderRoute);
    }
  }, [input.normalizedProviderRoute, runtimeDraftProviderRoute]);

  function selectRuntimeDraftProfile(profileId: string) {
    setRuntimeDraftProfileTouched(true);
    setRuntimeDraftProfileId(profileId);
  }

  function prepareRunLauncher(input: {
    task: RuntimeAgentTaskSummary;
    intent: RuntimeTaskLauncherInterventionIntent;
    executionProfileId?: string | null;
    fallbackProfileId?: string;
    repositoryExecutionContract?: RepositoryExecutionContract | null;
  }) {
    const nextDraft = prepareRuntimeTaskLauncherDraft({
      task: normalizeRuntimeTaskForProjection(input.task),
      intent: input.intent,
      executionProfileId: input.executionProfileId,
      fallbackProfileId: input.fallbackProfileId ?? "balanced-delegate",
      repositoryExecutionContract: input.repositoryExecutionContract,
    });
    if (!nextDraft.ok) {
      return {
        ok: false as const,
        error: nextDraft.error,
      };
    }
    setRuntimeDraftTitle(nextDraft.draft.title);
    setRuntimeDraftInstruction(nextDraft.draft.instruction);
    setRuntimeDraftProfileId(nextDraft.draft.profileId);
    setRuntimeDraftProfileTouched(true);
    setRuntimeSourceDraft(nextDraft.draft.sourceDraft);
    return {
      ok: true as const,
      infoMessage: nextDraft.draft.infoMessage,
    };
  }

  function resetRuntimeDraftState() {
    setRuntimeDraftTitle("");
    setRuntimeDraftInstruction("");
    setRuntimeDraftProfileTouched(false);
    setRuntimeSourceDraft(null);
  }

  return {
    runtimeDraftTitle,
    setRuntimeDraftTitle,
    runtimeDraftInstruction,
    setRuntimeDraftInstruction,
    runtimeDraftProfileId,
    runtimeDraftProfileTouched,
    runtimeDraftProviderRoute,
    setRuntimeDraftProviderRoute,
    runtimeSourceDraft,
    setRuntimeSourceDraft,
    selectedExecutionProfile,
    selectRuntimeDraftProfile,
    prepareRunLauncher,
    resetRuntimeDraftState,
  };
}
