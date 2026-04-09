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
  const [runtimeDraftProfileIdState, setRuntimeDraftProfileIdState] = useState("balanced-delegate");
  const [runtimeDraftProfileTouched, setRuntimeDraftProfileTouched] = useState(false);
  const [runtimeDraftProviderRoute, setRuntimeDraftProviderRoute] = useState("auto");
  const [runtimeSourceDraft, setRuntimeSourceDraft] =
    useState<RuntimeTaskLauncherSourceDraft | null>(null);

  const runtimeDraftProfileId = resolveMissionControlDraftProfileId({
    currentProfileId: runtimeDraftProfileIdState,
    repositoryExecutionProfileId: input.repositoryExecutionProfileId,
    sourceDraft: runtimeSourceDraft,
    draftProfileTouched: runtimeDraftProfileTouched,
  });

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
    if (
      input.normalizedProviderRoute &&
      input.normalizedProviderRoute !== runtimeDraftProviderRoute
    ) {
      setRuntimeDraftProviderRoute(input.normalizedProviderRoute);
    }
  }, [input.normalizedProviderRoute, runtimeDraftProviderRoute]);

  function selectRuntimeDraftProfile(profileId: string) {
    setRuntimeDraftProfileTouched(true);
    setRuntimeDraftProfileIdState(profileId);
    setRuntimeSourceDraft((current) =>
      current
        ? {
            ...current,
            profileId,
            fieldOrigins: {
              ...current.fieldOrigins,
              executionProfileId: "explicit_override",
            },
          }
        : current
    );
  }

  function applyRuntimeSourceDraft(input: {
    draftTitle: string;
    draftInstruction: string;
    sourceDraft: RuntimeTaskLauncherSourceDraft;
  }) {
    setRuntimeDraftTitle(input.draftTitle);
    setRuntimeDraftInstruction(input.draftInstruction);
    setRuntimeDraftProfileIdState(input.sourceDraft.profileId);
    setRuntimeSourceDraft(input.sourceDraft);
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
    applyRuntimeSourceDraft({
      draftTitle: nextDraft.draft.title,
      draftInstruction: nextDraft.draft.instruction,
      sourceDraft: nextDraft.draft.sourceDraft,
    });
    setRuntimeDraftProfileTouched(true);
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
    applyRuntimeSourceDraft,
    prepareRunLauncher,
    resetRuntimeDraftState,
  };
}
